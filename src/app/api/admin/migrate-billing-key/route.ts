import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/admin-auth";

/**
 * 일회용 마이그레이션 — Subscription의 결제 관련 컬럼을 PG 중립 이름으로 정리.
 *   tossBillingKey → billingKey (데이터 보존), tossCustomerKey 제거
 * 여러 번 실행해도 안전. 실행 후 이 엔드포인트는 삭제할 것 (CLAUDE.md 규칙).
 */
async function runMigration() {
  const session = await auth();
  if (!isAdmin(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const steps: string[] = [];
  try {
    // 컬럼 존재 여부를 확인해 이미 적용된 경우 건너뛴다 (RENAME은 IF NOT EXISTS가 없음)
    const cols = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'Subscription'
    `;
    const names = new Set(cols.map((c) => c.column_name));

    if (names.has("tossBillingKey") && !names.has("billingKey")) {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "Subscription" RENAME COLUMN "tossBillingKey" TO "billingKey";`,
      );
      steps.push("renamed tossBillingKey → billingKey");
    } else if (!names.has("billingKey")) {
      await prisma.$executeRawUnsafe(`ALTER TABLE "Subscription" ADD COLUMN "billingKey" TEXT;`);
      steps.push("added billingKey");
    } else {
      steps.push("billingKey already present");
    }

    if (names.has("tossCustomerKey")) {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "Subscription" DROP COLUMN "tossCustomerKey";`,
      );
      steps.push("dropped tossCustomerKey");
    }

    return NextResponse.json({ ok: true, steps });
  } catch (error) {
    console.error("[migrate-billing-key]", error);
    return NextResponse.json({ error: (error as Error).message, steps }, { status: 500 });
  }
}

export async function POST() {
  return runMigration();
}

export async function GET() {
  return runMigration();
}
