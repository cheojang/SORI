/**
 * 랜딩페이지 가격 표시.
 *
 * 구글 플레이 인앱결제로 전환하면서 TWA 안에서 가격을 숨길 이유가 없어졌다
 * (플레이 빌링은 구글이 요구하는 정식 인앱결제 방식이라 우회로 보일 리스크가 없음).
 * 웹은 실제 결제가 준비 중이지만, 가격 자체를 보여주는 건 문제없다 —
 * /subscribe로 들어가면 "웹 결제는 준비 중" 안내가 별도로 뜬다.
 */
export function LandingPrice() {
  return (
    <>
      <p className="text-3xl font-black text-[#B45309]">4,900원<span className="text-base">/월</span></p>
      <p className="text-xs text-[#786E60] mt-1">매달 자동 결제 · 언제든 해지 가능</p>
    </>
  );
}
