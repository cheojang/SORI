import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteBillingKey } from "@/lib/portone";
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
    select: { status: true, plan: true, currentPeriodEnd: true, billingKey: true, playPurchaseToken: true },
  });

  if (!sub || sub.plan !== "premium" || sub.status !== "active") {
    return NextResponse.json({ error: "취소할 수 있는 구독이 없어요" }, { status: 400 });
  }

  // 결제 경로(포트원/구글 플레이) 쪽 정기결제도 함께 끊는다. 실패해도 해지 자체는 진행한다
  // (여기서 막으면 사용자가 해지를 못 하게 되고, 자동청구/갱신은 아래 상태 변경으로 이미 멈춘다).
  if (sub.billingKey) {
    try {
      await deleteBillingKey(sub.billingKey);
    } catch (e) {
      console.error("[billing/cancel] 빌링키 삭제 실패:", e);
    }
  }
  if (sub.playPurchaseToken) {
    try {
      await cancelPlaySubscription(sub.playPurchaseToken);
    } catch (e) {
      console.error("[billing/cancel] 플레이 구독 해지 실패:", e);
    }
  }

  await prisma.subscription.update({
    where: { userId: session.user.id },
    // 남은 기간은 유지하되 자동청구/갱신 대상에서 제외되도록 상태만 변경한다
    data: { status: "cancelled", billingKey: null, playPurchaseToken: null },
  });

  return NextResponse.json({
    success: true,
    currentPeriodEnd: sub.currentPeriodEnd,
  });
}
