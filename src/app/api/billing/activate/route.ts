import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { activateSubscription } from "@/lib/subscription-activate";

export const dynamic = "force-dynamic";

/**
 * POST /api/billing/activate
 * body: { billingKey: string }
 *
 * PC 결제창 경로에서 호출된다. 빌링키 발급 직후 구독을 활성화한다.
 * (모바일 리다이렉트 경로는 /subscribe/success 페이지가 같은 로직을 직접 호출)
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "로그인이 필요해요" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}) as Record<string, unknown>);
  const billingKey = typeof body.billingKey === "string" ? body.billingKey : "";
  if (!billingKey) {
    return NextResponse.json({ ok: false, error: "빌링키가 없어요" }, { status: 400 });
  }

  const result = await activateSubscription(session.user.id, billingKey);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
