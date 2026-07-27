import Link from "next/link";
import { BubbleButton } from "@/components/ui/BubbleButton";
import { BubbleCard } from "@/components/ui/BubbleCard";
import { SoriMascot, SoriLogo } from "@/components/ui/SoriMascot";
import { LandingPrice } from "@/components/billing/LandingPrice";

// 앱 버전 — 배포 전 수동으로 갱신
const APP_VERSION = "v1.3.0";
// 빌드(배포) 시점이 KST로 자동 기록됨. 정적 렌더 시 빌드 타임에 1회 평가.
const BUILD_TIME = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
}).format(new Date());

export default function LandingPage() {
  return (
    <main className="min-h-dvh flex flex-col bg-white">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-[#F0E8E0]/50">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2.5">
            <SoriLogo size={36} />
            <div>
              <span className="text-lg font-black text-[#3D3530] leading-none block">바른발음</span>
              <span className="text-[9px] text-[#786E60] font-semibold tracking-wide">AI 발음 홈케어</span>
            </div>
          </div>
          <Link
            href="/login"
            className="text-sm font-bold text-[#6B6157] hover:text-[#B45309] transition-colors px-2 py-1"
          >
            로그인
          </Link>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section
        className="px-6 py-16 md:py-24 text-center"
        style={{ background: "linear-gradient(180deg, #FFF5EE 0%, #FFFFFF 100%)" }}
      >
        <div className="max-w-2xl mx-auto">
          <div className="animate-float mb-8">
            <SoriMascot size={130} variant="full" animated />
          </div>
          <p className="text-sm font-bold text-[#B45309] mb-3 tracking-wider">
            우리 아이 발음, 걱정되시나요?
          </p>
          <h1 className="text-3xl md:text-5xl font-black text-[#3D3530] leading-tight mb-5">
            발음 교정은<br />
            <span className="text-[#B45309]">빠를수록</span> 효과적이에요
          </h1>
          <p className="text-base md:text-lg text-[#6B6157] mb-10 max-w-md mx-auto leading-relaxed">
            잘못된 발음은 방치할수록 굳어져요.<br />
            지금 이 순간, 손안의 앱으로 바로 교정하세요.
          </p>
          <Link href="/login">
            <BubbleButton size="lg" variant="peach" className="shadow-lg shadow-[#FFB38A]/25">
              시작하기
            </BubbleButton>
          </Link>
          <p className="text-xs text-[#786E60] mt-3">가입 30초 · 카카오/구글 로그인</p>
          <Link href="/login?guest=1" className="block mt-3 text-xs text-[#786E60] hover:text-[#6B6157] transition-colors">
            가입 없이 체험하기 →
          </Link>
        </div>
      </section>

      {/* ── 공감 (Pain Points) ─────────────────────────────────────────── */}
      <section className="px-6 py-16 bg-[#FAFAF8]">
        <div className="max-w-2xl mx-auto">
          <p className="text-center text-sm font-bold text-[#B45309] mb-2">부모님의 마음을 압니다</p>
          <h2 className="text-2xl md:text-3xl font-black text-[#3D3530] text-center mb-10">
            혹시 이런 고민 하고 계신가요?
          </h2>
          <div className="grid gap-4">
            <PainCard
              emoji="😟"
              text="아이가 '사과'를 '다과'로 말하는데, 그냥 지켜만 봐도 되는 걸까요?"
            />
            <PainCard
              emoji="💸"
              text="언어치료센터에 다니고 싶은데, 1회 6만원이면 매주 가기 부담돼요..."
            />
            <PainCard
              emoji="⏰"
              text="센터는 주 1~2회뿐인데, 나머지 5일은 어떻게 연습하죠?"
            />
            <PainCard
              emoji="🤷"
              text="틀린 발음을 그 자리에서 고쳐주고 싶은데, 방법을 모르겠어요"
            />
          </div>
        </div>
      </section>

      {/* ── 즉시 교정의 중요성 ─────────────────────────────────────────── */}
      <section className="px-6 py-16">
        <div className="max-w-2xl mx-auto">
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="flex-1">
              <p className="text-sm font-bold text-[#0F766E] mb-2">왜 즉시 교정이 중요할까요?</p>
              <h2 className="text-2xl font-black text-[#3D3530] mb-6 leading-tight">
                발음은 틀린 순간<br />바로잡아야 해요
              </h2>
              <div className="space-y-5">
                <TimelineItem
                  icon="⚡"
                  title="잘못된 발음은 빠르게 굳어져요"
                  desc="반복될수록 뇌가 틀린 패턴을 정답으로 기억해요. 조기 교정이 핵심이에요."
                />
                <TimelineItem
                  icon="🏥"
                  title="센터는 주 1~2회, 나머지 5일은?"
                  desc="센터 방문 사이 연습이 없으면 효과가 반감돼요. 매일의 꾸준한 연습이 중요해요."
                />
                <TimelineItem
                  icon="📱"
                  title="손안의 앱으로 매일 교정"
                  desc="밥 먹다가, 놀이하다가 — 틀린 발음이 들리면 바로 분석하고 올바른 연습법을 확인하세요."
                />
              </div>
            </div>
            <div className="flex-shrink-0 hidden md:block">
              <div className="w-52 h-52 rounded-3xl bg-[#FFF5EE] shadow-lg flex items-center justify-center">
                <SoriMascot size={130} variant="full" animated />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── How It Works ───────────────────────────────────────────────── */}
      <section className="px-6 py-16 bg-[#FAFAF8]">
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-sm font-bold text-[#0F766E] mb-2">사용법은 간단해요</p>
          <h2 className="text-2xl md:text-3xl font-black text-[#3D3530] mb-12">
            3단계로 끝나는 발음 교정
          </h2>
          <div className="grid gap-6 md:grid-cols-3">
            <StepCard
              step={1}
              emoji="👂"
              title="듣고 바로 입력"
              desc="아이가 말할 때 틀린 발음을 바로 입력하세요. 부모의 귀가 가장 정확해요."
            />
            <StepCard
              step={2}
              emoji="🤖"
              title="AI 즉시 분석"
              desc="한국어 음운 분석 AI가 자주 틀리는 발음만 핀셋처럼 콕 집어 맞춤 교정법을 알려드려요."
            />
            <StepCard
              step={3}
              emoji="🎮"
              title="놀이처럼 연습"
              desc="게임형 반복 연습으로 발음 자체는 물론, 같은 소리가 들어간 다른 단어까지 자연스럽게 함께 익혀요."
            />
          </div>
        </div>
      </section>

      {/* ── 비용 비교 ──────────────────────────────────────────────────── */}
      <section className="px-6 py-16">
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-sm font-bold text-[#B45309] mb-2">합리적인 비용</p>
          <h2 className="text-2xl md:text-3xl font-black text-[#3D3530] mb-10">
            센터 1회 비용으로<br /><span className="text-[#B45309]">1년간</span> 매일 연습
          </h2>

          <div className="grid md:grid-cols-2 gap-4 mb-6">
            {/* 센터 */}
            <BubbleCard className="text-center border-2 border-[#F0E8E0]">
              <p className="text-sm text-[#6B6157] mb-2">일반 언어치료센터</p>
              <p className="text-3xl font-black text-[#3D3530]">60,000원</p>
              <p className="text-xs text-[#786E60] mt-1">1회 방문 평균 비용</p>
              <div className="h-[1px] bg-[#F0E8E0] my-4" />
              <div className="space-y-2 text-left">
                <CompareItem icon="📅" text="주 1~2회 방문" muted />
                <CompareItem icon="💰" text="월 24~48만원" muted />
                <CompareItem icon="🚗" text="예약 & 이동 필요" muted />
                <CompareItem icon="⏳" text="방문일 외 연습 어려움" muted />
              </div>
            </BubbleCard>

            {/* 바른발음 */}
            <BubbleCard color="peach" className="text-center border-2 border-[#FFB38A]/30 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-[#FFB38A] text-[#5A3A1E] text-[10px] font-black px-3 py-1 rounded-full shadow-md">
                  추천
                </span>
              </div>
              <p className="text-sm text-[#6B6157] mb-2">바른발음 앱</p>
              <LandingPrice />
              <div className="h-[1px] bg-[#FFB38A]/20 my-4" />
              <div className="space-y-2 text-left">
                <CompareItem icon="✅" text="매일 무제한 연습" />
                <CompareItem icon="✅" text="1년 내내 이용해도 센터 1회 비용 수준" />
                <CompareItem icon="✅" text="언제 어디서나 즉시 분석" />
                <CompareItem icon="✅" text="자주 틀리는 발음만 핀셋처럼 콕 집는 AI 맞춤 훈련" />
              </div>
            </BubbleCard>
          </div>
        </div>
      </section>

      {/* ── 병행 효과 ──────────────────────────────────────────────────── */}
      <section className="px-6 py-16 bg-[#FAFAF8]">
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-sm font-bold text-[#0F766E] mb-2">함께하면 더 좋아요</p>
          <h2 className="text-2xl md:text-3xl font-black text-[#3D3530] mb-4">
            전문 상담과 병행하면<br />
            꾸준한 연습에 <span className="text-[#0F766E]">큰 도움</span>이 돼요
          </h2>
          <p className="text-sm text-[#6B6157] mb-10 max-w-md mx-auto leading-relaxed">
            바른발음은 전문 치료를 대체하는 것이 아니라,<br />
            센터 상담 사이의 공백을 메워 효과를 높여줘요.
          </p>

          <div className="bg-white rounded-3xl p-6 shadow-sm max-w-md mx-auto">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-[#F5F3FF] flex items-center justify-center text-2xl flex-shrink-0">🏥</div>
              <div className="text-left">
                <p className="font-bold text-[#3D3530] text-sm">센터 상담 (주 1~2회)</p>
                <p className="text-[11px] text-[#6B6157]">전문가 진단 · 치료 방향 설정</p>
              </div>
            </div>
            <div className="flex justify-center my-2">
              <span className="text-lg text-[#786E60]">+</span>
            </div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-[#F0FAF8] flex items-center justify-center text-2xl flex-shrink-0">📱</div>
              <div className="text-left">
                <p className="font-bold text-[#3D3530] text-sm">바른발음 홈케어 (매일)</p>
                <p className="text-[11px] text-[#6B6157]">배운 내용 복습 · 새 오류 즉시 교정</p>
              </div>
            </div>
            <div className="h-[1px] bg-[#F0E8E0] my-4" />
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#FFF5EE] flex items-center justify-center text-2xl flex-shrink-0">🎯</div>
              <div className="text-left">
                <p className="font-bold text-[#B45309] text-sm">꾸준한 연습 습관</p>
                <p className="text-[11px] text-[#6B6157]">매일 연습으로 배운 내용을 잊지 않게 도와줘요</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 주요 기능 ──────────────────────────────────────────────────── */}
      <section className="px-6 py-16">
        <div className="max-w-2xl mx-auto">
          <p className="text-center text-sm font-bold text-[#B45309] mb-2">주요 기능</p>
          <h2 className="text-2xl md:text-3xl font-black text-[#3D3530] text-center mb-10">
            발음 교정에 필요한<br />모든 것을 담았어요
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <FeatureCard emoji="🔍" title="AI 오류 분석" desc="한국어 음운 규칙 기반 정확한 오류 유형 분석" />
            <FeatureCard emoji="📋" title="핀셋 맞춤 훈련법" desc="자주 틀리는 발음만 콕 집어 4단계 맞춤 훈련 처방전을 자동 생성" />
            <FeatureCard emoji="📊" title="종합 리포트" desc="발음 발달 현황을 한눈에 파악" />
            <FeatureCard emoji="🔄" title="복습 스케줄" desc="과학적 간격 반복으로 효과적 기억" />
            {/* 센터 연계 서비스 — 현재 미운영. 추후 재개 시 주석 해제
            <FeatureCard emoji="🏥" title="센터 연계" desc="치료사와 기록 공유 및 숙제 관리" /> */}
          </div>
        </div>
      </section>

      {/* ── Final CTA ──────────────────────────────────────────────────── */}
      <section
        className="px-6 py-20 text-center"
        style={{ background: "linear-gradient(180deg, #FFFFFF 0%, #FFF5EE 100%)" }}
      >
        <div className="max-w-lg mx-auto">
          <SoriMascot size={100} variant="full" animated />
          <h2 className="text-2xl md:text-3xl font-black text-[#3D3530] mt-6 mb-4">
            오늘 시작하면<br />내일부터 달라져요
          </h2>
          <p className="text-sm text-[#6B6157] leading-relaxed">
            가입 즉시 무료로 사용할 수 있어요.<br />
            우리 아이 발음, 오늘 확인해보세요.
          </p>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className="text-center py-8 px-5 border-t border-[#F0E8E0] bg-white">
        <p className="text-xs text-[#786E60] mb-3 leading-relaxed">
          바른발음은 학습 보조 도구이며 의료기기가 아닙니다.
        </p>
        <div className="flex justify-center gap-4 text-xs text-[#6B6157]">
          <Link href="/terms" className="hover:underline">이용약관</Link>
          <Link href="/privacy" className="hover:underline">개인정보 처리방침</Link>
        </div>
        {/* 사업자 정보 (전자상거래법 제10조 필수 표시 사항 — PG 가맹점 심사 확인 대상) */}
        <p className="text-[10px] text-[#A89B8E] mt-4 leading-relaxed">
          상호: 티엔피 (서비스명: 바른발음) · 대표: 유태봉<br />
          사업자등록번호: 269-09-03462<br />
          주소: 경기도 성남시 분당구 미금로 184, 103동 403호(구미동, 까치마을)
        </p>

        <p className="text-xs text-[#786E60] mt-3">© 2026 바른발음</p>
        <p className="text-[10px] text-[#786E60] mt-1.5">
          {APP_VERSION} · {BUILD_TIME} 배포
        </p>
      </footer>
    </main>
  );
}

// ─── Sub-Components ──────────────────────────────────────────────────────────

function PainCard({ emoji, text }: { emoji: string; text: string }) {
  return (
    <BubbleCard className="flex items-center gap-4">
      <span className="text-2xl flex-shrink-0">{emoji}</span>
      <p className="text-sm text-[#3D3530] leading-relaxed">{text}</p>
    </BubbleCard>
  );
}

function StepCard({ step, emoji, title, desc }: { step: number; emoji: string; title: string; desc: string }) {
  return (
    <div className="text-center">
      <div className="relative inline-block mb-4">
        <div className="w-20 h-20 rounded-full bg-white shadow-md flex items-center justify-center">
          <span className="text-3xl">{emoji}</span>
        </div>
        <span className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-[#FFB38A] text-[#5A3A1E] text-xs font-black flex items-center justify-center shadow-sm">
          {step}
        </span>
      </div>
      <h3 className="font-black text-[#3D3530] mb-2">{title}</h3>
      <p className="text-sm text-[#6B6157] leading-relaxed">{desc}</p>
    </div>
  );
}

function TimelineItem({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="flex gap-3">
      <span className="text-xl flex-shrink-0 mt-0.5">{icon}</span>
      <div>
        <p className="font-bold text-[#3D3530] text-sm mb-0.5">{title}</p>
        <p className="text-xs text-[#6B6157] leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

function CompareItem({ icon, text, muted }: { icon: string; text: string; muted?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm flex-shrink-0">{icon}</span>
      <p className={`text-xs leading-relaxed ${muted ? "text-[#6B6157]" : "font-bold text-[#3D3530]"}`}>{text}</p>
    </div>
  );
}

function FeatureCard({ emoji, title, desc }: { emoji: string; title: string; desc: string }) {
  return (
    <BubbleCard padding="sm" className="text-center">
      <span className="text-2xl block mb-2">{emoji}</span>
      <h3 className="font-bold text-[#3D3530] text-sm mb-1">{title}</h3>
      <p className="text-[11px] text-[#6B6157] leading-relaxed">{desc}</p>
    </BubbleCard>
  );
}
