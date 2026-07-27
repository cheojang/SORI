import Link from "next/link";

export const metadata = {
  title: "이용약관 — 바른발음",
};

const EFFECTIVE_DATE = "2026년 5월 1일";
const SERVICE_NAME = "바른발음";
const COMPANY_NAME = "티엔피"; // 사업자등록증상 상호 — 서비스 브랜드명(바른발음)과 별개
const CONTACT_EMAIL = "support@sori-app.kr";
const BIZ_REG_NUMBER = "269-09-03462";
const CEO_NAME = "유태봉";
const BIZ_ADDRESS = "경기도 성남시 분당구 미금로 184, 103동 403호(구미동, 까치마을)";

export default function TermsPage() {
  return (
    <div className="max-w-2xl mx-auto px-5 py-10 text-[#3D3530]" style={{ fontFamily: "Pretendard, sans-serif" }}>

      {/* 헤더 */}
      <div className="mb-8">
        <Link href="/" className="text-sm text-[#FFB38A] hover:underline">← 홈으로</Link>
        <h1 className="text-2xl font-black mt-4 mb-1">이용약관</h1>
        <p className="text-sm text-[#8B7E74]">시행일: {EFFECTIVE_DATE}</p>
      </div>

      {/* 핵심 고지 박스 */}
      <div className="bg-[#FFF5EE] border-l-4 border-[#FFB38A] rounded-r-2xl px-5 py-4 mb-8">
        <p className="font-bold text-sm text-[#3D3530] mb-1">⚠️ 중요 안내 — 반드시 읽어주세요</p>
        <p className="text-sm text-[#8B7E74] leading-relaxed">
          {SERVICE_NAME}은 <strong>가정에서의 언어 발달 보조 학습 도구</strong>입니다.
          의료기기·의료 서비스·언어재활 치료가 아니며, 전문 언어재활사의 진단·처방·치료를
          대체할 수 없습니다. 아이의 발음 또는 언어 발달에 우려가 있으시면 반드시
          <strong> 전문 언어재활사 또는 소아과 전문의와 상담</strong>하시기 바랍니다.
        </p>
      </div>

      <div className="space-y-8 text-sm leading-relaxed">

        {/* 제1조 */}
        <section>
          <h2 className="font-bold text-base mb-2">제1조 (목적)</h2>
          <p>
            본 약관은 {COMPANY_NAME}(이하 "회사")가 제공하는 {SERVICE_NAME} 서비스(이하 "서비스")의
            이용 조건 및 절차, 회사와 이용자의 권리·의무 및 책임 사항을 규정함을 목적으로 합니다.
          </p>
        </section>

        {/* 제2조 */}
        <section>
          <h2 className="font-bold text-base mb-2">제2조 (서비스의 성격 및 한계)</h2>
          <ol className="list-decimal pl-5 space-y-2 text-[#3D3530]">
            <li>
              서비스는 아동의 발음 연습을 돕기 위한 <strong>교육·학습 보조 소프트웨어</strong>입니다.
            </li>
            <li>
              서비스에서 제공하는 AI 분석, 훈련 제안, 단어 추천은 <strong>참고 정보</strong>에 해당하며,
              개인별 상태 진단이나 의학적·재활 치료 목적으로 사용될 수 없습니다.
            </li>
            <li>
              회사는 서비스 이용 결과로 인한 아동의 언어·발음 발달을 보장하지 않습니다.
            </li>
            <li>
              아이의 언어 발달 지연, 조음 장애, 기타 언어 문제가 의심되는 경우,
              전문 언어재활사·이비인후과·소아신경과 등 전문가와 반드시 상담하시기 바랍니다.
            </li>
          </ol>
        </section>

        {/* 제3조 */}
        <section>
          <h2 className="font-bold text-base mb-2">제3조 (이용자 자격)</h2>
          <ol className="list-decimal pl-5 space-y-2">
            <li>서비스는 만 14세 이상 보호자(부모·양육자 등)를 대상으로 합니다.</li>
            <li>
              만 14세 미만 아동은 보호자의 감독 하에 서비스를 이용할 수 있으며,
              보호자가 서비스 이용에 대한 모든 책임을 집니다.
            </li>
            <li>
              회원가입 시 실명 또는 정확한 정보를 제공해야 하며, 허위 정보 제공으로 인한
              불이익은 이용자 본인이 부담합니다.
            </li>
          </ol>
        </section>

        {/* 제4조 */}
        <section>
          <h2 className="font-bold text-base mb-2">제4조 (서비스 제공 및 변경)</h2>
          <ol className="list-decimal pl-5 space-y-2">
            <li>회사는 연중무휴 24시간 서비스 제공을 원칙으로 하되, 시스템 점검·장애·천재지변 등
            불가피한 사유로 서비스가 일시 중단될 수 있습니다.</li>
            <li>회사는 서비스의 일부 또는 전부를 사전 고지 후 변경하거나 종료할 수 있으며,
            유료 구독 이용자에게는 이메일로 30일 전 공지합니다.</li>
            <li>서비스 내 AI 분석 기능은 외부 AI API(Google Gemini 등)를 사용하며,
            해당 서비스의 정책 변경에 따라 기능이 조정될 수 있습니다.</li>
          </ol>
        </section>

        {/* 제5조 */}
        <section>
          <h2 className="font-bold text-base mb-2">제5조 (요금 및 결제)</h2>
          <ol className="list-decimal pl-5 space-y-2">
            <li>서비스는 무료 플랜과 유료 구독 플랜으로 구성됩니다. 구체적인 요금은 서비스 내 안내 페이지에서 확인하세요.</li>
            <li>유료 구독은 월 단위 자동 결제이며, 결제 수단은 회사가 지정한 방법을 따릅니다.</li>
            <li>
              구독 해지는 다음 결제일 전에 앱 내 설정에서 직접 진행할 수 있습니다.
              이미 결제된 기간에 대한 환불은 관련 법령(전자상거래법 등)에 따릅니다.
            </li>
            <li>7일 이내 서비스를 전혀 이용하지 않은 경우 전액 환불을 요청할 수 있습니다.</li>
          </ol>
        </section>

        {/* 제6조 */}
        <section>
          <h2 className="font-bold text-base mb-2">제6조 (이용자의 의무)</h2>
          <ol className="list-decimal pl-5 space-y-2">
            <li>이용자는 서비스를 본 약관에 따라 정당하게 이용해야 합니다.</li>
            <li>타인의 계정을 무단으로 사용하거나, 서비스를 상업적 목적으로 무단 활용하는 행위를 금지합니다.</li>
            <li>서비스에 악성코드를 유포하거나 서버에 과부하를 주는 행위를 금지합니다.</li>
            <li>아이의 개인정보(이름, 발음 데이터 등)를 입력 시 보호자의 동의 하에 입력해야 합니다.</li>
          </ol>
        </section>

        {/* 제7조 */}
        <section>
          <h2 className="font-bold text-base mb-2">제7조 (면책 조항)</h2>
          <ol className="list-decimal pl-5 space-y-2">
            <li>
              회사는 서비스가 제공하는 AI 분석·훈련 제안의 정확성·완전성·적절성을 보증하지 않습니다.
              모든 분석 결과는 알고리즘에 의한 참고 정보이며, 전문가 판단을 대체하지 않습니다.
            </li>
            <li>
              이용자가 서비스를 의료 목적으로 사용하거나, 전문가 상담 없이 서비스 결과만을
              근거로 판단·행동하여 발생하는 불이익에 대해 회사는 책임을 지지 않습니다.
            </li>
            <li>
              천재지변, 통신 장애, 외부 API 서비스 중단 등 불가항력적 사유로 인한
              서비스 중단에 대해 회사는 책임을 지지 않습니다.
            </li>
          </ol>
        </section>

        {/* 제8조 */}
        <section>
          <h2 className="font-bold text-base mb-2">제8조 (지식재산권)</h2>
          <p>
            서비스 내 모든 콘텐츠(텍스트, 디자인, 로고, 소프트웨어 등)에 대한 지식재산권은
            회사에 귀속됩니다. 이용자는 서비스를 통해 제공받은 콘텐츠를 회사의 사전 동의 없이
            복제·배포·상업적으로 이용할 수 없습니다.
          </p>
        </section>

        {/* 제9조 */}
        <section>
          <h2 className="font-bold text-base mb-2">제9조 (약관 변경)</h2>
          <p>
            회사는 필요한 경우 본 약관을 변경할 수 있으며, 변경 시 시행일 7일 전(중요 사항의 경우 30일 전)
            서비스 내 공지사항 또는 이메일을 통해 안내합니다. 변경 후에도 서비스를 계속 이용하면
            변경된 약관에 동의한 것으로 간주합니다.
          </p>
        </section>

        {/* 제10조 */}
        <section>
          <h2 className="font-bold text-base mb-2">제10조 (준거법 및 분쟁 해결)</h2>
          <p>
            본 약관은 대한민국 법률에 따라 해석되며, 서비스 이용과 관련된 분쟁은 대한민국 법원을
            관할 법원으로 합니다.
          </p>
        </section>

        {/* 문의 */}
        <section className="bg-[#F5F5F5] rounded-2xl px-5 py-4">
          <p className="font-bold text-sm mb-1">문의</p>
          <p className="text-[#8B7E74]">이메일: <a href={`mailto:${CONTACT_EMAIL}`} className="underline">{CONTACT_EMAIL}</a></p>
        </section>

        {/* 사업자 정보 (전자상거래법 제10조 필수 표시 사항) */}
        <section className="bg-[#F5F5F5] rounded-2xl px-5 py-4 text-xs text-[#8B7E74] leading-relaxed">
          <p className="font-bold text-sm text-[#3D3530] mb-1.5">사업자 정보</p>
          <p>상호: {COMPANY_NAME} (서비스명: {SERVICE_NAME})</p>
          <p>대표자: {CEO_NAME}</p>
          <p>사업자등록번호: {BIZ_REG_NUMBER}</p>
          <p>사업장 소재지: {BIZ_ADDRESS}</p>
        </section>

      </div>

      {/* 하단 링크 */}
      <div className="mt-10 pt-6 border-t border-[#F0E8E0] flex gap-4 text-xs text-[#8B7E74]">
        <Link href="/privacy" className="hover:underline">개인정보 처리방침</Link>
        <Link href="/" className="hover:underline">홈으로</Link>
      </div>
    </div>
  );
}
