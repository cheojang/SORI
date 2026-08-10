import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Kakao from "next-auth/providers/kakao";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "./prisma";
import bcrypt from "bcryptjs";

// dev 로그인 provider — 비밀번호 없이 임의 이메일로 로그인시키는 개발 전용 통로.
//
// 🚨 프로덕션에서는 환경변수와 무관하게 provider 자체를 등록하지 않는다.
//    예전엔 ALLOW_DEV_LOGIN 런타임 체크에만 의존했는데, 프로덕션에 이 값이 1로
//    켜진 채 배포되어 "아무 이메일로 비밀번호 없이 로그인 + 프리미엄 자동 부여"가
//    가능한 상태였다(관리자 이메일로도 로그인 가능). 환경변수 실수 한 번이 곧
//    전체 계정 탈취로 이어지므로, 배포 환경 자체를 신뢰 경계로 삼는다.
const isProductionDeploy =
  process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";

const devProvider = isProductionDeploy
  ? []
  : [
        Credentials({
          id: "dev",
          name: "개발자 로그인",
          credentials: { email: { label: "Email", type: "text" } },
          async authorize(credentials) {
            // 런타임 게이트: ALLOW_DEV_LOGIN=1 일 때만 동작 (2중 방어)
            if (process.env.ALLOW_DEV_LOGIN !== "1") {
              throw new Error("개발 로그인이 비활성화되어 있어요 (ALLOW_DEV_LOGIN).");
            }
            const email = (credentials?.email as string) ?? "dev@test.com";

            // 역할 결정: User.role = "parent" | "therapist"
            //           admin@test.com은 therapist + Therapist.role=owner 로 처리
            let userRole: "parent" | "therapist" = "parent";
            let therapistRole: "owner" | "staff" | null = null;
            let name = "개발자(부모)";
            let skipPremium = false;
            if (email === "free@test.com") {
              name = "개발자(무료)"; skipPremium = true;
            }
            if (email === "center@test.com") {
              userRole = "therapist"; therapistRole = "owner"; name = "개발자(센터장)";
            }
            // 하위 호환 — 기존 dev 이메일도 유지
            if (email === "therapist@test.com") {
              userRole = "therapist"; therapistRole = "staff"; name = "개발자(상담사)";
            }
            if (email === "admin@test.com") {
              userRole = "therapist"; therapistRole = "owner"; name = "개발자(상담소장)";
            }

            // ── 핵심 경로: 유저 조회/생성 (실패 시에만 로그인 차단) ──────────────────
            let user;
            try {
              user = await prisma.user.findUnique({ where: { email } });
              if (!user) {
                user = await prisma.user.create({ data: { email, name, role: userRole } });
              }
            } catch (e) {
              // 진짜 DB 오류(콜드스타트 등) — null 반환 시 CredentialsSignin으로 로그인 페이지 복귀
              console.error("[dev-auth] 유저 조회/생성 실패:", e instanceof Error ? e.message : e);
              return null;
            }

            // ── 부가 작업(best-effort): 실패해도 로그인은 진행 ─────────────────────────
            // (therapist 프로필 / 프리미엄 / 약관 동의 자동 기록 — 어느 하나 실패해도
            //  로그인 자체를 막지 않도록 별도 try/catch로 격리)
            try {
              if (therapistRole) {
                const existing = await prisma.therapist.findUnique({ where: { userId: user.id } });
                if (!existing) {
                  let devCenter = await prisma.center.findFirst({ where: { name: "[개발용] 테스트 센터" } });
                  if (!devCenter) {
                    devCenter = await prisma.center.create({
                      data: { name: "[개발용] 테스트 센터", inviteCode: "DEVTEST" },
                    });
                  }
                  await prisma.therapist.create({
                    data: { userId: user.id, centerId: devCenter.id, name, role: therapistRole },
                  });
                  await prisma.user.update({ where: { id: user.id }, data: { role: userRole } });
                }
              }

              const now = new Date();
              const subscriptionOps = skipPremium ? [] : [
                prisma.subscription.upsert({
                  where: { userId: user.id },
                  create: { userId: user.id, plan: "premium", status: "active" },
                  update: { plan: "premium", status: "active" },
                }),
              ];
              await Promise.allSettled([
                ...subscriptionOps,
                prisma.userConsent.upsert({
                  where: { userId: user.id },
                  create: { userId: user.id, termsAgreedAt: now, privacyAgreedAt: now },
                  update: {},
                }),
              ]);
            } catch (e) {
              console.warn("[dev-auth] 부가 설정 실패(로그인은 계속):", e instanceof Error ? e.message : e);
            }

            return { id: user.id, email: user.email, name: user.name };
          },
        }),
      ];

// ── 비회원 (게스트) 로그인 ──────────────────────────────────────────────────────
const guestProvider = Credentials({
  id: "guest",
  name: "비회원",
  credentials: {},
  async authorize() {
    // 세션마다 고유 UUID — 고정 "guest" ID 공유 시 데이터 섞임 방지
    const { randomUUID } = await import("crypto");
    return { id: `guest:${randomUUID()}`, email: "guest@temp", name: "비회원" };
  },
});

