import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import {
  getPlatformConfigCached,
  getUserProgressCached,
  invalidateUserProgressCache,
} from '@/lib/redis';
import { CURRICULUM_SESSIONS } from '@/data/learning/curriculum';
import { getQuizForSession } from '@/lib/quizzes';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const normalizedEmail = session.email.trim().toLowerCase();

  try {
    // 1. Check if global lock override is active (Cache-Aside with 1-hr TTL)
    const overrideValue = await getPlatformConfigCached<{ enabled?: boolean } | null>(
      'lecture_lock_override',
      async () => {
        const { data } = await supabase
          .from('platform_config')
          .select('value')
          .eq('key', 'lecture_lock_override')
          .limit(1);
        return data?.[0]?.value ?? null;
      }
    );

    const isLockOverridden = overrideValue?.enabled === true;

    // 2. Fetch user progress records (Cache-Aside with 10-min TTL)
    const records = await getUserProgressCached<any[]>(
      normalizedEmail,
      async () => {
        const { data, error } = await supabase
          .from('user_progress')
          .select('*')
          .ilike('email', normalizedEmail);

        if (error) throw error;
        return data || [];
      }
    );

    const progressMap = new Map(
      (records || []).map((r: any) => [r.session_id, r])
    );

    // 3. Compute locked/unlocked state sequentially
    const computedProgress: Record<
      string,
      {
        unlocked: boolean;
        videoCompleted: boolean;
        quizPassed: boolean;
        quizScore: number;
        quizAttempts: number;
        completedAt: string | null;
      }
    > = {};

    let previousSessionCompleted = true; // Session 1 starts unlocked

    for (let i = 0; i < CURRICULUM_SESSIONS.length; i++) {
      const sess = CURRICULUM_SESSIONS[i];
      const record = progressMap.get(sess.id);
      const isQuizPassed = record?.quiz_passed === true;
      const isVideoDone = record?.video_completed === true || isQuizPassed;
      const isDone = isVideoDone && isQuizPassed;

      const isUnlocked = isLockOverridden || previousSessionCompleted;

      computedProgress[sess.id] = {
        unlocked: isUnlocked,
        videoCompleted: isVideoDone,
        quizPassed: isQuizPassed,
        quizScore: record?.quiz_score || 0,
        quizAttempts: record?.quiz_attempts || 0,
        completedAt: record?.completed_at || null,
      };

      // In non-override mode, next session only unlocks if this one was finished
      previousSessionCompleted = isDone;
    }

    return NextResponse.json(
      {
        email: normalizedEmail,
        isLockOverridden,
        progress: computedProgress,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    );
  } catch (error) {
    console.error('Error fetching progress:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user progress' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const normalizedEmail = session.email.trim().toLowerCase();

  try {
    const body = await request.json();
    const { sessionId, action, userAnswers } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId is required' },
        { status: 400 }
      );
    }

    if (action === 'mark_video' || action === 'unmark_video') {
      const isCompleted = action === 'mark_video' ? (body.completed ?? true) : false;
      // Query existing progress to avoid regressing existing quiz state
      const { data: existingRows } = await supabase
        .from('user_progress')
        .select('*')
        .ilike('email', normalizedEmail)
        .eq('session_id', sessionId)
        .limit(1);
      const existingProgress = existingRows?.[0] || null;

      const { data: upsertedRows, error } = await supabase
        .from('user_progress')
        .upsert(
          {
            email: normalizedEmail,
            session_id: sessionId,
            video_completed: isCompleted,
            quiz_passed: existingProgress?.quiz_passed ?? false,
            quiz_score: existingProgress?.quiz_score ?? 0,
            quiz_attempts: existingProgress?.quiz_attempts ?? 0,
            completed_at: existingProgress?.quiz_passed
              ? existingProgress?.completed_at || new Date().toISOString()
              : null,
          },
          { onConflict: 'email,session_id' }
        )
        .select();

      if (error) throw error;
      const data = upsertedRows?.[0] || null;

      // Invalidate cache-aside progress cache
      await invalidateUserProgressCache(normalizedEmail);

      return NextResponse.json({ success: true, data });
    }

    if (action === 'submit_quiz') {
      const quiz = await getQuizForSession(sessionId, { admin: true });
      if (!quiz || !Array.isArray(quiz.questions) || quiz.questions.length === 0) {
        return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
      }

      if (quiz.isLocked) {
        return NextResponse.json(
          { error: 'This quiz is currently locked and not accepting submissions.' },
          { status: 403 }
        );
      }

      // Grade the quiz
      let correctCount = 0;
      const questionResults: Record<string, boolean> = {};

      quiz.questions.forEach((q) => {
        const rawSelected = userAnswers?.[q.id];
        const selected = rawSelected !== undefined && rawSelected !== null ? Number(rawSelected) : -1;
        const isCorrect = selected === Number(q.correctIndex);
        if (isCorrect) correctCount++;
        questionResults[q.id] = isCorrect;
      });

      const scorePercent = Math.round(
        (correctCount / quiz.questions.length) * 100
      );
      const passed = scorePercent >= quiz.passingScore;

      // Query existing progress to prevent regression of passing status
      const { data: existingRows } = await supabase
        .from('user_progress')
        .select('*')
        .ilike('email', normalizedEmail)
        .eq('session_id', sessionId)
        .limit(1);
      const existingProgress = existingRows?.[0] || null;

      const nextAttempts = (existingProgress?.quiz_attempts || 0) + 1;
      const finalPassed = passed || existingProgress?.quiz_passed === true;
      const finalVideoCompleted =
        existingProgress?.video_completed === true || passed;
      const finalScore = Math.max(scorePercent, existingProgress?.quiz_score || 0);

      const { data: upsertedRows, error } = await supabase
        .from('user_progress')
        .upsert(
          {
            email: normalizedEmail,
            session_id: sessionId,
            quiz_score: finalScore,
            quiz_passed: finalPassed,
            quiz_attempts: nextAttempts,
            video_completed: finalVideoCompleted,
            completed_at: finalPassed
              ? existingProgress?.completed_at || new Date().toISOString()
              : null,
          },
          { onConflict: 'email,session_id' }
        )
        .select();

      if (error) throw error;
      const data = upsertedRows?.[0] || null;

      // Invalidate cache-aside progress cache
      await invalidateUserProgressCache(normalizedEmail);

      // Build safe reviews based on passing status:
      // - If student passed (now or previously), reveal full answer keys and explanations.
      // - If student got a question right, provide explanation to reinforce learning.
      // - If student got a question wrong AND has not yet passed, withhold the answer key so they must review course material before retrying.
      const reviews: Record<
        string,
        {
          correctIndex?: number;
          correctOptionText?: string;
          explanation?: string;
          hint?: string;
        }
      > = {};

      quiz.questions.forEach((q) => {
        const isCorrect = Boolean(questionResults[q.id]);
        const cIdx = typeof q.correctIndex === 'number' ? q.correctIndex : 0;
        if (finalPassed) {
          reviews[q.id] = {
            correctIndex: cIdx,
            correctOptionText: q.options[cIdx] || '',
            explanation: q.explanation || '',
          };
        } else if (isCorrect) {
          reviews[q.id] = {
            correctIndex: cIdx,
            correctOptionText: q.options[cIdx] || '',
            explanation: q.explanation || '',
          };
        } else {
          reviews[q.id] = {
            hint: 'Review the lecture transcript and session slides to locate this concept.',
          };
        }
      });

      return NextResponse.json({
        success: true,
        scorePercent,
        passed,
        passingScore: quiz.passingScore,
        correctCount,
        totalQuestions: quiz.questions.length,
        questionResults,
        reviews,
        attempts: nextAttempts,
        data,
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error updating progress:', error);
    return NextResponse.json(
      { error: 'Failed to update progress' },
      { status: 500 }
    );
  }
}
