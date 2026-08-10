"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BubbleButton } from "@/components/ui/BubbleButton";

interface Props {
  userId: string;
}

// PaymentRequest API의 result.details 타입은 표준에 없어 SDK 타입이 제공되지 않는다.
interface PlayBillingPurchaseDetails {
  purchaseToken: string;
  itemId?: string;
}

const PLAY_BILLING_METHOD = "https://play.google.com/billing";

function getProductId(): string {
  return process.env.NEXT_PUBLIC_GOOGLE_PLAY_PRODUCT_ID || "premium_monthly";
}

/** 서버에 구매 검증 요청 — 신규 구매·기존 미승인 구매 재확인 둘 다 이 경로를 탄다. */
async function verifyOnServer(purchaseToken: string): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch("/api/billing/google-play/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ purchaseToken }),
  });
  return res.json();
}

export function GooglePlayBillingButton({ userId }: Props) {
  const [loading, setLoading] = useState(false);
  const [isTWA, setIsTWA] = useState<boolean | null>(null);
  const router = useRouter();

  useEffect(() => {
    // TWA 감지: 안드로이드 앱 내에서 열리면 referrer가 android-app:// 로 시작
    const twa = document.referrer.startsWith("android-app://");
    setIsTWA(twa);
    if (!twa) return;

    // 마운트 시 미승인 구매 재확인 — 결제 직후 브라우저가 닫히는 등으로 verify 호출이
    // 누락된 경우, 3일 내 승인하지 않으면 구글이 자동 환불하므로 여기서 한 번 더 시도한다.
    (async () => {
      try {
        if (!("getDigitalGoodsService" in window)) return;
        const service = await (window as any).getDigitalGoodsService(PLAY_BILLING_METHOD);
        const purchases = await service.listPurchases();
        for (const p of purchases) {
          await verifyOnServer(p.purchaseToken).catch(() => {});
        }
      } catch {
        // Digital Goods API 미지원 환경 — 아래 구매 버튼에서도 동일하게 처리되므로 조용히 무시
      }
    })();
  }, []);

  // 아직 판별 전(초기 렌더 깜빡임 방지)
  if (isTWA === null) return null;

  // 웹 브라우저: 출시 예정 — 구글 플레이 결제는 안드로이드 앱 안에서만 가능하다
  if (!isTWA) {
    return (
      <div className="text-center py-4 px-2">
        <p className="text-sm font-semibold text-[#8B7E74]">앱에서 구독할 수 있어요</p>
        <p className="text-xs text-[#B0A89E] mt-1">웹 결제는 준비 중이에요. 구글 플레이 스토어 앱을 이용해주세요!</p>
      </div>
    );
  }

  async function handleSubscribe() {
    if (!userId || userId.startsWith("guest:")) {
      router.push("/login?callbackUrl=/subscribe");
      return;
    }

    if (!("getDigitalGoodsService" in window) || typeof PaymentRequest === "undefined") {
      alert("이 화면에서는 구독 결제를 지원하지 않아요. 플레이 스토어 앱에서 최신 버전으로 업데이트해주세요.");
      return;
    }

    setLoading(true);
    try {
      // 구글 플레이 결제 지원 여부 확인
      await (window as any).getDigitalGoodsService(PLAY_BILLING_METHOD);

      const paymentMethods = [
        { supportedMethods: PLAY_BILLING_METHOD, data: { sku: getProductId() } },
      ];
      // total은 Payment Request API 표준상 필수 필드지만 플레이 빌링에서는 사용되지 않는다
      // (실제 가격은 Play Console에 등록된 값을 따른다).
      const paymentDetails = {
        total: { label: "바른발음 프리미엄", amount: { currency: "KRW", value: "0" } },
      };

      const request = new PaymentRequest(paymentMethods as any, paymentDetails as any);
      const response = await request.show();
      const details = response.details as unknown as PlayBillingPurchaseDetails;

      // 결제 시트 UI를 닫는다 — 우리 쪽 서버 검증과는 별개로 반드시 호출해야 한다
      await response.complete("success");

      const result = await verifyOnServer(details.purchaseToken);
      if (!result.ok) {
        alert(result.error ?? "결제 확인 중 오류가 발생했어요.");
        return;
      }
      router.push("/subscribe/success?done=1");
    } catch (e: any) {
      // 사용자가 결제 시트를 닫은 경우까지 에러 팝업을 띄우지 않는다
      if (e?.name === "AbortError") return;
      console.error("[GooglePlayBillingButton]", e);
      alert("구독 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <BubbleButton
      variant="peach"
      size="lg"
      className="w-full"
      onClick={handleSubscribe}
      disabled={loading}
    >
      {loading ? "결제 창 여는 중..." : "🎉 구독하고 시작하기"}
    </BubbleButton>
  );
}