// ── 이메일/비밀번호 로그인 ──────────────────────────────────────────────────────
const credentialsProvider = Credentials({
  id: "credentials",
  name: "이메일 로그인",
  credentials: {
    email: { label: "이메일", type: "email" },
    password: { label: "비밀번호", type: "password" },
  },
  async authorize(credentials) {
    const email = (credentials?.email as string)?.trim().toLowerCase();
    const password = credentials?.password as string;
    if (!email || !password) return null;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user?.password) return null;

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return null;

    return { id: user.id, email: user.email, name: user.name };
  },
});

// ── DB 콜드스타트 재시도 ────────────────────────────────────────────────────────
// 카카오/구글 OAuth 콜백은 어댑터 DB 호출(getUserByAccount → createUser → linkAccount)이
// 연쇄로 일어나는데, Supabase가 유휴 상태면 첫 연결이 타임아웃돼 "첫 로그인만 실패,
// 두 번째 성공" 증상이 났다. 연결 계열 오류에 한해 짧은 백오프로 재시도해 콜드스타트를
// 실패가 아닌 지연으로 흡수한다.
function isTransientDbError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  // "Can't reach database server"(P1001)가 Supabase 콜드스타트의 대표 에러 —
  // 이걸 놓치면 재시도가 발동하지 않아 첫 로그인이 그대로 실패한다.
  return /timeout|timed out|ECONNRESET|ECONNREFUSED|ETIMEDOUT|ENETUNREACH|EAI_AGAIN|Can't reach database|P1001|P1002|P2024|connection pool|Connection terminated|Closed|too many clients|starting up/i.test(msg);
}

async function withDbRetry<T>(label: string, fn: () => Promise<T>, retries = 2): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (attempt >= retries || !isTransientDbError(e)) throw e;
      const wait = 700 * (attempt + 1);
      console.warn(`[auth] ${label} 일시적 DB 오류 — ${wait}ms 후 재시도 (${attempt + 1}/${retries}):`, e instanceof Error ? e.message : e);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
}

