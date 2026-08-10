import { prisma } from "@/lib/prisma";
import { createHash } from "crypto";

export const FREE_AI_MONTHLY_LIMIT = 10;
export const FREE_PRACTICE_MONTHLY_LIMIT = 10;
export const GUEST_AI_MONTHLY_LIMIT = 5;
export const GUEST_COOKIE_NAME = "ai_guest_usage";

/** 리버스 트라이얼: 가입 시 부여되는 프리미엄 체험 기간(일) */
export const TRIAL_DAYS = 7;
/** 체험 기간 중 일일 AI 분석 상한 — 어뷰징/비용 폭주 방어 (정상 사용자는 체감 못 함) */
export const TRIAL_DAILY_LIMIT = 30;

/** 가입 시각 기준 체험 종료 일시 계산 */
export function computeTrialEndsAt(from: Date = new Date()): Date {
  return new Date(from.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
}

export function getCurrentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function getMonthStart(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export function getDayStart(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/** 이번 달 실제 Gemini 호출 횟수 (캐시 히트 제외 — GeminiFeedback 생성 기준) */
export async function countMonthlyGeminiUsage(userId: string): Promise<number> {
  return prisma.geminiFeedback.count({
    where: {
      createdAt: { gte: getMonthStart() },
      errorRecord: { child: { userId } },
    },
  });
}

/** 이번 달 발음연습 세션 수 (무료 회원 월 상한 체크용) */
export async function countMonthlyPracticeUsage(userId: string): Promise<number> {
  return prisma.practiceSession.count({
    where: { userId, startedAt: { gte: getMonthStart() } },
  });
}

/** 오늘 실제 Gemini 호출 횟수 (체험 기간 일일 상한 체크용) */
export async function countDailyGeminiUsage(userId: string): Promise<number> {
  return prisma.geminiFeedback.count({
    where: {
      createdAt: { gte: getDayStart() },
      errorRecord: { child: { userId } },
    },
  });
}

/** 구독 레코드 기준 프리미엄 접근 가능 여부 (기간 내 active/cancelled) */
function subHasActivePremium(sub: {
  status: string;
  plan: string;
  currentPeriodEnd?: Date | null;
} | null): boolean {
  if (!sub || sub.plan !== "premium") return false;
  // 구독 갱신·결제 재시도는 구글 플레이가 처리하고, /api/cron/google-play-sync가
  // 그 결과를 매일 우리 DB에 반영한다.
  // active: 정상 유지 중. (만료일 없는 active는 개발/수동 부여 계정 → 무기한 유지)
  if (sub.status === "active") {
    if (!sub.currentPeriodEnd) return true;
    return sub.currentPeriodEnd.getTime() > Date.now();
  }
  // past_due: 포트원 정기결제 시절의 레거시 상태(현재는 이 값을 새로 쓰지 않는다).
  // 예전엔 billing-charge 크론이 3회 실패 후 강등해줬지만 그 크론이 사라졌으므로,
  // 여기서 무조건 true를 주면 남아 있는 past_due 행이 영구 프리미엄이 된다.
  // → 만료일 기준 그레이스(3일) 안에서만 허용한다.
  if (sub.status === "past_due") {
    if (!sub.currentPeriodEnd) return false;
    const graceMs = 3 * 24 * 60 * 60 * 1000;
    return sub.currentPeriodEnd.getTime() + graceMs > Date.now();
  }
  // cancelled: 사용자가 직접 해지 — 다음 결제는 없지만 이미 낸 기간까지는 유지.
  if (
    sub.status === "cancelled" &&
    sub.currentPeriodEnd &&
    sub.currentPeriodEnd.getTime() > Date.now()
  )
    return true;
  return false;
}

/** 유료 구독(프리미엄) 여부 — 취소 후 기간 만료 전까지도 true (체험 제외) */
export async function isUserPremium(userId: string): Promise<boolean> {
  const sub = await prisma.subscription.findUnique({
    where: { userId },
    select: { status: true, plan: true, currentPeriodEnd: true },
  });
  return subHasActivePremium(sub);
}

export type AccessLevel = "premium" | "trial" | "free";

export interface AccessInfo {
  level: AccessLevel;
  /** 체험 종료 일시 (trial일 때만 의미 있음) */
  trialEndsAt: Date | null;
  /** 체험 남은 일수 (올림, trial일 때만) */
  trialDaysLeft: number | null;
}

/**
 * 사용자의 AI 접근 등급 판정.
 * - premium: 결제 활성 → 무제한
 * - trial:   trialEndsAt 미도래 → 일일 상한(TRIAL_DAILY_LIMIT) 내 프리미엄 기능
 * - free:    그 외 → 월 FREE_AI_MONTHLY_LIMIT
 */
export async function getAccessInfo(userId: string): Promise<AccessInfo> {
  // trialEndsAt 컬럼 미생성(prisma db push 전)이어도 free로 안전 폴백
  const [sub, user] = await Promise.all([
    prisma.subscription.findUnique({
      where: { userId },
      select: { status: true, plan: true, currentPeriodEnd: true },
    }),
    prisma.user
      .findUnique({ where: { id: userId }, select: { trialEndsAt: true } })
      .catch(() => null),
  ]);

  if (subHasActivePremium(sub)) {
    return { level: "premium", trialEndsAt: null, trialDaysLeft: null };
  }

  const trialEndsAt = user?.trialEndsAt ?? null;
  if (trialEndsAt && trialEndsAt.getTime() > Date.now()) {
    const msLeft = trialEndsAt.getTime() - Date.now();
    const trialDaysLeft = Math.max(1, Math.ceil(msLeft / (24 * 60 * 60 * 1000)));
    return { level: "trial", trialEndsAt, trialDaysLeft };
  }

  return { level: "free", trialEndsAt: null, trialDaysLeft: null };
}

/** 게스트 쿠키에서 이번 달 사용 횟수 파싱 */
export function parseGuestCookie(cookieValue: string | undefined): number {
  if (!cookieValue) return 0;
  try {
    const { month, count } = JSON.parse(cookieValue);
    return month === getCurrentYearMonth() ? (Number(count) || 0) : 0;
  } catch {
    return 0;
  }
}

/** 게스트 쿠키 직렬화 */
export function makeGuestCookieValue(count: number): string {
  return JSON.stringify({ month: getCurrentYearMonth(), count });
}

/**
 * 게스트 식별용 IP 해시 — 원본 IP는 저장하지 않음 (프라이버시).
 * AUTH_SECRET을 솔트로 사용해 동일 IP가 서로 다른 배포에서 다른 해시를 갖도록 함.
 */
export function hashGuestIp(ip: string): string {
  const salt = process.env.AUTH_SECRET ?? "fallback-salt";
  return createHash("sha256").update(`${salt}::${ip}`).digest("hex").slice(0, 32);
}

/**
 * NextRequest에서 클라이언트 IP 추출.
 * Vercel/Cloudflare 프록시 헤더 우선, fallback으로 unknown.
 */
export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}

/** 서버측 게스트 사용량 조회 (DB 기반, 쿠키 우회 차단) */
export async function getGuestMonthlyUsage(ipHash: string): Promise<number> {
  const row = await prisma.guestUsage.findUnique({
    where: { ipHash_month: { ipHash, month: getCurrentYearMonth() } },
    select: { count: true },
  });
  return row?.count ?? 0;
}

/** 서버측 게스트 사용량 +1 (DB 기반, 원자적 upsert) */
export async function incrementGuestUsage(ipHash: string): Promise<number> {
  const month = getCurrentYearMonth();
  const row = await prisma.guestUsage.upsert({
    where: { ipHash_month: { ipHash, month } },
    create: { ipHash, month, count: 1 },
    update: { count: { increment: 1 } },
    select: { count: true },
  });
  return row.count;
}
