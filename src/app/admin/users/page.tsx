import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

/**
 * 관리자 회원 목록/검색 — 사용자 문의 대응용.
 * 접근 제어는 admin/layout.tsx의 isAdmin 게이트가 담당.
 */
const PAGE_SIZE = 50;

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const page = Math.max(1, Number(sp.page ?? "1") || 1);

  const where: Prisma.UserWhereInput = q
    ? {
        OR: [
          { email: { contains: q, mode: "insensitive" } },
          { name: { contains: q, mode: "insensitive" } },
        ],
      }
    : {};

  // eslint-disable-next-line react-hooks/purity -- 서버 컴포넌트는 요청당 1회 렌더 — 체험 만료 비교 기준 시각
  const nowMs = Date.now();

  const [users, total, deletedUsers, deletedTotal] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        trialEndsAt: true,
        subscription: { select: { plan: true, status: true } },
        _count: { select: { children: true } },
        practiceHistory: {
          orderBy: { startedAt: "desc" },
          take: 1,
          select: { startedAt: true },
        },
      },
    }),
    prisma.user.count({ where }),
    // 탈퇴 회원 — User는 탈퇴 시 하드 삭제되므로 별도 로그 테이블에서 조회 (검색 없이 최근 100건)
    q
      ? []
      : prisma.deletedUserLog.findMany({
          orderBy: { deletedAt: "desc" },
          take: 100,
        }),
    q ? 0 : prisma.deletedUserLog.count(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const fmtDate = (d: Date | null | undefined) =>
    d
      ? new Date(d).toLocaleDateString("ko-KR", {
          timeZone: "Asia/Seoul",
          year: "2-digit",
          month: "2-digit",
          day: "2-digit",
        })
      : "—";

  const planLabel = (u: (typeof users)[number]) => {
    if (u.subscription?.status === "active" && u.subscription.plan === "premium")
      return { label: "프리미엄", color: "#0D9488", bg: "#F0FAF8" };
    if (u.trialEndsAt && u.trialEndsAt.getTime() > nowMs)
      return { label: "체험 중", color: "#8B7EFF", bg: "#F5F3FF" };
    return { label: "무료", color: "#8B7E74", bg: "#F5F0EB" };
  };

  return (
    <div className="px-4 pt-6 pb-16 max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-[#3D3530]">👥 회원 관리</h1>
          <p className="text-xs text-[#C4B5A8] mt-0.5">
            총 {total.toLocaleString()}명{q && ` · "${q}" 검색 결과`} · {page}/{totalPages}페이지
          </p>
        </div>

        {/* 검색 (GET 폼 — 서버 컴포넌트만으로 동작) */}
        <form method="GET" className="flex gap-2">
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="이메일 또는 이름 검색"
            className="px-4 py-2 rounded-2xl border-2 border-[#F0E8E0] text-sm bg-white/85 focus:outline-none focus:border-[#FFB38A] w-56"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-2xl text-sm font-bold bg-[#FFB38A] text-white hover:bg-[#FF9A6C] transition-colors"
          >
            검색
          </button>
        </form>
      </div>

      <div
        className="rounded-3xl border-2 border-[#F0E8E0] overflow-x-auto"
        style={{ background: "rgba(255,255,255,0.85)" }}
      >
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="border-b border-[#F0E8E0]">
              <th className="text-left py-3 px-4 text-xs font-bold text-[#8B7E74]">이메일</th>
              <th className="text-left py-3 px-2 text-xs font-bold text-[#8B7E74]">이름</th>
              <th className="text-left py-3 px-2 text-xs font-bold text-[#8B7E74]">플랜</th>
              <th className="text-center py-3 px-2 text-xs font-bold text-[#8B7E74]">아이</th>
              <th className="text-left py-3 px-2 text-xs font-bold text-[#8B7E74]">가입일</th>
              <th className="text-left py-3 px-4 text-xs font-bold text-[#8B7E74]">마지막 연습</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="py-10 text-center text-xs text-[#C4B5A8]">
                  {q ? "검색 결과가 없어요" : "회원이 없어요"}
                </td>
              </tr>
            )}
            {users.map((u) => {
              const plan = planLabel(u);
              return (
                <tr key={u.id} className="border-b border-[#F5F0EB] hover:bg-[#FDFAF7]">
                  <td className="py-2.5 px-4 font-semibold text-[#3D3530]">
                    {u.email}
                    {u.email.endsWith("@test.com") && (
                      <span className="ml-1.5 text-[10px] text-[#C4B5A8] font-bold">DEV</span>
                    )}
                  </td>
                  <td className="py-2.5 px-2 text-[#8B7E74]">{u.name ?? "—"}</td>
                  <td className="py-2.5 px-2">
                    <span
                      className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                      style={{ color: plan.color, backgroundColor: plan.bg }}
                    >
                      {plan.label}
                    </span>
                    {u.role === "therapist" && (
                      <span className="ml-1 text-[10px] text-[#8B7EFF] font-bold">치료사</span>
                    )}
                  </td>
                  <td className="py-2.5 px-2 text-center text-[#3D3530] font-bold">
                    {u._count.children}
                  </td>
                  <td className="py-2.5 px-2 text-[#8B7E74]">{fmtDate(u.createdAt)}</td>
                  <td className="py-2.5 px-4 text-[#8B7E74]">
                    {fmtDate(u.practiceHistory[0]?.startedAt)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 text-sm">
          <PageLink page={page - 1} q={q} disabled={page <= 1}>← 이전</PageLink>
          <span className="text-[#8B7E74] font-semibold px-2">{page} / {totalPages}</span>
          <PageLink page={page + 1} q={q} disabled={page >= totalPages}>다음 →</PageLink>
        </div>
      )}

      {/* 탈퇴 회원 로그 — User는 탈퇴 시 하드 삭제되므로, 탈퇴 시점에 남긴 스냅샷만 표시.
          (이 기능 추가 이전에 탈퇴한 회원은 데이터가 남아있지 않아 조회 불가) */}
      {!q && (
        <div className="pt-2">
          <h2 className="text-base font-black text-[#3D3530] mb-1">🚪 탈퇴 회원</h2>
          <p className="text-xs text-[#C4B5A8] mb-3">
            총 {deletedTotal.toLocaleString()}명 · 최근 탈퇴순 최대 100명 표시 · 탈퇴 시 계정 정보는 삭제되며 아래는 탈퇴 시점 스냅샷입니다
          </p>
          <div
            className="rounded-3xl border-2 border-[#F0E8E0] overflow-x-auto"
            style={{ background: "rgba(255,255,255,0.85)" }}
          >
            <table className="w-full text-sm min-w-[480px]">
              <thead>
                <tr className="border-b border-[#F0E8E0]">
                  <th className="text-left py-3 px-4 text-xs font-bold text-[#8B7E74]">이메일</th>
                  <th className="text-left py-3 px-2 text-xs font-bold text-[#8B7E74]">이름</th>
                  <th className="text-left py-3 px-2 text-xs font-bold text-[#8B7E74]">가입일</th>
                  <th className="text-left py-3 px-4 text-xs font-bold text-[#8B7E74]">탈퇴일</th>
                </tr>
              </thead>
              <tbody>
                {deletedUsers.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-10 text-center text-xs text-[#C4B5A8]">
                      탈퇴한 회원이 없어요
                    </td>
                  </tr>
                )}
                {deletedUsers.map((u) => (
                  <tr key={u.id} className="border-b border-[#F5F0EB] hover:bg-[#FDFAF7]">
                    <td className="py-2.5 px-4 font-semibold text-[#3D3530]">{u.email}</td>
                    <td className="py-2.5 px-2 text-[#8B7E74]">{u.name ?? "—"}</td>
                    <td className="py-2.5 px-2 text-[#8B7E74]">{fmtDate(u.createdAt)}</td>
                    <td className="py-2.5 px-4 text-[#8B7E74]">{fmtDate(u.deletedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function PageLink({
  page,
  q,
  disabled,
  children,
}: {
  page: number;
  q: string;
  disabled: boolean;
  children: ReactNode;
}) {
  if (disabled) {
    return (
      <span className="px-3 py-1.5 rounded-xl text-[#C4B5A8] font-semibold cursor-not-allowed">
        {children}
      </span>
    );
  }
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  params.set("page", String(page));
  return (
    <a
      href={`/admin/users?${params.toString()}`}
      className="px-3 py-1.5 rounded-xl text-[#3D3530] font-semibold hover:bg-[#FFF5EE] transition-colors"
    >
      {children}
    </a>
  );
}
