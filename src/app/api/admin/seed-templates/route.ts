import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getGenAI as getSharedGenAI, shouldFallbackToNextModel } from "@/lib/gemini-client";
import { PHONEME_COMBINATIONS, type TemplateCombination } from "@/data/phoneme-combinations";
import { isAdmin } from "@/lib/admin-auth";
import { adminSeedLimiter } from "@/lib/rate-limit";

// 3단계 폴백 (2.0/1.5 계열 폐기 — 2.5 계열만 사용). 폴백 트리거 조건은
// gemini-client.ts의 shouldFallbackToNextModel 참고(503 과부하뿐 아니라
// 구글의 예고 없는 조기 모델 차단 404도 다음 모델로 넘긴다).
const MODEL_FALLBACK = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.5-pro"];

function getGenAI() {
  const ai = getSharedGenAI();
  if (!ai) throw new Error("Gemini 미설정 (Vertex 자격증명 또는 GEMINI_API_KEY 필요)");
  return ai;
}

// 폴백 적용 단발 호출 헬퍼
async function generateWithFallback(genai: ReturnType<typeof getGenAI>, prompt: string): Promise<string> {
  for (let i = 0; i < MODEL_FALLBACK.length; i++) {
    const modelName = MODEL_FALLBACK[i];
    try {
      if (i > 0) console.log(`[SeedTemplates] 폴백 모델 사용: ${modelName}`);
      const raw = await genai.models.generateContent({ model: modelName, contents: prompt });
      return raw.text ?? "";
    } catch (e: any) {
      if (shouldFallbackToNextModel(e) && i < MODEL_FALLBACK.length - 1) {
        console.warn(`[SeedTemplates] ${modelName} 실패 → ${MODEL_FALLBACK[i + 1]}로 폴백`);
        continue;
      }
      throw e;
    }
  }
  throw new Error("모든 Gemini 모델을 시도했지만 실패했습니다");
}

function buildPrompt(combo: TemplateCombination) {
  return `당신은 15년 경력의 아동 언어재활사입니다.
아래 음소 오류 패턴에 대해 가정 내 훈련법(Home-T)을 JSON 형식으로 작성하세요.

오류 정보:
- 음소: ${combo.phoneme}
- 위치: ${combo.position}
- 오류유형: ${combo.errorType} (${combo.errorCategory})
- 예시 목표 단어: ${combo.exampleTarget}
- 예시 아이 발음: ${combo.exampleChild}

【훈련법 작성 기준 — 반드시 준수】
trainingStep1(조음 감각 깨우기): 거울·종이·손바닥·촛불·비눠방울 등 소품 또는 뱀 소리·가글·까꿍 같은 놀이를 활용해 해당 음소의 신체 감각(혀·입술·공기 방향)을 처음 느끼게 합니다. 2~4문장.
trainingStep2(소리 느끼기): 시각·청각·촉각 멀티센서리 피드백 필수 포함. "종이가 흔들리는지", "손바닥에 바람이 닿는지", "목에 손을 대어 진동 확인" 등 구체적 체험 활동. 목표 소리와 오류 소리의 차이를 직접 체험으로 인식. 2~4문장.
trainingStep3(음절/단어로 연결하기): 연장발음법("스---아"처럼 기류를 먼저 낸 뒤 모음 합치기)·선행음법("이-자")·참았다 터뜨리기 등 구체적 음성학적 기법 사용. 소리→음절→단어 단계적 확장. 2~4문장.
trainingStep4(일상에서 적용하기): 부모의 구체적 수신호(검지를 입술 앞에 대기, 목 가리키기 등)·언어 힌트 포함. 아이가 오류를 보일 때 부모가 취할 행동 지침 포함. 일상 맥락(먹을 때·놀 때·책 읽을 때) 연결. 2~4문장.

【절대 금지】
- 단계 제목(예: 【1단계: 조음 감각 깨우기】) 포함 금지 — 훈련 내용만 작성
- 막연한 지시("거울을 보세요", "소리를 들어보세요") 단독 사용 금지
- 영문·학술용어·한자 금지

다음 JSON 형식으로만 응답하세요 (마크다운 코드블록 없이):
{
  "parentHint": "부모가 아이에게 바로 말해줄 수 있는 한 줄 힌트 (예: '혀를 숨기고 스- 소리부터 내요')",
  "rootCause": "조음 발달 원인 설명 200~300자 (혀·입술·공기 메커니즘 포함)",
  "trainingStep1": "소품·놀이 활용 조음 위치 인지 훈련 2~4문장 (단계 제목 없이)",
  "trainingStep2": "멀티센서리 피드백으로 목표소리 체험 2~4문장 (단계 제목 없이)",
  "trainingStep3": "연장발음법 등 구체적 기법으로 소리→음절→단어 연결 2~4문장 (단계 제목 없이)",
  "trainingStep4": "부모 수신호·힌트 포함 일상 적용법 2~4문장 (단계 제목 없이)",
  "recommendedWords": ["연습 단어 8~10개"]
}`;
}

