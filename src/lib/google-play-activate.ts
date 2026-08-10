import { prisma } from "@/lib/prisma";
import { getSubscriptionStatus, acknowledgePurchase } from "@/lib/google-play";

/**
 * 구글 플레이 구매를 우리 서비스 계정에 연결하고 구독을 활성화한다.
 *
 * 🔒 소유자 검증: 구글 웹 결제 흐름(Digital Goods API + Payment Request API)은
 * PortOne처럼 구매에 우리 쪽 식별자(customData)를 실어 보낼 방법이 없다
 * (네이티브 안드로이드 IAB의 obfuscatedAccountId 같은 필드가 웹 흐름엔 없음).
 * 그래서 "이 토큰을 처음 제출한 로그인 사용자가 주인"이라는 최초 등록 방식으로 대신한다.
 * playPurchaseToken에 @unique 제약을 걸어두어, 이미 다른 계정에 연결된 토큰이
 * 두 번째 사용자에게 다시 연결되는 것을 DB 레벨에서 막는다.
 */
export async function activateGooglePlaySubscription(
  userId: string,
  purchaseToken: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const status = await getSubscriptionStatus(purchaseToken);

    if (!status.active) {
      return { ok: false, error: "활성화되지 않은 구독이에요. 잠시 후 다시 시도해주세요." };
    }

    // 구매한 상품이 정말 우리 프리미엄 구독인지 확인한다.
    // 이 검사가 없으면 향후 다른(더 저렴한) 상품을 추가했을 때 그것만 사고도
    // 프리미엄이 열릴 수 있다. 상품 ID는 클라이언트가 아니라 구글 응답에서 읽는다.
    const expectedProductId = process.env.NEXT_PUBLIC_GOOGLE_PLAY_PRODUCT_ID || "premium_monthly";
    if (status.productId !== expectedProductId) {
      console.error(
        `[activateGooglePlaySubscription] 상품 불일치 expected=${expectedProductId} got=${status.productId}`,
      );
      return { ok: false, error: "구독 상품 정보가 올바르지 않아요." };
    }

    // 이미 다른 계정에 연결된 토큰인지 먼저 확인 (DB unique 제약과 별개로 친절한 에러 메시지용)
    const existing = await prisma.subscription.findUnique({ where: { playPurchaseToken: purchaseToken } });
    if (existing && existing.userId !== userId) {
      console.error(`[activateGooglePlaySubscription] 토큰 재사용 시도 userId=${userId} owner=${existing.userId}`);
      return { ok: false, error: "이미 다른 계정에 연결된 구매예요." };
    }

    if (!status.acknowledged) {
      await acknowledgePurchase(purchaseToken);
    }

    const data = {
      plan: "premium",
      status: "active",
      playPurchaseToken: purchaseToken,
      // billingKey(포트원 경로)와는 별개 필드라 그대로 둔다 — 결제 경로 전환 시에도 이전 이력이 남는다.
      currentPeriodEnd: status.expiryTime,
      billingFailCount: 0,
    };
    await prisma.subscription.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });

    return { ok: true };
  } catch (e) {
    console.error("[activateGooglePlaySubscription]", e);
    return { ok: false, error: "결제 확인 중 오류가 발생했어요. 고객센터에 문의해주세요." };
  }
}
