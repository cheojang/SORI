export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { prisma } from '@/lib/prisma';
import { getGeminiFeedbackStream } from '@/lib/gemini-client';
import { auth } from '@/lib/auth';

// ── 스트리밍 중 완성된 문자열 필드 추출 (안전하게 닫힌 것만) ──────────────
// JSON 모드로 응답하므로 value 내부의 "는 반드시 \"로 escape됨
// 따라서 ([^"\\]|\\.)*로 이스케이프 시퀀스까지 정확히 파싱
const STRING_FIELD_REGEX =
  /"(patternName|rootCause|trainingStep1|trainingStep2|trainingStep3|trainingStep4|parentMessage)"\s*:\s*"((?:[^"\\]|\\.)*)"/g;

function unescapeJsonString(raw: string): string {
  try {
    return JSON.parse(`"${raw}"`);
  } catch {
    return raw;
  }
}

/**
 * errorType + affectedSyllable 정보로 position(초성/어중/종성/중성) 판별
 */
function inferPosition(errorType: string, affectedSyllable: number): string {
  if (/종성/.test(errorType)) return "종성";
  if (/모음/.test(errorType) || /중성/.test(errorType)) return "중성";
  if (affectedSyllable === 0) return "초성";
  return "어중";
}

/**
 * jamo-analysis 실제 출력 → phoneme-combinations 등록 후보 목록
 * 단일 IN 쿼리로 처리해 DB 왕복을 최소화
 */
const ERROR_TYPE_ALIASES: Record<string, string[]> = {
  // ── ERROR_PATTERNS 직접 출력 ──
  "파열음의 경음화":           ["경음화"],
  "파열음의 기음화":           ["기음화", "기음감소"],
  "파열음의 치조음화":         ["전방화", "치조음화"],
  "파열음의 연구개음화":       ["후방화", "연구개음화"],
  "마찰음의 파열음화":         ["파열음화"],
  "마찰음의 경음화":           ["경음화", "마찰음강화"],
  "마찰음의 경음화 (쌍시옷)":  ["경음화", "마찰음강화"],
  "마찰음의 연구개음화":       ["후방화"],
  "마찰음 상호교환":           ["파찰음화", "마찰음화"],
  "마찰음 교환 (ㅈ→ㅅ)":      ["마찰음화"],
  "유음의 비음화":             ["비음화"],
  "유음의 파열음화":           ["파열음화"],
  "유음의 경음화":             ["경음화"],
  "유음의 초성탈락":           ["탈락"],
  "양순동화 (파열음→비음)":    ["순음화동화", "비음화동화", "비음화"],
  "양순동화 (비음 상호교환)":  ["순음화동화", "순음화"],
  "양순음의 초성탈락":         ["탈락"],
  "비음의 파열음화":           ["파열음화"],
  "비음의 초성탈락":           ["탈락"],
  "비음의 초성탈락 (ㄴ탈락)":  ["탈락"],
  "비음→파열음 치환 (ㅁ→ㄱ)": ["후방화", "파열음화"],
  "ㅎ의 무성화/탈락":          ["탈락"],
  "ㅎ의 경음화":               ["파열음화"],
  // ── 분기 직접 출력 ──
  "초성탈락":                  ["탈락"],
  "초성첨가":                  ["모음간첨가", "첨가", "어두첨가"],
  "종성탈락":                  ["탈락", "겹받침단순화"],
  "동화":                      ["순음화동화", "연구개음화동화", "비음화동화",
                                 "유음화동화", "치경음화동화"],
  "모음 오류":                  ["모음혼동", "모음단순화"],
  "음절탈락":                  ["음절구조단순화", "탈락"],
  "음절축약":                  ["음절구조단순화", "탈락"],
  "음절첨가":                  ["첨가"],
  // ── getDetailedSubstitutionPattern 출력 (이미 일치하는 것도 포함) ──
  "경음화":    ["경음화"],
  "기음화":    ["기음화", "기음감소"],
  "치조음화":  ["전방화"],
  "연구개음화":["후방화", "연구개음화"],
  "파열음화":  ["파열음화"],
  "비음화":    ["비음화", "비음연구개화", "비음순음화"],
  "탈비음화":  ["파열음화"],
  "유음대치":  ["비음화", "파열음화"],
};

