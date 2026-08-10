import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { activateGooglePlaySubscription } from "@/lib/google-play-activate";

export const dynamic = "force-dynamic";

/**
 * POST /api/billing/google-play/verify
 * body: { purchaseToken: string }
 *
 * Digital Goods API 구매 직후 클라이언트가 호출한다. productId는 서버가 구글에
 * 재조회한 값만 신뢰하므로 body로 받지 않는다(클라이언트가 보낸 값은 검증 전 참고용일 뿐).
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "로그인이 필요해요" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}) as Record<string, unknown>);
  const purchaseToken = typeof body.purchaseToken === "string" ? body.purchaseToken : "";
  if (!purchaseToken) {
    return NextResponse.json({ ok: false, error: "구매 정보가 없어요" }, { status: 400 });
  }

  const result = await activateGooglePlaySubscription(session.user.id, purchaseToken);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
