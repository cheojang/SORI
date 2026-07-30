import {
  SERVICE_NAME,
  COMPANY_NAME,
  CEO_NAME,
  BIZ_REG_NUMBER,
  BIZ_ADDRESS,
  BIZ_PHONE,
  MAIL_ORDER_REG_NUMBER,
} from "@/lib/business-info";

/**
 * 사업자 정보 표기 (전자상거래법 제10조).
 * 값이 비어 있는 항목은 줄 자체를 생략한다 — 빈 라벨을 노출하면
 * 카드사 심사에서 "정보 누락"으로 보일 수 있다.
 */
export function BusinessInfoLines() {
  return (
    <>
      상호: {COMPANY_NAME} (서비스명: {SERVICE_NAME}) · 대표: {CEO_NAME}
      <br />
      사업자등록번호: {BIZ_REG_NUMBER}
      {MAIL_ORDER_REG_NUMBER && (
        <>
          <br />
          통신판매업신고번호: {MAIL_ORDER_REG_NUMBER}
        </>
      )}
      {BIZ_PHONE && (
        <>
          <br />
          전화번호: {BIZ_PHONE}
        </>
      )}
      <br />
      주소: {BIZ_ADDRESS}
    </>
  );
}
