export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * 개발자 로그인 진단 엔드포인트 (임시).
 *
 * NextAuth는 authorize 실패 이유를 클라이언트에 "CredentialsSignin"으로만 노출하므로,
 * 실제 원인(환경변수 미설정 / DB 연결 실패 / dev 유저 부재)을 비밀 노출 없이 boolean으로 확인.
 * 🚨 프로덕션 배포에서는 환경변수와 무관하게 항상 404 — 이 응답이 개발 로그인 활성
 *    여부를 그대로 알려주므로, 공격자에게 "여기 무인증 통로가 열려 있다"는 신호가 된다.
 *    (실제로 프로덕션에 NEXT_PUBLIC_ALLOW_DEV_LOGIN·ALLOW_DEV_LOGIN이 켜진 채
 *     배포되어 이 정보가 공개돼 있었다)
 */
export async function GET() {
  const isProductionDeploy =
    process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";
  if (isProductionDeploy || process.env.NEXT_PUBLIC_ALLOW_DEV_LOGIN !== "1") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const allowDevLogin = process.env.ALLOW_DEV_LOGIN === "1";
  // 값이 "1"이 아닐 때 원인 파악용 — 길이/존재만(값 자체 노출 안 함)
  const rawSet = typeof process.env.ALLOW_DEV_LOGIN === "string";
  const rawLen = process.env.ALLOW_DEV_LOGIN?.length ?? 0;

  let dbOk = false;
  let devUserExists = false;
  let dbErrorCode: string | null = null;
  try {
    const u = await prisma.user.findUnique({
      where: { email: "dev@test.com" },
      select: { id: true },
    });
    dbOk = true;
    devUserExists = !!u;
  } catch (e: any) {
    // Prisma 에러 코드만(연결 문자열 등 비밀 노출 방지)
    dbErrorCode = e?.code ?? e?.name ?? "UNKNOWN";
  }

  return NextResponse.json({
    allowDevLogin,    // ALLOW_DEV_LOGIN === "1" 인가
    rawSet,           // 변수가 설정되긴 했는가
    rawLen,           // 값 길이 (1이어야 정상; 공백 등 섞이면 2+)
    dbOk,             // DB 연결 정상인가
    devUserExists,    // dev@test.com 유저가 DB에 있는가
    dbErrorCode,      // DB 실패 시 Prisma 코드 (P1001=연결, P2021=테이블없음 등)
  });
}
