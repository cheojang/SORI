// 구글 플레이 정기결제(Play Billing) 서버 연동 — androidpublisher 공식 SDK 사용.
//
// 웹(Digital Goods API + Payment Request API)에서 구매가 끝나면 클라이언트가
// purchaseToken을 받는다. 그 토큰이 진짜인지, 활성 상태인지는 반드시 이 서버 API로
// 재확인해야 한다(클라이언트가 보낸 값을 그대로 믿으면 위조 가능).

import { google, androidpublisher_v3 } from "googleapis";

function getPackageName(): string {
  const pkg = process.env.GOOGLE_PLAY_PACKAGE_NAME;
  if (!pkg) throw new Error("GOOGLE_PLAY_PACKAGE_NAME 환경변수가 설정되지 않았습니다.");
  return pkg;
}

let client: androidpublisher_v3.Androidpublisher | null = null;

function getClient(): androidpublisher_v3.Androidpublisher {
  if (client) return client;

  const raw = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error("GOOGLE_PLAY_SERVICE_ACCOUNT_KEY 환경변수가 설정되지 않았습니다.");

  let credentials: Record<string, unknown>;
  try {
    credentials = JSON.parse(raw);
  } catch {
    throw new Error("GOOGLE_PLAY_SERVICE_ACCOUNT_KEY가 올바른 JSON이 아닙니다.");
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/androidpublisher"],
  });

  client = google.androidpublisher({ version: "v3", auth });
  return client;
}

// 프리미엄 접근을 허용할 구독 상태 — 그레이스 기간(결제 실패했지만 유예 중)도 포함해
// usage-limit.ts의 past_due 그레이스 정책과 결을 맞춘다.
const ACTIVE_STATES = new Set([
  "SUBSCRIPTION_STATE_ACTIVE",
  "SUBSCRIPTION_STATE_IN_GRACE_PERIOD",
]);

export interface PlaySubscriptionStatus {
  active: boolean;
  subscriptionState: string;
  productId: string | null;
  expiryTime: Date | null;
  acknowledged: boolean;
}

/** 구매 토큰으로 구독 상태를 조회한다. 서버 검증의 핵심 — 클라이언트 값을 신뢰하지 않는다. */
export async function getSubscriptionStatus(purchaseToken: string): Promise<PlaySubscriptionStatus> {
  const res = await getClient().purchases.subscriptionsv2.get({
    packageName: getPackageName(),
    token: purchaseToken,
  });

  const data = res.data;
  const lineItem = data.lineItems?.[0];
  const state = data.subscriptionState ?? "UNKNOWN";

  return {
    active: ACTIVE_STATES.has(state),
    subscriptionState: state,
    productId: lineItem?.productId ?? null,
    expiryTime: lineItem?.expiryTime ? new Date(lineItem.expiryTime) : null,
    acknowledged: data.acknowledgementState === "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED",
  };
}

/**
 * 구매를 승인(acknowledge) 처리한다. 3일 내 승인하지 않으면 구글이 자동 환불한다.
 * 이미 승인된 건에 다시 호출하면 400을 반환하는데, 그 경우는 목적을 이미 달성한 것이므로 무시한다.
 */
export async function acknowledgePurchase(purchaseToken: string): Promise<void> {
  try {
    await getClient().purchases.subscriptions.acknowledge({
      packageName: getPackageName(),
      token: purchaseToken,
    });
  } catch (e) {
    const status = (e as { code?: number; response?: { status?: number } })?.response?.status
      ?? (e as { code?: number })?.code;
    if (status === 400) return; // 이미 승인됨
    throw e;
  }
}

/** 구독 해지 — 설정 화면에서 사용자가 직접 해지할 때 사용 (남은 기간은 유지, 다음 갱신만 막는다). */
export async function cancelSubscription(purchaseToken: string): Promise<void> {
  await getClient().purchases.subscriptionsv2.cancel({
    packageName: getPackageName(),
    token: purchaseToken,
  });
}
