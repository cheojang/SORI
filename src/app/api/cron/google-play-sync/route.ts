import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSubscriptionStatus } from "@/lib/google-play";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/cron/google-play-sync — Vercel Cron이 매일 호출.
 *
 * 포트원/KCP 정기결제와 달리, 구글 플레이 구독은 우리가 청구하지 않는다 —
 * 갱신·결제 재시도·해지는 전부 구글이 알아서 처리한다. 우리가 할 일은 그 결과를
 * 주기적으로 다시 조회해서 우리 DB의 프리미엄 상태를 구글 쪽과 어긋나지 않게
 * 맞춰두는 것뿐이다(해지·환불·결제 실패가 구글 쪽에서 일어나도 우리는 모르므로).
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const subs = await prisma.subscription.findMany({
    where: {
      plan: "premium",
      playPurchaseToken: { not: null },
    },
  });

  let stillActive = 0;
  let downgraded = 0;
  let failed = 0;

  for (const sub of subs) {
    try {
      const s = await getSubscriptionStatus(sub.playPurchaseToken!);

      if (s.active) {
        // 사용자가 앱에서 해지한 구독은 만료일까지 구글 쪽에서 여전히 "active"로 보인다.
        // 여기서 status를 무조건 active로 되돌리면 해지가 취소된 것처럼 보이므로,
        // 이미 cancelled인 건은 만료일만 갱신하고 상태는 건드리지 않는다.
        await prisma.subscription.update({
          where: { id: sub.id },
          data:
            sub.status === "cancelled"
              ? { currentPeriodEnd: s.expiryTime }
              : { status: "active", currentPeriodEnd: s.expiryTime },
        });
        stillActive++;
      } else {
        // 해지/만료/결제실패 — 구글 쪽 판단을 그대로 따른다(우리가 재시도할 게 없음)
        await prisma.subscription.update({
          where: { id: sub.id },
          data: { plan: "free", status: "cancelled" },
        });
        downgraded++;
      }
    } catch (e) {
      console.error(`[cron/google-play-sync] 조회 실패 userId=${sub.userId}:`, e instanceof Error ? e.message : e);
      failed++;
    }
  }

  return NextResponse.json({ ok: true, total: subs.length, stillActive, downgraded, failed });
}
