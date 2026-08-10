// 안드로이드 앱(TWA) 식별자 — public/.well-known/assetlinks.json의 package_name과 일치해야 한다.
// 결제는 플레이 스토어 앱 안에서만 가능하므로, 웹에서는 이 링크로 앱 설치를 유도한다.
export const ANDROID_PACKAGE_NAME =
  process.env.NEXT_PUBLIC_GOOGLE_PLAY_PACKAGE_NAME || "com.sori_care.twa";

export const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE_NAME}`;