// 표준 PrismaAdapter를 쓰되, 과거 실패한 OAuth 로그인이 남긴 "잘못된 Account 행"
// 때문에 OAuthAccountNotLinked가 발생하던 문제를 어댑터 레벨에서 자동 치유한다.
// (getUserByAccount/getUserByEmail은 표준 동작 유지 — 그래야 이미 연결된 사용자가
//  매번 신규가입(isNewUser) 취급되지 않고 바로 로그인된다.)
// 이메일 매칭 자동연결은 각 provider의 allowDangerousEmailAccountLinking으로 처리.
const baseAdapter = PrismaAdapter(prisma);
const accountLinkingAdapter = {
  ...baseAdapter,
  // OAuth 콜백의 핵심 조회 — 콜드스타트 시 재시도 (첫 로그인 실패의 주범)
  // (Adapter 메서드는 Awaitable 반환이라 Promise.resolve로 감싸 재시도 헬퍼와 맞춘다)
  getUserByAccount: async (providerAccountId: { provider: string; providerAccountId: string }) =>
    withDbRetry("getUserByAccount", () => Promise.resolve(baseAdapter.getUserByAccount!(providerAccountId))),
  getUserByEmail: async (email: string) =>
    withDbRetry("getUserByEmail", () => Promise.resolve(baseAdapter.getUserByEmail!(email))),
  // ⭐ 로그인 페이지에서 구글/카카오 클릭은 "기존 세션에 계정 연결"이 아니라
  //   "그 OAuth 신원으로 로그인"이어야 한다. JWT 모드에서 adapter.getUser는 오직
  //   sign-in 시 기존 sessionToken의 유저를 채우는 데만 쓰이므로, null로 만들면
  //   handle-login이 OAuth 로그인을 항상 "비로그인 상태의 새 로그인"으로 처리해
  //   'The account is already associated with another user' 충돌이 사라진다.
  //   (개발용 로그인 등으로 남아 있던 세션 쿠키가 있어도 안전하게 OAuth 로그인 가능)
  getUser: async (_id: string) => null,
  // 같은 이메일 유저가 이미 있으면 재사용(중복 생성 방지). id는 DB가 생성하도록 제거.
  createUser: async ({ id: _id, ...data }: { id?: string; email?: string | null; name?: string | null; image?: string | null; emailVerified?: Date | null }) =>
    withDbRetry("createUser", async () => {
      // ⭐ 카카오는 이메일 제공 동의항목이 없으면 email이 비어서 온다 (User.email은 필수 컬럼).
      //   이 상태로 findUnique/create에 넘기면 Prisma가 throw → 신규 카카오 로그인이 매번 실패.
      //   자리표시 이메일을 만들어 가입시킨다 — 이후 로그인은 Account(provider ID)로 식별되므로
      //   이메일 값 자체는 로그인 동작에 영향 없다.
      const email =
        data.email && data.email.trim().length > 0
          ? data.email
          : `no-email-${crypto.randomUUID()}@oauth.local`;
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) return existing;
      return prisma.user.create({ data: { ...data, email } });
    }),
  // create 대신 upsert → 기존에 다른 userId로 박혀 있던 Account 행을 올바르게 덮어써
  // PK 충돌(=OAuthAccountNotLinked의 원인)를 자동 해소한다.
  // Kakao 등 OAuth 제공자가 refresh_token_expires_in 같은 비표준 필드를 추가로 보낼 수 있는데,
  // Prisma 스키마에 없는 필드를 그대로 넘기면 "Unknown field" 에러 → Configuration 에러 발생.
  // 따라서 Prisma Account 스키마에 존재하는 칼럼만 명시적으로 추출한다.
  linkAccount: async (account: {
    userId: string;
    type: string;
    provider: string;
    providerAccountId: string;
    [key: string]: unknown;
  }) => {
    const { provider, providerAccountId, userId, type } = account;

    // Prisma Account 스키마 칼럼만 추출 (비표준 OAuth 필드 제거)
    const knownData = {
      userId,
      provider,
      providerAccountId,
      type,
      access_token: (account.access_token as string | null | undefined) ?? null,
      refresh_token: (account.refresh_token as string | null | undefined) ?? null,
      expires_at: (account.expires_at as number | null | undefined) ?? null,
      token_type: (account.token_type as string | null | undefined) ?? null,
      scope: (account.scope as string | null | undefined) ?? null,
      id_token: (account.id_token as string | null | undefined) ?? null,
      session_state: (account.session_state as string | null | undefined) ?? null,
    };

    await withDbRetry("linkAccount", () =>
      prisma.account.upsert({
        where: { provider_providerAccountId: { provider, providerAccountId } },
        create: knownData,
        update: {
          userId,
          access_token: knownData.access_token,
          refresh_token: knownData.refresh_token,
          expires_at: knownData.expires_at,
          token_type: knownData.token_type,
          scope: knownData.scope,
          id_token: knownData.id_token,
          session_state: knownData.session_state,
        },
      }),
    );
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: accountLinkingAdapter,
  // 로그인 실패 원인을 Vercel 함수 로그에서 바로 볼 수 있게 상세 로깅
  // (기본 로거는 에러 이름만 남겨 원인 추적이 불가능했음)
  logger: {
    error(error: Error) {
      console.error("[auth:error]", error.name, error.message, (error as { cause?: { err?: Error } }).cause?.err?.message ?? "");
    },
    warn(code) {
      console.warn("[auth:warn]", code);
    },
  },
  // 로그인 유지: JWT 세션을 90일간 보존(기본 30일에서 연장). updateAge로 활동 시
  // 만료를 슬라이딩 갱신 → 자주 쓰면 사실상 로그아웃 안 됨.
  session: {
    strategy: "jwt",
    maxAge: 90 * 24 * 60 * 60, // 90일
    updateAge: 24 * 60 * 60, // 하루 1회 만료 갱신
  },
  providers: [
    ...devProvider,
    guestProvider,
    credentialsProvider,
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      allowDangerousEmailAccountLinking: true,
    }),
    Kakao({
      clientId: process.env.KAKAO_CLIENT_ID ?? "",
      clientSecret: process.env.KAKAO_CLIENT_SECRET ?? "",
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) token.id = user.id;
      const userId = token.id as string | undefined;
      // role을 JWT에 캐시 — 매 요청마다 DB 조회하던 것을 로그인 시 1회로 줄임
      // (role 변경 시 session.update() 호출 또는 재로그인으로 갱신)
      if (userId && (token.role === undefined || trigger === "update")) {
        if (userId.startsWith("guest:")) {
          token.role = "parent";
        } else {
          try {
            const dbUser = await prisma.user.findUnique({
              where: { id: userId },
              select: { role: true },
            });
            token.role = dbUser?.role ?? "parent";
          } catch (e) {
            // 콜드스타트/일시적 DB 오류가 jwt 콜백을 throw시켜 로그인 전체를 실패시키지
            // 않도록 격리. role은 설정하지 않아 다음 요청에서 자동 재조회된다.
            console.warn(
              "[auth] jwt role 조회 실패(다음 요청에서 재시도):",
              e instanceof Error ? e.message : e,
            );
          }
        }
      }
      return token;
    },
    async session({ session, user, token }) {
      const userId = user?.id ?? (token?.id as string);
      if (session.user && userId) {
        session.user.id = userId;
        session.user.isGuest = userId.startsWith("guest:");
        session.user.role = (token?.role as string) ?? "parent";
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    newUser: "/onboarding",
    error: "/login",
  },
  events: {
    // OAuth(구글/카카오) 신규 가입자에게도 7일 프리미엄 체험 부여 (이메일 가입은 signup API에서 처리)
    async createUser({ user }) {
      if (!user.id) return;
      try {
        const { computeTrialEndsAt } = await import("@/lib/usage-limit");
        await prisma.user.update({
          where: { id: user.id },
          data: { trialEndsAt: computeTrialEndsAt() },
        });
      } catch (e) {
        console.warn("[auth] 체험 부여 실패:", e instanceof Error ? e.message : e);
      }
    },
  },
});
