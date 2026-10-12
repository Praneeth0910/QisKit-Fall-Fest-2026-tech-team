import { supabaseAdmin } from '@/lib/supabase-admin';
import {
  getPlatformConfigCached,
  invalidatePlatformConfigCache,
} from '@/lib/redis';
import { SESSION_QUIZZES } from '@/data/learning/quizzes';
import { SessionQuiz, QuizQuestion } from '@/data/learning/types';

/**
 * Merges a baseline static quiz with any dynamic administrative overrides.
 */
export function mergeQuizWithOverride(
  base: SessionQuiz,
  override?: Partial<SessionQuiz>
): SessionQuiz {
  if (!override) {
    return {
      ...base,
      isLocked: false,
    };
  }

  const mergedQuestions: QuizQuestion[] =
    override.questions && Array.isArray(override.questions) && override.questions.length > 0
      ? override.questions
      : base.questions;

  return {
    ...base,
    sessionId: base.sessionId,
    title:
      override.title !== undefined && override.title.trim() !== ''
        ? override.title.trim()
        : base.title,
    passingScore:
      typeof override.passingScore === 'number' && override.passingScore > 0
        ? override.passingScore
        : base.passingScore,
    isLocked: Boolean(override.isLocked),
    questions: mergedQuestions,
    updatedAt: override.updatedAt,
    updatedBy: override.updatedBy,
  };
}

/**
 * Fetch all quiz overrides from Supabase platform_config table (with Redis Cache-Aside).
 */
export async function getQuizOverrides(): Promise<Record<string, Partial<SessionQuiz>>> {
  try {
    return await getPlatformConfigCached<Record<string, Partial<SessionQuiz>>>(
      'quiz_overrides',
      async () => {
        const { data, error } = await supabaseAdmin
          .from('platform_config')
          .select('value')
          .eq('key', 'quiz_overrides')
          .limit(1);

        if (error) {
          console.warn('[Quizzes] Error querying quiz_overrides:', error);
          return {};
        }

        return (data?.[0]?.value as Record<string, Partial<SessionQuiz>>) || {};
      }
    );
  } catch (err) {
    console.error('[Quizzes] Failed to fetch quiz overrides:', err);
    return {};
  }
}

/**
 * Strips sensitive evaluation fields (correctIndex, explanation, administrative audit metadata)
 * from quiz objects before transmission to student clients.
 */
export function sanitizeQuizForStudent(quiz: SessionQuiz): SessionQuiz {
  if (quiz.isLocked) {
    return {
      sessionId: quiz.sessionId,
      title: quiz.title,
      passingScore: quiz.passingScore,
      isLocked: true,
      questions: [],
    };
  }

  return {
    sessionId: quiz.sessionId,
    title: quiz.title,
    passingScore: quiz.passingScore,
    isLocked: false,
    questions: (quiz.questions || []).map((q) => ({
      id: q.id,
      question: q.question,
      options: q.options,
    })),
  };
}

/**
 * Retrieves all quizzes merged with dynamic overrides.
 * If admin is false (student view), questions are sanitized (correctIndex and explanation stripped),
 * locked quizzes have questions set to [], and overrides are omitted.
 */
export async function getAllQuizzes(options?: {
  admin?: boolean;
}): Promise<{
  quizzes: Record<string, SessionQuiz>;
  overrides: Record<string, Partial<SessionQuiz>>;
}> {
  const overrides = await getQuizOverrides();
  const merged: Record<string, SessionQuiz> = {};

  // 1. Process all known default quizzes
  for (const [sId, baseQuiz] of Object.entries(SESSION_QUIZZES)) {
    const quiz = mergeQuizWithOverride(baseQuiz, overrides[sId]);
    if (options?.admin) {
      merged[sId] = quiz;
    } else {
      merged[sId] = sanitizeQuizForStudent(quiz);
    }
  }

  // 2. Process any additional sessions configured exclusively via admin overrides
  for (const [sId, override] of Object.entries(overrides)) {
    if (!merged[sId]) {
      const customQuiz: SessionQuiz = {
        sessionId: sId,
        title: override.title || `Session ${sId} Concept Check`,
        passingScore: override.passingScore || 75,
        questions: override.questions || [],
        isLocked: Boolean(override.isLocked),
        updatedAt: override.updatedAt,
        updatedBy: override.updatedBy,
      };

      if (options?.admin) {
        merged[sId] = customQuiz;
      } else {
        merged[sId] = sanitizeQuizForStudent(customQuiz);
      }
    }
  }

  return {
    quizzes: merged,
    overrides: options?.admin ? overrides : {},
  };
}

/**
 * Retrieves a single session quiz by ID.
 * If admin is false and the quiz is locked, questions will be stripped.
 */
export async function getQuizForSession(
  sessionId: string,
  options?: { admin?: boolean }
): Promise<SessionQuiz | null> {
  const { quizzes } = await getAllQuizzes(options);
  return quizzes[sessionId] || null;
}

/**
 * Upserts quiz overrides for a session into platform_config and invalidates cache.
 */
export async function saveQuizOverride(
  sessionId: string,
  updates: Partial<SessionQuiz>,
  userEmail?: string
): Promise<{ success: boolean; overrides: Record<string, any> }> {
  // Direct fetch from Supabase to prevent concurrency race conditions
  const { data: currentRecords } = await supabaseAdmin
    .from('platform_config')
    .select('value')
    .eq('key', 'quiz_overrides')
    .limit(1);

  const currentOverrides: Record<string, any> = currentRecords?.[0]?.value || {};

  currentOverrides[sessionId] = {
    ...(currentOverrides[sessionId] || {}),
    ...updates,
    updatedAt: new Date().toISOString(),
    updatedBy: userEmail || 'admin',
  };

  const { error: upsertError } = await supabaseAdmin
    .from('platform_config')
    .upsert({
      key: 'quiz_overrides',
      value: currentOverrides,
      updated_at: new Date().toISOString(),
    });

  if (upsertError) throw upsertError;

  // Invalidate Redis caches
  await invalidatePlatformConfigCache('quiz_overrides');
  await invalidatePlatformConfigCache();

  return { success: true, overrides: currentOverrides };
}

/**
 * Reverts a session quiz override back to its static default.
 */
export async function resetQuizOverride(
  sessionId: string
): Promise<{ success: boolean; overrides: Record<string, any> }> {
  const { data: currentRecords } = await supabaseAdmin
    .from('platform_config')
    .select('value')
    .eq('key', 'quiz_overrides')
    .limit(1);

  const currentOverrides: Record<string, any> = currentRecords?.[0]?.value || {};
  delete currentOverrides[sessionId];

  const { error: upsertError } = await supabaseAdmin
    .from('platform_config')
    .upsert({
      key: 'quiz_overrides',
      value: currentOverrides,
      updated_at: new Date().toISOString(),
    });

  if (upsertError) throw upsertError;

  await invalidatePlatformConfigCache('quiz_overrides');
  await invalidatePlatformConfigCache();

  return { success: true, overrides: currentOverrides };
}
