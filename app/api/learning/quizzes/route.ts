import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import {
  getAllQuizzes,
  saveQuizOverride,
  resetQuizOverride,
} from '@/lib/quizzes';
import { SessionQuiz } from '@/data/learning/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId') || searchParams.get('id');
    const wantAdmin = searchParams.get('admin') === 'true';

    // Verify admin privileges if requesting admin-level view (which reveals questions for locked quizzes)
    const session = await getServerSession();
    const isAdmin = Boolean(session?.isAdmin);
    const allowAdminView = wantAdmin && isAdmin;

    const { quizzes, overrides } = await getAllQuizzes({ admin: allowAdminView });

    const cacheHeaders = allowAdminView
      ? { 'Cache-Control': 'no-store' }
      : { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' };

    if (sessionId) {
      const quiz = quizzes[sessionId];
      if (!quiz) {
        return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
      }

      return NextResponse.json(
        {
          success: true,
          quiz,
          override: overrides[sessionId] || null,
          isLocked: Boolean(quiz.isLocked),
        },
        { headers: cacheHeaders }
      );
    }

    return NextResponse.json(
      {
        success: true,
        quizzes,
        overrides,
      },
      { headers: cacheHeaders }
    );
  } catch (error: any) {
    console.error('[API /api/learning/quizzes] Error fetching quizzes:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch quizzes' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session || !session.isAdmin) {
    return NextResponse.json(
      { error: 'Unauthorized. Admin access required.' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { sessionId, updates, reset, toggleLock, isLocked } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId is required' },
        { status: 400 }
      );
    }

    if (reset) {
      const { overrides } = await resetQuizOverride(sessionId);
      const { quizzes } = await getAllQuizzes({ admin: true });
      return NextResponse.json({
        success: true,
        message: `Reverted quiz for ${sessionId} to default curriculum settings.`,
        quiz: quizzes[sessionId],
        quizzes,
        overrides,
      });
    }

    if (toggleLock !== undefined || isLocked !== undefined) {
      const newLockState = isLocked !== undefined ? Boolean(isLocked) : true;
      const { overrides } = await saveQuizOverride(
        sessionId,
        { isLocked: newLockState },
        session.email
      );
      const { quizzes } = await getAllQuizzes({ admin: true });
      return NextResponse.json({
        success: true,
        message: `Quiz for ${sessionId} is now ${newLockState ? 'LOCKED (Coming Soon)' : 'UNLOCKED (Live)'}.`,
        quiz: quizzes[sessionId],
        quizzes,
        overrides,
      });
    }

    if (updates) {
      // Validate questions structure if provided
      if (updates.questions && Array.isArray(updates.questions)) {
        for (let i = 0; i < updates.questions.length; i++) {
          const q = updates.questions[i];
          if (!q.question || typeof q.question !== 'string' || !q.question.trim()) {
            return NextResponse.json(
              { error: `Question #${i + 1} text cannot be empty.` },
              { status: 400 }
            );
          }
          if (!Array.isArray(q.options) || q.options.length < 2) {
            return NextResponse.json(
              { error: `Question #${i + 1} must have at least 2 options.` },
              { status: 400 }
            );
          }
          if (
            typeof q.correctIndex !== 'number' ||
            q.correctIndex < 0 ||
            q.correctIndex >= q.options.length
          ) {
            return NextResponse.json(
              { error: `Question #${i + 1} has an invalid correct answer choice.` },
              { status: 400 }
            );
          }
        }
      }

      const cleanUpdates: Partial<SessionQuiz> = {
        ...(updates.title !== undefined ? { title: String(updates.title).trim() } : {}),
        ...(updates.passingScore !== undefined
          ? { passingScore: Math.max(1, Math.min(100, Number(updates.passingScore) || 75)) }
          : {}),
        ...(updates.isLocked !== undefined ? { isLocked: Boolean(updates.isLocked) } : {}),
        ...(updates.questions !== undefined ? { questions: updates.questions } : {}),
      };

      const { overrides } = await saveQuizOverride(sessionId, cleanUpdates, session.email);
      const { quizzes } = await getAllQuizzes({ admin: true });

      return NextResponse.json({
        success: true,
        message: `Successfully updated quiz for ${sessionId}.`,
        quiz: quizzes[sessionId],
        quizzes,
        overrides,
      });
    }

    return NextResponse.json(
      { error: 'Invalid request: updates or reset parameter expected.' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('[API /api/learning/quizzes] Error updating quiz:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to update quiz' },
      { status: 500 }
    );
  }
}
