import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import Link from "next/link";
import { BubbleButton } from "@/components/ui/BubbleButton";

interface Props {
  // done: 구매 검증(/api/billing/google-play/verify)이 끝난 뒤 클라이언트가 붙여 보내는 표식.
  // 이 페이지는 결과를 보여주기만 하고 스스로 구독을 활성화하지 않는다 — 활성화는 반드시
  // 서버 검증 엔드포인트를 거친다(쿼리 파라미터만으로 프리미엄이 켜지면 안 되므로).
  searchParams: Promise<{ done?: string }>;
}

async function SuccessContent({ searchParams }: Props) {
  const { done } = await searchParams;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  // 파라미터 없이 직접 접근
  if (!done) redirect("/subscribe");

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
