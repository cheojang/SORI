import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { chargeWithBillingKey } from "@/lib/portone";
import { PREMIUM_MONTHLY_PRICE } from "@/lib/billing";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BILLING_RETRIES = 3; // 연속 실패 3회(3일) 그레이스 후 자동 해지

/**
 * GET /api/cron/billing-charge — Vercel Cron이 매일 호출.
 *
 * currentPeriodEnd가 지난(=오늘 결제해야 하는) 정기결제 구독을 찾아 자동 청구한다.
 * - 성공: currentPeriodEnd를 1개월 연장, status=active, billingFailCount=0
 * - 실패: billingFailCount 증가. MAX_BILLING_RETRIES 미만이면 status=past_due로 그레이스
 *   유지(usage-limit.ts가 이 기간 프리미엄 접근을 계속 허용), 초과하면 free로 강등하고
 *   더 이상 재시도하지 않는다(재구독은 사용자가 카드를 다시 등록해야 함).
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const due = await prisma.subscription.findMany({
    where: {
      plan: "premium",
      status: { in: ["active", "past_due"] },
      billingKey: { not: null },
      currentPeriodEnd: { lte: new Date() },
    },
  });

  let charged = 0;
  let failed = 0;
  let downgraded = 0;

  for (const sub of due) {
    // 같은 결제 주기를 여러 번 청구하지 않도록 날짜 기반 멱등키 사용
    const paymentId = `${sub.userId}_billing_${sub.currentPeriodEnd!.toISOString().slice(0, 10)}`;

    try {
      // 승인 실패 시 예외가 발생하므로, 여기까지 왔다면 결제가 성사된 것이다.
      // 금액은 서버 상수로만 정해져 외부에서 개입할 수 없다.
      await chargeWithBillingKey({
        billingKey: sub.billingKey!,
        paymentId,
        amount: PREMIUM_MONTHLY_PRICE,
        orderName: "바른발음 프리미엄 정기결제",
        customerId: sub.userId,
      });

      const nextPeriodEnd = new Date(sub.currentPeriodEnd!);
      nextPeriodEnd.setMonth(nextPeriodEnd.getMonth() + 1);

      await prisma.subscription.update({
        where: { id: sub.id },
        data: { status: "active", currentPeriodEnd: nextPeriodEnd, billingFailCount: 0 },
      });
      charged++;
    } catch (e) {
      console.error(`[cron/billing-charge] 청구 실패 userId=${sub.userId}:`, e instanceof Error ? e.message : e);
      const nextFailCount = sub.billingFailCount + 1;

      if (nextFailCount >= MAX_BILLING_RETRIES) {
        // 그레이스 소진 — 무료로 강등, 재시도 중단 (재구독하려면 카드 재등록 필요)
        await prisma.subscription.update({
          where: { id: sub.id },
          data: { plan: "free", status: "cancelled", billingFailCount: 0 },
        });
        downgraded++;
      } else {
        await prisma.subscription.update({
          where: { id: sub.id },
          data: { status: "past_due", billingFailCount: nextFailCount },
        });
        failed++;
      }
    }
  }

  return NextResponse.json({ ok: true, total: due.length, charged, failed, downgraded });
}
