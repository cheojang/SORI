// PortOne(포트원) V2 서버 연동 — PG사(NHN KCP)에 직접 붙지 않고 포트원을 통해 호출한다.
// PG를 교체해도(KCP↔KSNET 등) 이 파일은 그대로 두고 채널키만 바꾸면 된다.
//
// 요청/응답 형태를 직접 만들지 않고 공식 SDK 클라이언트를 쓴다.
// (필드명을 추측하면 런타임에야 터지는데, SDK를 쓰면 타입으로 잡힌다)

import { PaymentClient, BillingKeyClient } from "@portone/server-sdk";

function getApiSecret(): string {
  const secret = process.env.PORTONE_API_SECRET;
  // 💣 Fast Fail: 환경변수 누락 시 결제가 조용히 실패하지 않도록 즉시 에러
  if (!secret) {
    throw new Error("PORTONE_API_SECRET 환경변수가 설정되지 않았습니다.");
  }
  return secret;
}

// 클라이언트는 호출 시점에 만든다 — 모듈 로드 시점엔 환경변수가 없을 수 있다
const payment = () => PaymentClient({ secret: getApiSecret() });
const billing = () => BillingKeyClient({ secret: getApiSecret() });

export interface BillingKeyOwner {
  /** 빌링키 발급을 요청했던 사용자 — 소유자 검증에 사용 */
  userId: string | null;
  /** 이미 삭제(해지)된 빌링키인지 */
  isDeleted: boolean;
}

/**
 * 빌링키의 소유자를 조회한다.
 *
 * 🔒 billingKey 문자열만 알면 남의 구독을 활성화할 수 있으므로, 서버에서 반드시
 *    "이 빌링키가 정말 그 사용자의 것인지" 확인해야 한다.
 *
 * 소유자 식별은 customData에 담아둔 userId로 한다.
 * customer.customerId는 PG마다 지원 여부가 달라(토스페이먼츠·스마트로 위주)
 * KCP에서는 비어 올 수 있는 반면, customData는 포트원이 직접 보관하므로 PG와 무관하게 안전하다.
 */
export async function getBillingKeyOwner(billingKey: string): Promise<BillingKeyOwner> {
  const info = await billing().getBillingKeyInfo({ billingKey });

  if (info.status === "DELETED") {
    return { userId: null, isDeleted: true };
  }
  // 포트원이 새 상태를 추가한 경우 — 소유자를 확인할 수 없으므로 통과시키지 않는다
  if (info.status !== "ISSUED") {
    console.error("[portone] 알 수 없는 빌링키 상태:", info.status);
    return { userId: null, isDeleted: false };
  }

  let userId: string | null = null;
  if (info.customData) {
    try {
      const parsed = JSON.parse(info.customData) as { userId?: unknown };
      if (typeof parsed.userId === "string") userId = parsed.userId;
    } catch {
      console.warn("[portone] customData 파싱 실패:", info.customData);
    }
  }
  // PG가 customerId를 지원하는 경우를 위한 보조 경로
  if (!userId && typeof info.customer?.id === "string") {
    userId = info.customer.id;
  }

  return { userId, isDeleted: false };
}

/** 빌링키 삭제 — 구독 해지 시 등록된 카드를 포트원에서도 정리한다. */
export async function deleteBillingKey(billingKey: string): Promise<void> {
  try {
    await billing().deleteBillingKey({ billingKey });
  } catch (e) {
    // 이미 삭제된 빌링키는 목적을 달성한 것이므로 성공으로 취급
    const msg = e instanceof Error ? e.message : String(e);
    if (/not.?found|이미|already|deleted/i.test(msg)) return;
    throw e;
  }
}

/**
 * 빌링키로 즉시 결제(정기결제 1회분 청구).
 *
 * paymentId는 결제 건의 고유 식별자이자 멱등키 역할을 한다. 같은 paymentId로
 * 다시 호출하면 포트원이 거절하므로, 호출부에서 결제 주기 기반의 결정적(deterministic)
 * 값을 넘겨 같은 달에 두 번 청구되는 사고를 막는다.
 *
 * 금액은 서버 상수(PREMIUM_MONTHLY_PRICE)로만 정해지고 클라이언트가 개입할 수 없으므로,
 * 승인 후 별도의 금액 검증은 하지 않는다. (실패 시 SDK가 예외를 던진다)
 */
export async function chargeWithBillingKey(params: {
  billingKey: string;
  paymentId: string;
  amount: number;
  orderName: string;
  customerId: string;
}): Promise<{ paymentId: string; pgTxId: string; paidAt: string }> {
  const { billingKey, paymentId, amount, orderName, customerId } = params;

  const res = await payment().payWithBillingKey({
    paymentId,
    billingKey,
    orderName,
    customer: { id: customerId },
    amount: { total: amount },
    currency: "KRW",
  });

  return { paymentId, pgTxId: res.payment.pgTxId, paidAt: res.payment.paidAt };
}
