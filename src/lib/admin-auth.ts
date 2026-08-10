const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

const DEV_ADMIN_EMAILS = ["dev@test.com", "admin@test.com"];

// 서비스 소유자 — 구글/카카오 소셜 로그인 시 이 이메일이면 관리자 패널 접근 허용
const OWNER_ADMIN_EMAILS = ["cheojang@gmail.com"];

// 🚨 admin2@admin.com / admin3@admin.com 은 더 이상 관리자가 아니다.
//    이 계정들은 공용 약한 비밀번호(git 이력에 평문으로 남아 있음)를 쓰므로,
//    관리자 권한을 유지하면 비밀번호를 아는 누구나 이메일 로그인만으로 관리자
//    패널에 들어올 수 있었다. 원래 이 권한을 남겨둔 이유는 KCP 카드사 심사용
//    테스트 계정이었는데, 결제가 구글 플레이로 바뀌어 그 심사 자체가 없어졌다.
//    → 계정은 그대로 두되(일반 테스트 회원으로 계속 사용 가능) 관리자 권한만 제거.
//    관리자 추가가 필요하면 강한 비밀번호 계정을 ADMIN_EMAILS(env)로 등록할 것.

const isProductionDeploy =
  process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";

export function isAdmin(email?: string | null): boolean {
  if (!email) return false;
  const lower = email.toLowerCase();
  // 개발 계정 관리자 승격은 프로덕션에서 절대 허용하지 않는다
  // (환경변수가 잘못 켜져도 뚫리지 않도록 배포 환경을 신뢰 경계로 삼는다).
  if (
    !isProductionDeploy &&
    process.env.ALLOW_DEV_LOGIN === "1" &&
    DEV_ADMIN_EMAILS.includes(lower)
  ) {
    return true;
  }
  if (OWNER_ADMIN_EMAILS.includes(lower)) return true;
  return ADMIN_EMAILS.includes(lower);
}
