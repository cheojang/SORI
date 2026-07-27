import Link from "next/link";

export const metadata = {
  title: "개인정보 처리방침 — 바른발음",
};

const EFFECTIVE_DATE = "2026년 5월 1일";
const SERVICE_NAME = "바른발음";
const COMPANY_NAME = "티엔피"; // 사업자등록증상 상호 — 서비스 브랜드명(바른발음)과 별개
const CONTACT_EMAIL = "privacy@sori-app.kr";
const BIZ_REG_NUMBER = "269-09-03462";
const CEO_NAME = "유태봉";
const BIZ_ADDRESS = "경기도 성남시 분당구 미금로 184, 103동 403호(구미동, 까치마을)";

export default function PrivacyPage() {
  return (
    <div className="max-w-2xl mx-auto px-5 py-10 text-[#3D3530]" style={{ fontFamily: "Pretendard, sans-serif" }}>

      {/* 헤더 */}
      <div className="mb-8">
        <Link href="/" className="text-sm text-[#FFB38A] hover:underline">← 홈으로</Link>
        <h1 className="text-2xl font-black mt-4 mb-1">개인정보 처리방침</h1>
        <p className="text-sm text-[#8B7E74]">시행일: {EFFECTIVE_DATE}</p>
      </div>

      {/* 요약 박스 */}
      <div className="bg-[#F0FAF8] border-l-4 border-[#7EDFD0] rounded-r-2xl px-5 py-4 mb-8">
        <p className="font-bold text-sm mb-2">🔒 개인정보 처리 요약</p>
        <ul className="text-sm text-[#8B7E74] space-y-1">
          <li>✔ 수집 정보: 이메일, 아이 닉네임·생년월일(선택)·사진(선택), 발음 연습 기록</li>
          <li>✔ 제3자 제공: 없음 / AI 분석을 위해 Google(미국)에 일부 데이터 처리 위탁 (제6조)</li>
          <li>✔ 보유 기간: 회원 탈퇴 후 30일 이내 삭제</li>
          <li>✔ 아동 정보: 법정대리인(보호자)이 직접 입력·동의하며 보호자 계정 하에 관리</li>
        </ul>
      </div>

      <div className="space-y-8 text-sm leading-relaxed">

        {/* 제1조 */}
        <section>
          <h2 className="font-bold text-base mb-2">제1조 (개인정보의 처리 목적)</h2>
          <p className="mb-2">{COMPANY_NAME}(이하 "회사")는 다음의 목적으로 개인정보를 처리합니다.</p>
          <ul className="list-disc pl-5 space-y-1 text-[#3D3530]">
            <li>회원 가입 및 본인 확인</li>
            <li>서비스 제공 (발음 연습 기록 저장, AI 분석 결과 제공)</li>
            <li>구독 결제 및 환불 처리</li>
            <li>서비스 개선을 위한 통계 분석 (개인 식별 불가능한 집계 데이터)</li>
            <li>공지사항 및 고객 지원 안내</li>
          </ul>
          <p className="mt-2 text-[#8B7E74]">수집된 개인정보는 위 목적 외의 용도로 사용되지 않습니다.</p>
        </section>

        {/* 제2조 */}
        <section>
          <h2 className="font-bold text-base mb-2">제2조 (수집하는 개인정보 항목)</h2>

          <div className="space-y-3">
            <div className="bg-[#F5F5F5] rounded-xl px-4 py-3">
              <p className="font-semibold mb-1">회원 정보 (필수)</p>
              <ul className="list-disc pl-4 space-y-1 text-[#8B7E74]">
                <li>이메일 주소 (소셜 로그인 시 OAuth 제공 정보)</li>
                <li>프로필 이름 (선택 사항)</li>
              </ul>
            </div>

            <div className="bg-[#F5F5F5] rounded-xl px-4 py-3">
              <p className="font-semibold mb-1">서비스 이용 정보 (서비스 사용 시 자동 생성)</p>
              <ul className="list-disc pl-4 space-y-1 text-[#8B7E74]">
                <li>아이 닉네임 (실명 입력 불필요, 보호자가 임의 설정)</li>
                <li>아이 생년월일 (선택 — 연령별 맞춤 분석에 사용)</li>
                <li>아이 프로필 사진 (선택 — 앱 내 표시 용도로만 사용)</li>
                <li>발음 연습 기록 (목표 단어, 부모가 입력한 아이 발음 텍스트)</li>
                <li>AI 분석 결과 (오류 패턴, 훈련 제안)</li>
                <li>연습 세션 기록 (날짜, 횟수)</li>
              </ul>
            </div>

            <div className="bg-[#F5F5F5] rounded-xl px-4 py-3">
              <p className="font-semibold mb-1">결제 정보 (유료 구독 시)</p>
              <ul className="list-disc pl-4 space-y-1 text-[#8B7E74]">
                <li>결제 수단 정보는 PG사(토스페이먼츠)가 직접 처리하며, 회사는 저장하지 않습니다.</li>
                <li>회사는 구독 상태 및 결제 완료 여부만 저장합니다.</li>
              </ul>
            </div>

            <div className="bg-[#F5F5F5] rounded-xl px-4 py-3">
              <p className="font-semibold mb-1">자동 수집 정보</p>
              <ul className="list-disc pl-4 space-y-1 text-[#8B7E74]">
                <li>접속 로그 (IP 주소, 브라우저 종류, 접속 시간)</li>
                <li>서비스 이용 통계 (익명화된 사용 패턴)</li>
              </ul>
            </div>
          </div>
        </section>

        {/* 제3조 */}
        <section>
          <h2 className="font-bold text-base mb-2">제3조 (아동 개인정보 보호)</h2>
          <ol className="list-decimal pl-5 space-y-2">
            <li>
              서비스는 만 14세 미만 아동을 직접 회원으로 가입시키지 않습니다.
              아동의 연습 기록은 <strong>보호자 계정에 종속</strong>되어 관리됩니다.
            </li>
            <li>
              아동 관련 정보(닉네임·생년월일·사진·발음 기록)는 <strong>법정대리인인 보호자가 직접 입력</strong>하며,
              입력 행위로써 해당 아동 정보의 수집·이용에 대한 <strong>법정대리인의 동의</strong>가 이루어진 것으로 봅니다.
              보호자는 언제든지 아동 정보를 수정·삭제할 수 있습니다 (제7조).
            </li>
            <li>
              아이의 실명, 주민등록번호, 학교명 등 민감한 개인정보는 수집하지 않습니다.
              아이 프로필은 보호자가 설정한 <strong>닉네임</strong>으로만 관리됩니다.
            </li>
            <li>
              발음 연습 시 입력하는 텍스트 데이터는 아이의 발음을 보호자가 <strong>문자로 입력</strong>하는 방식이며,
              음성 녹음은 수집하지 않습니다.
            </li>
          </ol>
        </section>

        {/* 제4조 */}
        <section>
          <h2 className="font-bold text-base mb-2">제4조 (개인정보의 보유 및 이용 기간)</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-[#F0E8E0]">
                  <th className="text-left px-3 py-2 rounded-tl-lg">항목</th>
                  <th className="text-left px-3 py-2">보유 기간</th>
                  <th className="text-left px-3 py-2 rounded-tr-lg">근거</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0E8E0]">
                <tr>
                  <td className="px-3 py-2">회원 정보</td>
                  <td className="px-3 py-2">탈퇴 후 30일</td>
                  <td className="px-3 py-2">개인정보 보호법</td>
                </tr>
                <tr>
                  <td className="px-3 py-2">연습 기록</td>
                  <td className="px-3 py-2">탈퇴 후 30일</td>
                  <td className="px-3 py-2">개인정보 보호법</td>
                </tr>
                <tr>
                  <td className="px-3 py-2">결제 기록</td>
                  <td className="px-3 py-2">5년</td>
                  <td className="px-3 py-2">전자상거래법</td>
                </tr>
                <tr>
                  <td className="px-3 py-2">접속 로그</td>
                  <td className="px-3 py-2">3개월</td>
                  <td className="px-3 py-2">통신비밀보호법</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* 제5조 */}
        <section>
          <h2 className="font-bold text-base mb-2">제5조 (개인정보의 제3자 제공)</h2>
          <p className="mb-2">회사는 원칙적으로 이용자의 개인정보를 제3자에게 제공하지 않습니다. 다만 아래의 경우는 예외입니다.</p>
          <ul className="list-disc pl-5 space-y-1 text-[#8B7E74]">
            <li>이용자가 사전에 동의한 경우</li>
            <li>법령에 의해 수사기관의 요청이 있는 경우</li>
          </ul>
        </section>

        {/* 제6조 */}
        <section>
          <h2 className="font-bold text-base mb-2">제6조 (개인정보 처리 위탁)</h2>
          <p className="mb-2">회사는 서비스 운영을 위해 아래와 같이 개인정보 처리를 위탁합니다.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-[#F0E8E0]">
                  <th className="text-left px-3 py-2 rounded-tl-lg">수탁자</th>
                  <th className="text-left px-3 py-2 rounded-tr-lg">위탁 업무</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0E8E0]">
                <tr>
                  <td className="px-3 py-2">Google (Firebase Auth / OAuth)</td>
                  <td className="px-3 py-2">소셜 로그인 인증</td>
                </tr>
                <tr>
                  <td className="px-3 py-2">토스페이먼츠</td>
                  <td className="px-3 py-2">결제 처리</td>
                </tr>
                <tr>
                  <td className="px-3 py-2">Google (Gemini API)</td>
                  <td className="px-3 py-2">AI 발음 분석 (아래 국외 이전 항목 참조)</td>
                </tr>
                <tr>
                  <td className="px-3 py-2">Vercel / 클라우드 인프라</td>
                  <td className="px-3 py-2">서버 호스팅 및 데이터 저장</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="font-semibold mt-4 mb-2">개인정보의 국외 이전</p>
          <p className="mb-2 text-[#8B7E74]">
            AI 발음 분석을 위해 아래와 같이 일부 데이터가 국외로 이전·처리됩니다.
          </p>
          <div className="bg-[#F5F5F5] rounded-xl px-4 py-3 text-[#8B7E74] space-y-1 text-xs">
            <p><span className="font-semibold text-[#3D3530]">이전받는 자:</span> Google LLC (Gemini API)</p>
            <p><span className="font-semibold text-[#3D3530]">이전 국가:</span> 미국</p>
            <p><span className="font-semibold text-[#3D3530]">이전 항목:</span> 목표 단어, 보호자가 입력한 아이 발음 텍스트, 오류 유형, 아이 연령(생년월일에서 산출한 나이 — 생년월일 자체는 전송하지 않음)</p>
            <p><span className="font-semibold text-[#3D3530]">이전 시기·방법:</span> AI 분석 요청 시 암호화(TLS) 네트워크 전송</p>
            <p><span className="font-semibold text-[#3D3530]">이용 목적:</span> 발음 오류 분석 및 맞춤 훈련법 생성</p>
            <p><span className="font-semibold text-[#3D3530]">보유 기간:</span> Google은 API 정책상 분석 처리 목적 외 저장하지 않으며, 자세한 내용은 Google 개인정보처리방침을 따릅니다.</p>
          </div>
          <p className="mt-2 text-[#8B7E74]">
            이름·연락처·사진 등 직접 식별 정보는 국외로 전송되지 않습니다.
            이용자는 국외 이전을 거부할 수 있으나, 이 경우 AI 분석 기능 이용이 제한됩니다.
          </p>
        </section>

        {/* 제7조 */}
        <section>
          <h2 className="font-bold text-base mb-2">제7조 (이용자의 권리)</h2>
          <p className="mb-2">이용자(보호자)는 언제든지 다음의 권리를 행사할 수 있습니다.</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>열람 요청:</strong> 수집된 개인정보 확인</li>
            <li><strong>정정·삭제 요청:</strong> 잘못된 정보의 수정 또는 삭제</li>
            <li><strong>처리 정지 요청:</strong> 개인정보 사용 중단</li>
            <li><strong>탈퇴:</strong> 앱 내 설정 → 회원 탈퇴 메뉴 이용</li>
          </ul>
          <p className="mt-2 text-[#8B7E74]">
            권리 행사는 {CONTACT_EMAIL}로 요청하시면 10영업일 이내 처리합니다.
          </p>
        </section>

        {/* 제8조 */}
        <section>
          <h2 className="font-bold text-base mb-2">제8조 (개인정보 보호를 위한 기술적 조치)</h2>
          <ul className="list-disc pl-5 space-y-1 text-[#8B7E74]">
            <li>데이터 전송 시 HTTPS(TLS) 암호화 적용</li>
            <li>데이터베이스 접근 권한 최소화 및 접근 로그 관리</li>
            <li>이메일 가입 시 비밀번호는 단방향 암호화(bcrypt)하여 저장하며, 원문은 복원할 수 없음</li>
            <li>개인정보 처리 시스템에 대한 접근 통제</li>
          </ul>
        </section>

        {/* 제9조 */}
        <section>
          <h2 className="font-bold text-base mb-2">제9조 (쿠키 및 분석 도구)</h2>
          <ol className="list-decimal pl-5 space-y-2">
            <li>서비스는 로그인 상태 유지를 위한 세션 쿠키를 사용합니다.</li>
            <li>서비스 개선을 위한 통계 데이터 수집 시 개인 식별이 불가능한 집계 형태로만 처리합니다.</li>
            <li>브라우저 설정을 통해 쿠키 수집을 거부할 수 있으나, 일부 서비스 기능이 제한될 수 있습니다.</li>
          </ol>
        </section>

        {/* 제10조 */}
        <section>
          <h2 className="font-bold text-base mb-2">제10조 (개인정보 보호책임자)</h2>
          <div className="bg-[#F5F5F5] rounded-xl px-4 py-3 text-[#8B7E74]">
            <p><span className="font-semibold text-[#3D3530]">개인정보 보호책임자:</span> {CEO_NAME} ({COMPANY_NAME} 대표)</p>
            <p><span className="font-semibold text-[#3D3530]">이메일:</span>{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="underline">{CONTACT_EMAIL}</a>
            </p>
            <p className="mt-1 text-xs">
              개인정보 침해 관련 신고는 개인정보보호위원회(privacy.go.kr) 또는
              한국인터넷진흥원(118)에 문의하실 수 있습니다.
            </p>
          </div>
        </section>

        {/* 사업자 정보 (전자상거래법 제10조 필수 표시 사항) */}
        <section>
          <h2 className="font-bold text-base mb-2">사업자 정보</h2>
          <div className="bg-[#F5F5F5] rounded-xl px-4 py-3 text-xs text-[#8B7E74] leading-relaxed">
            <p>상호: {COMPANY_NAME} (서비스명: {SERVICE_NAME})</p>
            <p>대표자: {CEO_NAME}</p>
            <p>사업자등록번호: {BIZ_REG_NUMBER}</p>
            <p>사업장 소재지: {BIZ_ADDRESS}</p>
          </div>
        </section>

        {/* 제11조 */}
        <section>
          <h2 className="font-bold text-base mb-2">제11조 (방침 변경 공지)</h2>
          <p>
            본 방침이 변경될 경우 시행일 7일 전 서비스 내 공지사항 또는 이메일로 안내합니다.
            중요한 변경(수집 항목, 제3자 제공 등)은 30일 전 사전 고지합니다.
          </p>
        </section>

      </div>

      {/* 하단 링크 */}
      <div className="mt-10 pt-6 border-t border-[#F0E8E0] flex gap-4 text-xs text-[#8B7E74]">
        <Link href="/terms" className="hover:underline">이용약관</Link>
        <Link href="/" className="hover:underline">홈으로</Link>
      </div>
    </div>
  );
}
