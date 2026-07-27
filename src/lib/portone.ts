// PortOne(포트원) V2 서버 연동 — PG사(NHN KCP)에 직접 붙지 않고 포트원을 통해 호출한다.
// PG를 교체해도(KCP↔KSNET 등) 이 파일은 그대로 두고 채널키만 바꾸면 된다.

const PORTONE_API_BASE = "https://api.portone.io";

function getApiSecret(): string {
  const secret = process.env.PORTONE_API_SECRET;
  // 💣 Fast Fail: 환경변수 누락 시 결제가 조용히 실패하지 않도록 즉시 에러
  if (!secret) {
    throw new Error("PORTONE_API_SECRET 환경변수가 설정되지 않았습니다.");
  }
  return secret;
}

function authHeaders(): Record<string, string> {
  return {
    Authorization: `PortOne ${getApiSecret()}`,
    "Content-Type": "application/json",
  };
}

/** 포트원 에러 응답을 코드까지 포함한 하나의 Error로 변환 */
async function toError(res: Response, fallback: string): Promise<Error> {
  const body = await res.json().catch(() => ({}) as Record<string, unknown>);
  const type = typeof body.type === "string" ? body.type : res.status;
  const message = typeof body.message === "string" ? body.message : fallback;
  return new Error(`[${type}] ${message}`);
}

export interface BillingKeyInfo {
  billingKey: string;
  /** 빌링키 발급 시 넘긴 고객 식별자 — 우리는 userId를 넣는다 (소유자 검증용) */
  customerId?: string;
  /** 발급 취소(삭제)된 빌링키면 값이 있다 */
  deletedAt?: string;
}

/**
 * 빌링키 단건 조회.
 * 클라이언트가 보내온 billingKey가 정말 그 사용자의 것인지 검증하는 데 사용한다.
 * (billingKey만 알면 남의 구독을 활성화할 수 있으므로 서버 검증이 필수)
 */
export async function getBillingKey(billingKey: string): Promise<BillingKeyInfo> {
  const res = await fetch(
    `${PORTONE_API_BASE}/billing-keys/${encodeURIComponent(billingKey)}`,
    { method: "GET", headers: authHeaders(), cache: "no-store" },
  );

  if (!res.ok) throw await toError(res, "빌링키 조회에 실패했습니다");

  const data = (await res.json()) as {
    billingKey: string;
    customer?: { id?: string };
    deletedAt?: string;
  };

  return {
    billingKey: data.billingKey,
    customerId: data.customer?.id,
    deletedAt: data.deletedAt,
  };
}

/** 빌링키 삭제 — 구독 해지 시 등록된 카드를 포트원에서도 정리한다. */
export async function deleteBillingKey(billingKey: string): Promise<void> {
  const res = await fetch(
    `${PORTONE_API_BASE}/billing-keys/${encodeURIComponent(billingKey)}`,
    { method: "DELETE", headers: authHeaders(), cache: "no-store" },
  );
  // 이미 삭제된 빌링키(404)는 목적을 달성한 것이므로 성공으로 취급
  if (!res.ok && res.status !== 404) {
    throw await toError(res, "빌링키 삭제에 실패했습니다");
  }
}

export interface BillingChargeResult {
  paymentId: string;
  /** 실제 승인된 금액 — 요청 금액과 일치하는지 호출부에서 반드시 검증할 것 */
  totalAmount: number;
  status: string;
}

/**
 * 빌링키로 즉시 결제(정기결제 1회분 청구).
 *
 * paymentId는 결제 건의 고유 식별자이자 멱등키 역할을 한다. 같은 paymentId로
 * 다시 호출하면 포트원이 거절하므로, 호출부에서 결제 주기 기반의 결정적(deterministic)
 * 값을 넘겨 같은 달에 두 번 청구되는 사고를 막는다.
 */
export async function chargeWithBillingKey(params: {
  billingKey: string;
  paymentId: string;
  amount: number;
  orderName: string;
  customerId: string;
}): Promise<BillingChargeResult> {
  const { billingKey, paymentId, amount, orderName, customerId } = params;

  const storeId = process.env.PORTONE_STORE_ID;
  if (!storeId) throw new Error("PORTONE_STORE_ID 환경변수가 설정되지 않았습니다.");

  const res = await fetch(
    `${PORTONE_API_BASE}/payments/${encodeURIComponent(paymentId)}/billing-key`,
    {
      method: "POST",
      headers: authHeaders(),
      cache: "no-store",
      body: JSON.stringify({
        storeId,
        billingKey,
        orderName,
        customer: { id: customerId },
        amount: { total: amount },
        currency: "KRW",
      }),
    },
  );

  if (!res.ok) throw await toError(res, "정기결제 청구에 실패했습니다");

  const data = (await res.json()) as {
    payment?: { id?: string; amount?: { total?: number }; status?: string };
  };

  return {
    paymentId: data.payment?.id ?? paymentId,
    totalAmount: data.payment?.amount?.total ?? 0,
    status: data.payment?.status ?? "UNKNOWN",
  };
}
