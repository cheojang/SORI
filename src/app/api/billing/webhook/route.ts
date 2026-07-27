import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "@portone/server-sdk";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * POST /api/billing/webhook — 포트원 웹훅 수신.
 *
 * 정기결제 갱신은 크론이 주도하지만, PG/포트원 쪽에서 결제가 취소되거나
 * 빌링키가 삭제되는 등 우리가 모르는 상태 변화가 생길 수 있어 이를 반영한다.
 *
 * 서명 검증은 포트원 공식 SDK에 위임한다(직접 HMAC을 구현하지 않는다).
 */
export async function POST(req: NextRequest) {
  const secret = process.env.PORTONE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[billing/webhook] PORTONE_WEBHOOK_SECRET 환경변수가 설정되지 않았습니다");
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  // 서명 검증은 원본 문자열 그대로에 대해 수행해야 한다 (JSON 재직렬화 금지)
  const raw = await req.text();
  const headers = Object.fromEntries(req.headers.entries());

  let event: Awaited<ReturnType<typeof Webhook.verify>>;
  try {
    event = await Webhook.verify(secret, raw, headers);
  } catch (e) {
    if (e instanceof Webhook.WebhookVerificationError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[billing/webhook] 검증 오류:", e);
    return NextResponse.json({ error: "Bad Request" }, { status: 400 });
  }

  // 포트원이 새 이벤트 타입을 추가해도 500을 내지 않도록 조용히 통과시킨다
  if (Webhook.isUnrecognizedWebhook(event)) {
    return NextResponse.json({ received: true });
  }

  const { type, data } = event as { type: string; data?: Record<string, unknown> };

  // 결제 취소/실패 → 구독 해지. paymentId는 `${userId}_...` 형식으로 우리가 만든 값이다.
  if (type === "Transaction.Cancelled" || type === "Transaction.Failed") {
    const paymentId = typeof data?.paymentId === "string" ? data.paymentId : "";
    const userId = paymentId.split("_")[0];
    if (!userId) {
      console.warn("[billing/webhook] paymentId 형식 불일치:", paymentId);
      return NextResponse.json({ received: true });
    }

    const exists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!exists) {
      console.warn("[billing/webhook] 존재하지 않는 userId:", userId);
      return NextResponse.json({ received: true });
    }

    await prisma.subscription.updateMany({
      where: { userId },
      data: { status: "cancelled", plan: "free" },
    });
  }

  // 빌링키가 포트원/PG 쪽에서 삭제되면 더 이상 자동청구가 불가하므로 구독을 정리한다
  if (type === "BillingKey.Deleted") {
    const billingKey = typeof data?.billingKey === "string" ? data.billingKey : "";
    if (billingKey) {
      await prisma.subscription.updateMany({
        where: { billingKey },
        data: { status: "cancelled", plan: "free", billingKey: null },
      });
    }
  }

  return NextResponse.json({ received: true });
}
