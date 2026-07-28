"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BubbleButton } from "@/components/ui/BubbleButton";

interface Props {
  userId: string;
}

export function PortOneBillingButton({ userId }: Props) {
  const [loading, setLoading] = useState(false);
  const [isTWA, setIsTWA] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // TWA 감지: 안드로이드 앱 내에서 열리면 referrer가 android-app:// 로 시작
    setIsTWA(document.referrer.startsWith("android-app://"));
  }, []);

  // TWA(플레이스토어 앱) 환경: 외부 브라우저로 유도
  // ⚠️ 구글 플레이 심사 중 리스크 스위치: 인앱결제 우회로 보일 수 있는 이 버튼을
  //    NEXT_PUBLIC_TWA_PAYMENT_ENABLED="true" 가 아니면 완전히 숨긴다(기본값=숨김,
  //    안전한 상태가 기본). TWA는 앱 재빌드 없이 웹 배포만으로 내용이 바뀌므로,
  //    심사 제출 시엔 끄고, 승인 후 이 값만 켜서 재배포하면 앱 재심사 없이 노출된다.
  if (isTWA) {
    const twaPaymentEnabled = process.env.NEXT_PUBLIC_TWA_PAYMENT_ENABLED === "true";
    if (!twaPaymentEnabled) {
      return (
        <div className="text-center py-4 px-2">
          <p className="text-sm font-semibold text-[#8B7E74]">구독 기능을 준비하고 있어요</p>
          <p className="text-xs text-[#B0A89E] mt-1">곧 이용하실 수 있어요. 조금만 기다려주세요!</p>
        </div>
      );
    }
    return (
      <div className="space-y-2">
        <BubbleButton
          variant="peach"
          size="lg"
          className="w-full"
          onClick={() => {
            // _blank로 열면 TWA에서 Chrome 외부 브라우저로 열림
            window.open(window.location.href, "_blank", "noopener");
          }}
        >
          🌐 브라우저에서 구독하기
        </BubbleButton>
        <p className="text-[11px] text-center text-[#A89B8E]">
          앱 결제는 웹 브라우저에서 진행돼요
        </p>
      </div>
    );
  }

  /**
   * 정기결제(빌링): 포트원 결제창에서 카드를 등록하면 빌링키가 발급되고,
   * 이후 매달 서버(크론)가 그 빌링키로 자동 청구한다.
   *
   * 카드번호는 포트원이 호스팅하는 결제창에서만 입력되며 우리 서버를 거치지 않는다.
   */
  async function handleRegisterCard() {
    if (!userId || userId.startsWith("guest:")) {
      router.push("/login?callbackUrl=/subscribe");
      return;
    }

    const storeId = process.env.NEXT_PUBLIC_PORTONE_STORE_ID;
    const channelKey = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY;

    if (!storeId || !channelKey) {
      alert(
        "결제 설정이 완료되지 않았습니다.\n" +
          "NEXT_PUBLIC_PORTONE_STORE_ID / NEXT_PUBLIC_PORTONE_CHANNEL_KEY 환경변수를 설정해 주세요.",
      );
      return;
    }

    setLoading(true);
    try {
      // SDK는 결제창을 띄우는 시점에만 필요 — 초기 번들 크기를 위해 동적 로드
      const PortOne = (await import("@portone/browser-sdk/v2")).default;

      const response = await PortOne.requestIssueBillingKey({
        storeId,
        channelKey,
        // NHN KCP는 빌링키 발급 수단으로 카드만 지원한다
        billingKeyMethod: "CARD",
        issueName: "바른발음 프리미엄 정기결제",
        // 🔒 서버가 "이 빌링키가 정말 이 사용자의 것인지" 검증하는 근거값.
        //    customerId는 PG마다 지원 여부가 달라(KCP는 미지원) customData를 주 경로로 쓴다.
        customData: { userId },
        customer: { customerId: userId },
        // 모바일은 결제창에서 이 주소로 돌아오며 billingKey를 쿼리로 전달한다
        redirectUrl: `${window.location.origin}/subscribe/success`,
      });

      // 모바일 리다이렉트 경로에서는 여기까지 오지 않는다(페이지가 이동됨).
      // PC에서는 결과가 바로 반환된다.
      if (!response) {
        return;
      }
      if (response.code) {
        // 사용자가 결제창을 닫은 경우까지 에러 팝업을 띄우지 않는다
        if (/cancel/i.test(response.code)) return;
        console.error("[PortOneBillingButton]", response.code, response.message);
        alert(response.message ?? "카드 등록에 실패했어요. 잠시 후 다시 시도해주세요.");
        return;
      }

      // 발급 성공 → 서버에서 소유자 검증 + 첫 달 결제 + 구독 활성화
      const res = await fetch("/api/billing/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billingKey: response.billingKey }),
      });
      const result = await res.json();

      if (!res.ok || !result.ok) {
        alert(result.error ?? "결제 처리 중 오류가 발생했어요.");
        return;
      }
      router.push("/subscribe/success?done=1");
    } catch (e) {
      console.error("[PortOneBillingButton]", e);
      alert("카드 등록 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <BubbleButton
      variant="peach"
      size="lg"
      className="w-full"
      onClick={handleRegisterCard}
      disabled={loading}
    >
      {loading ? "카드 등록 창 여는 중..." : "🎉 카드 등록하고 시작하기"}
    </BubbleButton>
  );
}
