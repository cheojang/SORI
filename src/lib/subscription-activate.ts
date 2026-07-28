import { prisma } from "@/lib/prisma";
import { getBillingKeyOwner, chargeWithBillingKey } from "@/lib/portone";
import { PREMIUM_MONTHLY_PRICE } from "@/lib/billing";

/**
 * 카드 등록(빌링키 발급) 직후 구독을 활성화한다.
 *
 * 포트원 결제창은 PC에서는 SDK가 결과를 바로 돌려주고, 모바일에서는 redirectUrl로
 * 돌아오면서 billingKey를 쿼리로 넘긴다. 두 경로가 같은 처리를 해야 하므로 이 함수로 모은다.
 *
 * 🔒 billingKey만 알면 남의 구독을 활성화할 수 있으므로, 포트원에 역조회해서
 *    그 빌링키의 customer.id가 정말 이 사용자인지 반드시 확인한다.
 */
export async function activateSubscription(
  userId: string,
  billingKey: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const owner = await getBillingKeyOwner(billingKey);

    if (owner.isDeleted) {
      return { ok: false, error: "이미 해지된 카드 등록이에요. 다시 등록해주세요." };
    }
    if (owner.userId !== userId) {
      console.error(
        `[activateSubscription] 소유자 불일치 userId=${userId} billingKeyOwner=${owner.userId}`,
      );
      return { ok: false, error: "카드 등록 정보가 올바르지 않아요" };
    }

    // 기존 구독이 이미 이 빌링키로 활성 상태면 중복 청구하지 않는다
    // (사용자가 성공 페이지를 새로고침하는 경우 방어)
    const existing = await prisma.subscription.findUnique({ where: { userId } });
    if (existing?.status === "active" && existing.billingKey === billingKey) {
      return { ok: true };
    }

    // 정기결제는 "카드 등록 = 지금 첫 달 결제"
    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    // 승인 실패 시 예외가 발생하므로, 여기까지 왔다면 결제가 성사된 것이다.
    // 금액은 서버 상수로만 정해져 클라이언트가 개입할 수 없다.
    await chargeWithBillingKey({
      billingKey,
      // 첫 회차 멱등키 — 빌링키가 같으면 같은 paymentId가 되어 중복 청구가 거절된다
      paymentId: `${userId}_init_${billingKey.slice(-12)}`,
      amount: PREMIUM_MONTHLY_PRICE,
      orderName: "바른발음 프리미엄 정기결제",
      customerId: userId,
    });

    const data = {
      plan: "premium",
      status: "active",
      billingKey,
      currentPeriodEnd: periodEnd,
      billingFailCount: 0,
    };
    await prisma.subscription.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });

    return { ok: true };
  } catch (e) {
    console.error("[activateSubscription]", e);
    return { ok: false, error: "결제 처리 중 오류가 발생했어요. 고객센터에 문의해주세요." };
  }
}
