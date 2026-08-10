import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/admin-auth";

/**
 * 일회용 마이그레이션 — Subscription.playPurchaseToken 컬럼 추가.
 * 여러 번 실행해도 안전. 실행 후 이 엔드포인트는 삭제할 것 (CLAUDE.md 규칙).
 */
async function runMigration() {
  const session = await auth();
  if (!isAdmin(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const cols = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'Subscription'
    `;
    const names = new Set(cols.map((c) => c.column_name));

    if (!names.has("playPurchaseToken")) {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "Subscription" ADD COLUMN "playPurchaseToken" TEXT;`,
      );
      await prisma.$executeRawUnsafe(
        `CREATE UNIQUE INDEX IF NOT EXISTS "Subscription_playPurchaseToken_key" ON "Subscription"("playPurchaseToken");`,
      );
      return NextResponse.json({ ok: true, step: "added playPurchaseToken" });
    }

    return NextResponse.json({ ok: true, step: "already present" });
  } catch (error) {
    console.error("[migrate-play-billing]", error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function POST() {
  return runMigration();
}

export async function GET() {
  return runMigration();
}
