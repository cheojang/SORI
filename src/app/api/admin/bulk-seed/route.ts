import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/admin-auth";
import { adminSeedLimiter } from "@/lib/rate-limit";
import { getGenAI as getSharedGenAI, callWithFallback } from "@/lib/gemini-client";
import { PHONEME_COMBINATIONS, type TemplateCombination } from "@/data/phoneme-combinations";

// 패턴당 목표 단어쌍 수
const PAIRS_PER_PATTERN = 100;
// Vercel 60s 타임아웃 감안 — 한 번 호출당 최대 처리 패턴 수
const MAX_PATTERNS_PER_CALL = 3;

// ─── Gemini 헬퍼 ────────────────────────────────────

function getGenAI() {
  const ai = getSharedGenAI();
  if (!ai) throw new Error("Gemini 미설정 (Vertex 자격증명 또는 GEMINI_API_KEY 필요)");
  return ai;
}

async function generateWithFallback(genai: ReturnType<typeof getGenAI>, prompt: string): Promise<string> {
  return callWithFallback("BulkSeed", async (modelName) => {
    const raw = await genai.models.generateContent({ model: modelName, contents: prompt });
    return raw.text ?? "";
  });
}

function buildPrompt(combo: TemplateCombination): string {
  return `당신은 15년 경력의 한국 아동 언어재활사(SLP)입니다.

아래 조음 오류 패턴에 대해 두 가지를 동시에 생성하세요:
① 가정 내 훈련법 (Home Training)
② 이 오류가 실제로 나타나는 단어쌍 ${PAIRS_PER_PATTERN}개

[오류 패턴]
- 음소: ${combo.phoneme}
- 위치: ${combo.position}
- 오류유형: ${combo.errorType} (${combo.errorCategory})
- 예시: ${combo.exampleTarget} → ${combo.exampleChild}

[훈련법 규칙]
- rootCause: 조음 발달 원인 + 혀·입술·공기 흐름 메커니즘 설명 (200~300자)
- parentHint: 부모가 아이에게 바로 말할 수 있는 한 줄 힌트 (30자 이내, 예: "혀를 숨기고 스- 소리부터 내요")
- trainingStep1(조음 감각 깨우기): 거울·종이·손바닥·촛불·비눠방울 등 소품 또는 뱀 소리·가글 같은 놀이 활용. 해당 음소의 신체 감각을 처음 느끼게 유도. 단계 제목 없이 2~4문장
- trainingStep2(소리 느끼기): 시각·청각·촉각 멀티센서리 피드백 필수. "종이가 흔들리는지", "손바닥에 바람이 닿는지", "목에 진동 느끼기" 등 구체적 체험. 단계 제목 없이 2~4문장
- trainingStep3(음절/단어로 연결하기): 연장발음법("스---아")·선행음법·참았다 터뜨리기 등 구체적 음성학적 기법 사용. 소리→음절→단어 단계적 확장. 단계 제목 없이 2~4문장
- trainingStep4(일상에서 적용하기): 부모의 구체적 수신호(검지를 입술 앞에 대기, 목 가리키기 등)·언어 힌트 포함. 아이 오류 시 부모 행동 지침. 단계 제목 없이 2~4문장
- recommendedWords: 같은 오류 패턴이 포함된 연습 단어 10개
- 절대 금지: 단계 제목(【1단계: ...】) 포함 금지, 막연한 지시("거울을 보세요") 단독 사용 금지

[단어쌍 규칙]
- targetWord: 2~7세 아동이 일상에서 자주 쓰는 단어 (명사 위주)
- childPronunciation: ${combo.errorType} 오류가 정확히 적용된 발음
  → 다른 음소는 변형 없이 그대로 유지
  → 예시와 동일한 오류 변환 규칙을 100개 단어에 일관 적용
- 100개 전부 서로 다른 단어, 실제 아동 어휘 범위 내에서

[출력 형식]
순수 JSON만 출력하세요. 마크다운 코드블록 없이.
{
  "training": {
    "parentHint": "...",
    "rootCause": "...",
    "trainingStep1": "소품·놀이 활용 조음 위치 인지 훈련 내용만 (단계 제목 없이)",
    "trainingStep2": "멀티센서리 피드백 체험 내용만 (단계 제목 없이)",
    "trainingStep3": "연장발음법 등 구체적 기법 내용만 (단계 제목 없이)",
    "trainingStep4": "부모 수신호·힌트 포함 일상 적용 내용만 (단계 제목 없이)",
    "recommendedWords": ["단어1", "단어2", "단어3", "단어4", "단어5", "단어6", "단어7", "단어8", "단어9", "단어10"]
  },
  "wordPairs": [
    { "targetWord": "${combo.exampleTarget}", "childPronunciation": "${combo.exampleChild}" },
    { "targetWord": "...", "childPronunciation": "..." }
  ]
}`;
}

