import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      // 0. 탈퇴 로그 스냅샷 — User는 하드 삭제되므로 관리자 확인용 최소 정보를 먼저 남긴다.
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { email: true, name: true, createdAt: true },
      });
      if (user) {
        await tx.deletedUserLog.create({
          data: {
            originalId: userId,
            email: user.email,
            name: user.name,
            createdAt: user.createdAt,
          },
        });
      }

      // 1. PracticeSession (onDelete Cascade 없음 — WordRecord는 session 삭제 시 cascade)
      await tx.practiceSession.deleteMany({ where: { userId } });

      // 2. Subscription (onDelete Cascade 없음)
      await tx.subscription.deleteMany({ where: { userId } });

      // 3. AnnouncementRead (User relation 없음, userId 문자열만 존재)
      await tx.announcementRead.deleteMany({ where: { userId } });

      // 4. User 삭제 → cascade: Account, Session, TherapistProfile, Message,
      //    Child → ErrorRecord, WeakPhoneme, ReviewSchedule, SavedWord,
      //            CenterChild, TherapistChild, Homework, TherapyNote
      await tx.user.delete({ where: { id: userId } });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[DeleteAccount Error]:", error);
    return NextResponse.json(
      { error: "탈퇴 처리 중 오류가 발생했어요. 잠시 후 다시 시도해주세요." },
      { status: 500 },
    );
  }
}