/**
 * errorType 하나에 대해 DB 조회 후보 목록 반환 (중복 제거)
 */
function getErrorTypeCandidates(errorType: string): string[] {
  const aliases = ERROR_TYPE_ALIASES[errorType] ?? [];
  return [...new Set([errorType, ...aliases])];
}

/**
 * POST /api/gemini-feedback
 * 1순위: PhonemeTemplate DB 조회 → 즉시 반환 (< 10ms)
 * 2순위: Gemini API 호출 → 결과를 Template에 캐시
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }

    const isGuest = session.user.isGuest === true;

    // 사용자별 레이트리밋 — 프리미엄(무제한) 포함 모든 등급의 호출 버스트 방어
    const { geminiLimiter } = await import("@/lib/rate-limit");
    const burstIp = (request.headers.get("x-forwarded-for")?.split(",")[0].trim()) ?? "unknown";
    const burstKey = isGuest ? `ip:${burstIp}` : session.user.id;
    if (!geminiLimiter.allow(burstKey)) {
      return NextResponse.json({ error: "요청이 많아요. 잠시 후 다시 시도해주세요." }, { status: 429 });
    }

    const body = await request.json();

    // 월간 제한은 캐시 미스 시에만 적용 (아래 캐시 확인 후)

    // ─── 회원: 저장된 ErrorRecord 기반 / 게스트: 입력값 기반(저장 안 함) ─────────
    // errorRecord는 두 경로 공통 인터페이스. 게스트는 DB에 없는 합성 객체를 사용해
    // 캐시 조회·Gemini 호출까지만 진행하고, GeminiFeedback/PhonemeTemplate 저장은 건너뜀.
    let errorRecord: {
      id: string | null;
      targetWord: string;
      childPronunciation: string;
      errorType: string;
      errorCategory: string;
      errorPattern: string;
      localAnalysis: { jamoBreakdown: string } | null;
      child: { birthDate: Date | null };
      geminiFeedback: {
        rootCause: string;
        trainingStep1: string;
        trainingStep2: string;
        trainingStep3: string;
        trainingStep4: string;
        recommendedWords: string;
        parentMessage: string;
      } | null;
    };
    let errorRecordId: string | null = null;

    if (isGuest) {
      // 게스트는 errorRecordId가 없음 — 단어쌍/오류유형을 직접 전달받음
      const targetWord = typeof body.targetWord === "string" ? body.targetWord.trim() : "";
      const childPronunciation = typeof body.childPronunciation === "string" ? body.childPronunciation.trim() : "";
      if (!targetWord || !childPronunciation) {
        return NextResponse.json({ error: "targetWord, childPronunciation 필수" }, { status: 400 });
      }
      errorRecord = {
        id: null,
        targetWord,
        childPronunciation,
        errorType: typeof body.errorType === "string" ? body.errorType : "미판정",
        errorCategory: typeof body.errorCategory === "string" ? body.errorCategory : "미판정",
        errorPattern: typeof body.errorPattern === "string" ? body.errorPattern : (body.errorType ?? "미판정"),
        localAnalysis: null,
        child: { birthDate: null },
        geminiFeedback: null,
      };
    } else {
      errorRecordId = body.errorRecordId;
      if (!errorRecordId) {
        return NextResponse.json({ error: "errorRecordId 필수" }, { status: 400 });
      }

      // ErrorRecord + 소유권 확인
      const record = await prisma.errorRecord.findUnique({
        where: { id: errorRecordId },
        include: {
          localAnalysis: true,
          child: true,
          geminiFeedback: true,
        },
      });

      if (!record) {
        return NextResponse.json({ error: "기록을 찾을 수 없습니다" }, { status: 404 });
      }
      if (record.child.userId !== session.user.id) {
        return NextResponse.json({ error: "접근 권한이 없습니다" }, { status: 403 });
      }
      errorRecord = record;
    }

    // ─── 0순위: 글로벌 WordPairCache (DB) ───────────────────────────────────
    const globalCache = await prisma.wordPairCache.findUnique({
      where: {
        targetWord_childPronunciation: {
          targetWord: errorRecord.targetWord,
          childPronunciation: errorRecord.childPronunciation,
        },
      },
    });
    if (globalCache) {
      console.log("[Cache-DB] 글로벌 HIT:", errorRecord.targetWord, `(총 ${globalCache.hitCount + 1}회)`);
      let recWords: string[] = [];
      try { recWords = JSON.parse(globalCache.recommendedWords); } catch {}

      // 회원 기록이면 글로벌 캐시 내용을 개인 GeminiFeedback으로도 저장
      // → 분석기록(분석 후 펼침)에 처방전이 정상 표시됨 (이전엔 캐시 HIT 시 저장 누락)
      if (!isGuest && errorRecordId) {
        const feedbackData = {
          rootCause:        globalCache.rootCause,
          trainingStep1:    globalCache.trainingStep1,
          trainingStep2:    globalCache.trainingStep2,
          trainingStep3:    globalCache.trainingStep3,
          trainingStep4:    globalCache.trainingStep4,
          recommendedWords: globalCache.recommendedWords,
          parentMessage:    globalCache.parentMessage,
        };
        await prisma.geminiFeedback.upsert({
          where: { errorRecordId },
          create: { errorRecordId, ...feedbackData },
          update: feedbackData,
        }).catch((e) => console.error("[Cache-DB] GeminiFeedback 저장 실패:", e));
      }

      const result = {
        patternName:      errorRecord.errorPattern,
        rootCause:        globalCache.rootCause,
        trainingStep1:    globalCache.trainingStep1,
        trainingStep2:    globalCache.trainingStep2,
        trainingStep3:    globalCache.trainingStep3,
        trainingStep4:    globalCache.trainingStep4,
        recommendedWords: recWords,
        parentMessage:    globalCache.parentMessage,
        fromCache:        true,
        fromGlobalCache:  true,
      };
      prisma.wordPairCache.update({
        where: { id: globalCache.id },
        data: { hitCount: { increment: 1 } },
      }).catch(() => {});
      return NextResponse.json(result);
    }

    // ─── jamoBreakdown 파싱 → 음소 + 위치 추출 ──────────────────────────────
    let phoneme = "";
    let position = "초성";

    if (errorRecord.localAnalysis?.jamoBreakdown) {
      try {
        const bd = JSON.parse(errorRecord.localAnalysis.jamoBreakdown) as {
          analysis?: {
            targetJamo?: string;
            affectedSyllable?: number;
          };
        };
        phoneme = bd.analysis?.targetJamo ?? "";
        position = inferPosition(
          errorRecord.errorType,
          bd.analysis?.affectedSyllable ?? 0
        );
      } catch { /* skip */ }
    }

    // ─── 1순위: 현재 기록의 GeminiFeedback 캐시 확인 ─────────────────────────
    // 동일 (targetWord, childPronunciation) 쌍은 위의 globalCache(WordPairCache)에서
    // 이미 처리되므로 추가 findFirst는 불필요.
    const cachedFeedback = errorRecord.geminiFeedback;
    if (cachedFeedback) {
      const cached = cachedFeedback;
      let recWords: string[] = [];
      try { recWords = JSON.parse(cached.recommendedWords); } catch {}

      return NextResponse.json({
        patternName:      errorRecord.errorPattern,
        rootCause:        cached.rootCause,
        trainingStep1:    cached.trainingStep1,
        trainingStep2:    cached.trainingStep2,
        trainingStep3:    cached.trainingStep3,
        trainingStep4:    cached.trainingStep4,
        recommendedWords: recWords,
        parentMessage:    cached.parentMessage,
        geminiConfidence: 5,
        fromCache:        true,
      });
    }

    // ─── 사용 제한 체크 (캐시 미스 경우에만 적용) ──────────────────────────────
    const {
      FREE_AI_MONTHLY_LIMIT, GUEST_AI_MONTHLY_LIMIT, TRIAL_DAILY_LIMIT,
      getAccessInfo, countMonthlyGeminiUsage, countDailyGeminiUsage,
      hashGuestIp, getClientIp, getGuestMonthlyUsage, incrementGuestUsage,
    } = await import("@/lib/usage-limit");

    let guestIpHash: string | null = null;

    if (isGuest) {
      // IP 해시 기반 서버측 카운터 (쿠키 변조/삭제로 우회 불가)
      guestIpHash = hashGuestIp(getClientIp(request));
      const used = await getGuestMonthlyUsage(guestIpHash);
      if (used >= GUEST_AI_MONTHLY_LIMIT) {
        return NextResponse.json({
          error: `비회원은 AI 분석을 월 ${GUEST_AI_MONTHLY_LIMIT}회까지 이용할 수 있어요. 회원가입하면 월 ${FREE_AI_MONTHLY_LIMIT}회 이용할 수 있어요.`,
          isMonthlyLimitReached: true,
          isGuest: true,
          limit: GUEST_AI_MONTHLY_LIMIT,
          used,
        }, { status: 429 });
      }
      // 사전 증가: 동시 요청 race condition 차단 (Gemini 호출 실패 시 차감하지 않음 — 안전한 over-count)
      await incrementGuestUsage(guestIpHash);
    } else {
      const access = await getAccessInfo(session.user.id);
      if (access.level === "trial") {
        // 체험 회원: 무제한이되 일일 상한으로 비용 폭주 방어
        const usedToday = await countDailyGeminiUsage(session.user.id);
        if (usedToday >= TRIAL_DAILY_LIMIT) {
          return NextResponse.json({
            error: `프리미엄 체험 중에는 하루 ${TRIAL_DAILY_LIMIT}회까지 분석할 수 있어요. 내일 다시 이용해 주세요.`,
            isDailyLimitReached: true,
            limit: TRIAL_DAILY_LIMIT,
            used: usedToday,
          }, { status: 429 });
        }
      } else if (access.level === "free") {
        const used = await countMonthlyGeminiUsage(session.user.id);
        if (used >= FREE_AI_MONTHLY_LIMIT) {
          return NextResponse.json({
            error: `이번 달 AI 분석 횟수(${FREE_AI_MONTHLY_LIMIT}회)를 모두 사용했어요. 다음 달 1일에 초기화돼요. 프리미엄으로 업그레이드하면 무제한으로 이용할 수 있어요.`,
            isMonthlyLimitReached: true,
            limit: FREE_AI_MONTHLY_LIMIT,
            used,
          }, { status: 429 });
        }
      }
      // premium: 제한 없음
    }

    // ─── 2순위: Gemini API 신규 호출 (NDJSON 스트리밍) ───────────────────────
    console.log("[Gemini] 신규 스트리밍 호출:", errorRecord.targetWord);

    let streamResult;
    try {
      streamResult = await getGeminiFeedbackStream(
        errorRecord.targetWord,
        errorRecord.childPronunciation,
        errorRecord.errorType,
        errorRecord.errorCategory,
        errorRecord.child
      );
    } catch (geminiErr: any) {
      console.error("[Gemini] 스트림 시작 실패:", geminiErr.message);
      if (geminiErr.message?.includes('키가 설정되지 않았습니다')) {
        return NextResponse.json({ error: "AI 분석 서비스를 사용할 수 없습니다. 관리자에게 문의하세요." }, { status: 503 });
      }
      if (geminiErr.message?.includes('503') || geminiErr.message?.includes('Service Unavailable')) {
        return NextResponse.json({ error: "AI 서버가 바빠요. 잠시 후 다시 눌러주세요.", isServiceBusy: true }, { status: 503 });
      }
      // 폴백 3개 모델(flash → flash-lite → pro)이 전부 소진된 경우 마지막 에러가 여기까지 올라온다.
      // 구글이 예고 없이 모델을 조기 차단하는 사례가 실제로 있었으므로(2026-07-09) 별도 문구로 안내.
      if (/404|NOT_FOUND|no longer available/i.test(geminiErr.message ?? '')) {
        return NextResponse.json({ error: "AI 분석 서비스가 일시적으로 이용 불가해요. 잠시 후 다시 눌러주세요.", isServiceBusy: true }, { status: 503 });
      }
      if (geminiErr.message?.includes('429') || geminiErr.message?.includes('quota')) {
        const isPrepayDepleted = geminiErr.message?.includes('prepayment') || geminiErr.message?.includes('credits are depleted');
        return NextResponse.json({
          error: isPrepayDepleted
            ? "AI 크레딧이 소진됐어요. AI Studio에서 크레딧을 충전해 주세요."
            : "AI 분석 일일 한도에 도달했습니다. 내일 다시 시도해 주세요.",
          isQuotaError: true,
          isPrepayDepleted,
        }, { status: 429 });
      }
      return NextResponse.json({ error: "AI 분석 중 오류가 발생했습니다" }, { status: 500 });
    }

    const encoder = new TextEncoder();
    const sentFields = new Set<string>();
    let accumulated = "";

    const stream = new ReadableStream({
      async start(controller) {
        const sendLine = (obj: unknown) => {
          controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
        };

        try {
          // ── 스트림 청크 처리: 완성된 필드만 클라이언트에 전송 ──────────
          for await (const chunk of streamResult.stream) {
            const text = chunk.text();
            if (!text) continue;
            accumulated += text;

            STRING_FIELD_REGEX.lastIndex = 0;
            let m: RegExpExecArray | null;
            while ((m = STRING_FIELD_REGEX.exec(accumulated)) !== null) {
              const fieldName = m[1];
              if (sentFields.has(fieldName)) continue;
              sentFields.add(fieldName);
              sendLine({
                type: "field",
                field: fieldName,
                value: unescapeJsonString(m[2]),
              });
            }
          }

          // ── 스트림 완료 후 전체 JSON 파싱 ────────────────────────────
          const cleaned = accumulated
            .replace(/^```(?:json)?\s*/i, "")
            .replace(/\s*```$/, "")
            .trim();

          let parsed: any = null;
          try {
            parsed = JSON.parse(cleaned);
            if (typeof parsed === "string") parsed = JSON.parse(parsed);
          } catch (e) {
            console.error("[Gemini] 최종 JSON 파싱 실패:", e);
          }

          if (parsed) {
            // 배열 필드 전송
            if (Array.isArray(parsed.recommendedWords)) {
              sendLine({
                type: "array",
                field: "recommendedWords",
                value: parsed.recommendedWords,
              });
            }

            // ── DB 저장 (비동기, 응답 지연 없음) ──────────────────────
            (async () => {
              try {
                // ── 회원 전용: 개인 ErrorRecord/GeminiFeedback 저장 (게스트는 저장 안 함) ──
                if (!isGuest && errorRecordId) {
                  if (parsed.patternName && errorRecord.errorPattern.includes("미등록 패턴")) {
                    await prisma.errorRecord.update({
                      where: { id: errorRecordId },
                      data: { errorPattern: errorRecord.errorPattern.replace("미등록 패턴", parsed.patternName) }
                    });
                  }
                  // errorRecordId가 @unique이므로 upsert 단일 호출로 race 제거
                  const feedbackData = {
                    rootCause:        parsed.rootCause ?? "",
                    trainingStep1:    parsed.trainingStep1 ?? "",
                    trainingStep2:    parsed.trainingStep2 ?? "",
                    trainingStep3:    parsed.trainingStep3 ?? "",
                    trainingStep4:    parsed.trainingStep4 ?? "",
                    recommendedWords: JSON.stringify(parsed.recommendedWords ?? []),
                    parentMessage:    parsed.parentMessage ?? "",
                  };
                  await prisma.geminiFeedback.upsert({
                    where: { errorRecordId },
                    create: { errorRecordId, ...feedbackData },
                    update: feedbackData,
                  });
                }

                if (!isGuest && phoneme && phoneme !== "(없음)") {
                  await prisma.phonemeTemplate.upsert({
                    where: { phoneme_position_errorType: { phoneme, position, errorType: errorRecord.errorType } },
                    create: {
                      phoneme, position,
                      errorType:        errorRecord.errorType,
                      errorCategory:    errorRecord.errorCategory,
                      exampleTarget:    errorRecord.targetWord,
                      exampleChild:     errorRecord.childPronunciation,
                      parentHint:       parsed.parentMessage ?? "",
                      rootCause:        parsed.rootCause ?? "",
                      trainingStep1:    parsed.trainingStep1 ?? "",
                      trainingStep2:    parsed.trainingStep2 ?? "",
                      trainingStep3:    parsed.trainingStep3 ?? "",
                      trainingStep4:    parsed.trainingStep4 ?? "",
                      recommendedWords: JSON.stringify(parsed.recommendedWords ?? []),
                    },
                    update: {},
                  }).catch(() => {});
                }

                // ── 글로벌 WordPairCache 저장 (선착순 — 이미 있으면 덮어쓰지 않음) ──
                await prisma.wordPairCache.upsert({
                  where: {
                    targetWord_childPronunciation: {
                      targetWord: errorRecord.targetWord,
                      childPronunciation: errorRecord.childPronunciation,
                    },
                  },
                  create: {
                    targetWord:         errorRecord.targetWord,
                    childPronunciation: errorRecord.childPronunciation,
                    errorType:          errorRecord.errorType,
                    errorCategory:      errorRecord.errorCategory,
                    rootCause:          parsed.rootCause ?? "",
                    trainingStep1:      parsed.trainingStep1 ?? "",
                    trainingStep2:      parsed.trainingStep2 ?? "",
                    trainingStep3:      parsed.trainingStep3 ?? "",
                    trainingStep4:      parsed.trainingStep4 ?? "",
                    recommendedWords:   JSON.stringify(parsed.recommendedWords ?? []),
                    parentMessage:      parsed.parentMessage ?? "",
                  },
                  update: {},
                }).then(() => {
                  console.log("[Cache] 글로벌 캐시 저장:", errorRecord.targetWord);
                }).catch(() => {});
              } catch (saveError) {
                console.error("DB Save Error:", saveError);
              } finally {
                // DB 저장 완료 후 스트림 닫기 — 완료 전 종료 시 Vercel이 함수를
                // 끊어 GeminiFeedback이 누락되던 문제 수정
                sendLine({ type: "done" });
                controller.close();
              }
            })();
          } else {
            sendLine({ type: "error", error: "응답을 해석하지 못했어요" });
            sendLine({ type: "done" });
            controller.close();
          }
        } catch (err: any) {
          console.error("[Gemini] 스트림 처리 오류:", err);
          const isQuota = err?.message?.includes('429') || err?.message?.includes('quota');
          const isServiceBusy = err?.message?.includes('503') || err?.message?.includes('Service Unavailable');
          try {
            sendLine({
              type: "error",
              error: isQuota
                ? "오늘 AI 분석 한도를 모두 사용했어요"
                : isServiceBusy
                ? "AI 서버가 바빠요. 잠시 후 다시 눌러주세요."
                : "AI 분석 중 오류가 발생했습니다",
              isQuotaError: isQuota,
              isServiceBusy,
            });
          } catch {}
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
      },
    });

  } catch (error: any) {
    console.error("Critical Error in /api/gemini-feedback:", error);
    return NextResponse.json({ error: "AI 분석 중 오류가 발생했습니다" }, { status: 500 });
  }
}
