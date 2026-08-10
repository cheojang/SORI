import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cancelSubscription as cancelPlaySubscription } from "@/lib/google-play";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "로그인이 필요해요" }, { status: 401 });
  }
  if (session.user.isGuest) {
    return NextResponse.json({ error: "회원만 이용할 수 있어요" }, { status: 403 });
  }

  const sub = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
    select: { status: true, plan: true, currentPeriodEnd: true, playPurchaseToken: true },
  });

  if (!sub || sub.plan !== "premium" || sub.status !== "active") {
    return NextResponse.json({ error: "취소할 수 있는 구독이 없어요" }, { status: 400 });
  }

  // 구글 쪽 자동 갱신을 실제로 멈춘다. 이게 실패하면 사용자는 해지한 줄 알지만
  // 다음 달에 또 청구되므로, 여기서는 실패를 삼키지 않고 에러를 반환한다.
  if (sub.playPurchaseToken) {
    try {
      await cancelPlaySubscription(sub.playPurchaseToken);
    } catch (e) {
      console.error("[billing/cancel] 플레이 구독 해지 실패:", e);
      return NextResponse.json(
        {
          error:
            "해지 처리에 실패했어요. 플레이 스토어 → 결제 및 구독 → 정기 결제에서 직접 해지하거나 잠시 후 다시 시도해주세요.",
        },
        { status: 502 },
      );
    }
  }

  await prisma.subscription.update({
    where: { userId: session.user.id },
    // 남은 기간은 유지하되 해지 상태로 표시한다.
    // playPurchaseToken은 지우지 않는다 — 동기화 크론이 이 토큰으로 실제 만료 시점을
    // 확인해 무료로 강등해야 하기 때문. (지우면 만료를 영영 감지하지 못한다)
    data: { status: "cancelled" },
  });

  return NextResponse.json({
    success: true,
    currentPeriodEnd: sub.currentPeriodEnd,
  });
}
