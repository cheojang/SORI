import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteBillingKey } from "@/lib/portone";

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
    select: { status: true, plan: true, currentPeriodEnd: true, billingKey: true },
  });

  if (!sub || sub.plan !== "premium" || sub.status !== "active") {
    return NextResponse.json({ error: "취소할 수 있는 구독이 없어요" }, { status: 400 });
  }

  // 등록된 카드를 포트원에서도 정리한다. 실패해도 해지 자체는 진행한다
  // (여기서 막으면 사용자가 해지를 못 하게 되고, 자동청구는 아래 상태 변경으로 이미 멈춘다).
  if (sub.billingKey) {
    try {
      await deleteBillingKey(sub.billingKey);
    } catch (e) {
      console.error("[billing/cancel] 빌링키 삭제 실패:", e);
    }
  }

  await prisma.subscription.update({
    where: { userId: session.user.id },
    // 남은 기간은 유지하되 자동청구 대상에서 제외되도록 상태만 변경한다
    data: { status: "cancelled", billingKey: null },
  });

  return NextResponse.json({
    success: true,
    currentPeriodEnd: sub.currentPeriodEnd,
  });
}
