"use client";

import { useEffect, useState } from "react";

/**
 * 랜딩페이지 가격 표시 — 플레이스토어(TWA) 안에서는 결제 버튼(PortOneBillingButton)과
 * 동일한 기준으로 숨긴다. NEXT_PUBLIC_TWA_PAYMENT_ENABLED="true"가 아니면 TWA
 * 안에서는 가격 대신 중립 문구만 보여준다 (구글 인앱결제 우회로 보이지 않게).
 */
export function LandingPrice() {
  const [hidePrice, setHidePrice] = useState(false);

  useEffect(() => {
    const isTWA = document.referrer.startsWith("android-app://");
    const enabled = process.env.NEXT_PUBLIC_TWA_PAYMENT_ENABLED === "true";
    setHidePrice(isTWA && !enabled);
  }, []);

  if (hidePrice) {
    return (
      <>
        <p className="text-lg font-black text-[#B45309]">합리적인 가격</p>
        <p className="text-xs text-[#786E60] mt-1">앱에서 자세히 확인해보세요</p>
      </>
    );
  }

  return (
    <>
      <p className="text-3xl font-black text-[#B45309]">4,900원<span className="text-base">/월</span></p>
      <p className="text-xs text-[#786E60] mt-1">매달 자동 결제 · 언제든 해지 가능</p>
    </>
  );
}
