import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { activateSubscription } from "@/lib/subscription-activate";
import Link from "next/link";
import { BubbleButton } from "@/components/ui/BubbleButton";

interface Props {
  // billingKey: 모바일 결제창이 리다이렉트로 넘겨주는 값
  // done: PC 경로에서 이미 /api/billing/activate로 처리를 끝내고 넘어온 경우
  searchParams: Promise<{ billingKey?: string; done?: string; code?: string; message?: string }>;
}

async function SuccessContent({ searchParams }: Props) {
  const { billingKey, done, code, message } = await searchParams;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  let errorMsg: string | null = null;

  if (code) {
    // 결제창이 실패 사유를 붙여 되돌려준 경우
    errorMsg = message ?? "카드 등록에 실패했어요";
  } else if (billingKey) {
    // 모바일 리다이렉트 경로 — 여기서 소유자 검증 + 첫 달 결제 + 구독 활성화
    const result = await activateSubscription(session.user.id, billingKey);
    if (!result.ok) errorMsg = result.error;
  } else if (!done) {
    // 파라미터 없이 직접 접근
    redirect("/subscribe");
  }

  if (errorMsg) {
    return (
      <main
        className="min-h-dvh flex flex-col items-center justify-center px-6 text-center"
        style={{ backgroundColor: "var(--color-bg-primary)" }}
      >
        <div className="text-8xl mb-6">😢</div>
        <h2 className="text-3xl font-black text-[#3D3530] mb-3">결제 실패</h2>
        <p className="text-[#8B7E74] mb-8 max-w-xs leading-relaxed">{errorMsg}</p>
        <Link href="/subscribe">
          <BubbleButton variant="peach" size="lg">다시 시도하기</BubbleButton>
        </Link>
      </main>
    );
  }

  return (
    <main
      className="min-h-dvh flex flex-col items-center justify-center px-6 text-center"
      style={{ backgroundColor: "var(--color-bg-primary)" }}
    >
      <div className="text-8xl mb-6 animate-bounce-in">🎉</div>
      <h2 className="text-3xl font-black text-[#3D3530] mb-3">구독 완료!</h2>
      <p className="text-[#8B7E74] mb-8 max-w-xs leading-relaxed">
        바른발음 프리미엄을 시작했어요. 매달 자동으로 결제되며, 설정에서 언제든 해지할 수 있어요.
      </p>
      <Link href="/dashboard">
        <BubbleButton variant="peach" size="lg">연습 시작하기 🚀</BubbleButton>
      </Link>
    </main>
  );
}

export default function SuccessPage(props: Props) {
  return (
    <Suspense
      fallback={
        <div className="min-h-dvh flex items-center justify-center text-[#8B7E74]">
          결제 처리 중...
        </div>
      }
    >
      <SuccessContent {...props} />
    </Suspense>
  );
}