// ─── GET — 진행 상황 조회 ────────────────────────────

export async function GET(_: NextRequest) {
  const session = await auth();
  if (!isAdmin(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [doneTemplates, totalWordPairs] = await Promise.all([
    prisma.phonemeTemplate.findMany({
      select: { phoneme: true, position: true, errorType: true },
    }),
    prisma.wordPairCache.count(),
  ]);

  const doneSet = new Set(
    doneTemplates.map(
      (t: { phoneme: string; position: string; errorType: string }) =>
        `${t.phoneme}|${t.position}|${t.errorType}`
    )
  );

  const pending = PHONEME_COMBINATIONS.filter(
    (c) => !doneSet.has(`${c.phoneme}|${c.position}|${c.errorType}`)
  );

  return NextResponse.json({
    totalPatterns: PHONEME_COMBINATIONS.length,
    donePatterns: doneTemplates.length,
    remainingPatterns: pending.length,
    totalWordPairs,
    targetWordPairs: PHONEME_COMBINATIONS.length * PAIRS_PER_PATTERN,
    nextBatch: pending.slice(0, MAX_PATTERNS_PER_CALL).map((c) => ({
      phoneme: c.phoneme,
      position: c.position,
      errorType: c.errorType,
    })),
  });
}

// ─── POST — 배치 처리 ────────────────────────────────

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!isAdmin(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  // Gemini 대량 호출 보호 — 관리자 계정 탈취 시 API 크레딧 고갈 방지
  if (!adminSeedLimiter.allow(session!.user!.email!)) {
    return NextResponse.json({ error: "요청이 너무 잘아요. 잠시 후 다시 시도해주세요." }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  const limit: number = Math.min(Number(body.limit) || MAX_PATTERNS_PER_CALL, MAX_PATTERNS_PER_CALL);

  // 완료된 패턴 조회
  const doneTemplates = await prisma.phonemeTemplate.findMany({
    select: { phoneme: true, position: true, errorType: true },
  });
  const doneSet = new Set(
    doneTemplates.map(
      (t: { phoneme: string; position: string; errorType: string }) =>
        `${t.phoneme}|${t.position}|${t.errorType}`
    )
  );

  const pending = PHONEME_COMBINATIONS.filter(
    (c) => !doneSet.has(`${c.phoneme}|${c.position}|${c.errorType}`)
  ).slice(0, limit);

  if (pending.length === 0) {
    const totalWordPairs = await prisma.wordPairCache.count();
    return NextResponse.json({
      message: "모든 패턴이 완료됐습니다",
      donePatterns: doneTemplates.length,
      totalWordPairs,
    });
  }

  const genai = getGenAI();
  const results = {
    success: 0,
    failed: 0,
    wordPairsCreated: 0,
    errors: [] as string[],
  };

  for (const combo of pending) {
    const patternKey = `${combo.phoneme}/${combo.position}/${combo.errorType}`;
    try {
      // ── Gemini 호출 ─────────────────────────
      const raw = (await generateWithFallback(genai, buildPrompt(combo)))
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/, "")
        .trim();

      const parsed = JSON.parse(raw) as {
        training: {
          parentHint: string;
          rootCause: string;
          trainingStep1: string;
          trainingStep2: string;
          trainingStep3: string;
          trainingStep4: string;
          recommendedWords: string[];
        };
        wordPairs: { targetWord: string; childPronunciation: string }[];
      };

      const t = parsed.training;
      const pairs = Array.isArray(parsed.wordPairs) ? parsed.wordPairs : [];

      // ── PhonemeTemplate upsert ─────────────────────
      await prisma.phonemeTemplate.upsert({
        where: {
          phoneme_position_errorType: {
            phoneme: combo.phoneme,
            position: combo.position,
            errorType: combo.errorType,
          },
        },
        create: {
          phoneme:         combo.phoneme,
          position:        combo.position,
          errorType:       combo.errorType,
          errorCategory:   combo.errorCategory,
          exampleTarget:   combo.exampleTarget,
          exampleChild:    combo.exampleChild,
          parentHint:      String(t.parentHint    ?? ""),
          rootCause:       String(t.rootCause     ?? ""),
          trainingStep1:   String(t.trainingStep1 ?? ""),
          trainingStep2:   String(t.trainingStep2 ?? ""),
          trainingStep3:   String(t.trainingStep3 ?? ""),
          trainingStep4:   String(t.trainingStep4 ?? ""),
          recommendedWords: JSON.stringify(
            Array.isArray(t.recommendedWords) ? t.recommendedWords : []
          ),
        },
        update: {},
      });

      // ── WordPairCache bulk upsert ────────────────────
      let pairsCreated = 0;
      for (const pair of pairs) {
        if (!pair.targetWord || !pair.childPronunciation) continue;
        try {
          await prisma.wordPairCache.upsert({
            where: {
              targetWord_childPronunciation: {
                targetWord: String(pair.targetWord),
                childPronunciation: String(pair.childPronunciation),
              },
            },
            create: {
              targetWord:         String(pair.targetWord),
              childPronunciation: String(pair.childPronunciation),
              errorType:          combo.errorType,
              errorCategory:      combo.errorCategory,
              rootCause:          String(t.rootCause     ?? ""),
              trainingStep1:      String(t.trainingStep1 ?? ""),
              trainingStep2:      String(t.trainingStep2 ?? ""),
              trainingStep3:      String(t.trainingStep3 ?? ""),
              trainingStep4:      String(t.trainingStep4 ?? ""),
              recommendedWords:   JSON.stringify(
                Array.isArray(t.recommendedWords) ? t.recommendedWords : []
              ),
              parentMessage:      String(t.parentHint ?? ""),
              hitCount:           0,
            },
            update: {},
          });
          pairsCreated++;
        } catch {
          // 중복 충돌 등 개별 오류는 무시하고 계속
        }
      }

      results.success++;
      results.wordPairsCreated += pairsCreated;
      console.log(`[BulkSeed] ✓ ${patternKey} — 단어쌍 ${pairsCreated}개`);
    } catch (err) {
      results.failed++;
      const msg = `${patternKey}: ${(err as Error).message}`;
      results.errors.push(msg);
      console.error(`[BulkSeed] ✗ ${msg}`);
    }
  }

  const [totalDoneTemplates, totalWordPairs] = await Promise.all([
    prisma.phonemeTemplate.count(),
    prisma.wordPairCache.count(),
  ]);

  return NextResponse.json({
    processed: pending.length,
    success: results.success,
    failed: results.failed,
    wordPairsCreated: results.wordPairsCreated,
    errors: results.errors,
    totalDonePatterns: totalDoneTemplates,
    remainingPatterns: PHONEME_COMBINATIONS.length - totalDoneTemplates,
    totalWordPairs,
    targetWordPairs: PHONEME_COMBINATIONS.length * PAIRS_PER_PATTERN,
  });
}
