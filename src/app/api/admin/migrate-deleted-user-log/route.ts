import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/admin-auth";

/**
 * 일회용 마이그레이션 — DeletedUserLog 테이블 생성.
 * 실행 후 이 엔드포인트는 삭제할 것 (CLAUDE.md 규칙).
 */
export async function POST() {
  const session = await auth();
  if (!isAdmin(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "DeletedUserLog" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "originalId" TEXT NOT NULL,
        "email" TEXT NOT NULL,
        "name" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL,
        "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "DeletedUserLog_deletedAt_idx" ON "DeletedUserLog"("deletedAt");
    `);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[migrate-deleted-user-log]", error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