/**
 * GET /api/admin/seed-templates
 * 현재 시드 진행 상황 조회
 */
export async function GET(_: NextRequest) {
  const session = await auth();
  if (!isAdmin(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const done = await prisma.phonemeTemplate.count();
  return NextResponse.json({
    total: PHONEME_COMBINATIONS.length,
    done,
    remaining: PHONEME_COMBINATIONS.length - done,
  });
}

/**
 * POST /api/admin/seed-templates
 * body: { limit?: number }  — 한 번 호출로 처리할 최대 항목 수 (기본 20)
 *
 * Vercel 함수 타임아웃(60s)을 감안해 소량씩 호출하도록 설계.
 * 관리자 페이지에서 반복 호출해 전체 300개를 채웁니다.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!isAdmin(session?.user?.email)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    // Gemini 대량 호출 보호 — 관리자 계정 탈취 시 API 크레딧 고갈 방지
    if (!adminSeedLimiter.allow(session!.user!.email!)) {
      return NextResponse.json({ error: "요청이 너무 잘아요. 잠시 후 다시 시도해주세요." }, { status: 429 });
    }

    const body = await request.json().catch(() => ({}));
    const limit: number = Math.min(Number(body.limit) || 20, 50);
    // force: true 이면 기존 레코드도 덮어씁 (훈련법 고도화 재생성용)
    const force: boolean = body.force === true;

    const genai = getGenAI();

    // 이미 완료된 조합 조회
    const existing = await prisma.phonemeTemplate.findMany({
      select: { phoneme: true, position: true, errorType: true },
    });
    const existingSet = new Set(
      existing.map((e: { phoneme: string; position: string; errorType: string }) => `${e.phoneme}|${e.position}|${e.errorType}`)
    );

    // force 모드: 전체 대상 / 일반 모드: 미완료만
    const pending = (
      force
        ? PHONEME_COMBINATIONS  // 전체 재생성
        : PHONEME_COMBINATIONS.filter((c) => !existingSet.has(`${c.phoneme}|${c.position}|${c.errorType}`))
    ).slice(0, limit);

    if (!force && pending.length === 0) {
      return NextResponse.json({ message: "모든 템플릿이 이미 생성되어 있습니다", done: existing.length });
    }

    const results = { success: 0, failed: 0, errors: [] as string[] };

    for (const combo of pending) {
      try {
        const text = (await generateWithFallback(genai, buildPrompt(combo)))
          .replace(/^```(?:json)?\s*/i, "")
          .replace(/\s*```$/, "")
          .trim();
        const parsed = JSON.parse(text);

        // 생성된 텍스트에서 혹시 남은 【...】 제거
        const stripBracket = (s: string) =>
          String(s ?? "").replace(/^【[^】]*】\s*/, "").trim();

        const fields = {
          parentHint:      stripBracket(parsed.parentHint),
          rootCause:       stripBracket(parsed.rootCause),
          trainingStep1:   stripBracket(parsed.trainingStep1),
          trainingStep2:   stripBracket(parsed.trainingStep2),
          trainingStep3:   stripBracket(parsed.trainingStep3),
          trainingStep4:   stripBracket(parsed.trainingStep4),
          recommendedWords: JSON.stringify(
            Array.isArray(parsed.recommendedWords) ? parsed.recommendedWords : []
          ),
        };

        await prisma.phonemeTemplate.upsert({
          where: {
            phoneme_position_errorType: {
              phoneme: combo.phoneme,
              position: combo.position,
              errorType: combo.errorType,
            },
          },
          create: {
            phoneme:       combo.phoneme,
            position:      combo.position,
            errorType:     combo.errorType,
            errorCategory: combo.errorCategory,
            exampleTarget: combo.exampleTarget,
            exampleChild:  combo.exampleChild,
            ...fields,
          },
          update: fields,   // force 여부 무관, 항상 최신 내용으로 업데이트
        });
        results.success++;
      } catch (err) {
        results.failed++;
        results.errors.push(`${combo.phoneme}/${combo.position}/${combo.errorType}: ${(err as Error).message}`);
      }
    }

    const totalDone = (await prisma.phonemeTemplate.count());
    return NextResponse.json({
      processed: pending.length,
      success: results.success,
      failed: results.failed,
      errors: results.errors,
      totalDone,
      totalRemaining: Math.max(0, PHONEME_COMBINATIONS.length - totalDone),
      mode: force ? "force-update" : "fill-missing",
    });
  } catch (error) {
    console.error("[seed-templates]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
