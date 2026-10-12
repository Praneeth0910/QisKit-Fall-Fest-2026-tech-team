import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { fallbackSubmissions } from '@/lib/qiskit-judge';
import { redis } from '@/lib/redis';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session || !session.email) {
      return NextResponse.json(
        { success: false, error: 'Authentication required.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const problemId = searchParams.get('problemId')?.toUpperCase();
    const userEmail = session.email.toLowerCase().trim();

    const submissionsMap = new Map<string, any>();

    // 1. Fetch from Supabase if table exists
    try {
      let query = supabaseAdmin
        .from('coding_submissions')
        .select('id, challenge_id, status, score, max_score, passed_tests, total_tests, execution_time_ms, submitted_at, error_message')
        .eq('user_email', userEmail)
        .order('submitted_at', { ascending: false });

      if (problemId) {
        query = query.eq('challenge_id', problemId);
      }

      const { data: dbSubs, error } = await query;
      if (!error && Array.isArray(dbSubs)) {
        for (const s of dbSubs) {
          submissionsMap.set(s.id, {
            id: s.id,
            challengeId: s.challenge_id,
            status: s.status,
            score: s.score || 0,
            maxScore: s.max_score || 0,
            passedTests: s.passed_tests || 0,
            totalTests: s.total_tests || 0,
            executionTimeMs: s.execution_time_ms || 0,
            submittedAt: s.submitted_at,
            errorMessage: s.error_message,
          });
        }
      }
    } catch {}

    // 2. Supplement from in-memory fallback
    for (const [id, s] of fallbackSubmissions.entries()) {
      if (s.user_email === userEmail) {
        if (!problemId || s.challenge_id === problemId) {
          if (!submissionsMap.has(id)) {
            submissionsMap.set(id, {
              id: s.id,
              challengeId: s.challenge_id,
              status: s.status,
              score: s.score || 0,
              maxScore: s.max_score || 0,
              passedTests: s.passed_tests || 0,
              totalTests: s.total_tests || 0,
              executionTimeMs: s.execution_time_ms || 0,
              submittedAt: s.submitted_at,
              errorMessage: s.error_message,
            });
          }
        }
      }
    }

    // 3. Supplement from Redis if available
    if (redis) {
      try {
        const subIds = await redis.lrange(`coding:user_subs:${userEmail}`, 0, 49);
        for (const id of subIds || []) {
          if (!submissionsMap.has(id)) {
            const raw = await redis.get<string>(`coding:sub:${id}`);
            if (raw) {
              const s = typeof raw === 'string' ? JSON.parse(raw) : raw;
              if (s && (!problemId || s.challenge_id === problemId)) {
                submissionsMap.set(id, {
                  id: s.id,
                  challengeId: s.challenge_id,
                  status: s.status,
                  score: s.score || 0,
                  maxScore: s.max_score || 0,
                  passedTests: s.passed_tests || 0,
                  totalTests: s.total_tests || 0,
                  executionTimeMs: s.execution_time_ms || 0,
                  submittedAt: s.submitted_at,
                  errorMessage: s.error_message,
                });
              }
            }
          }
        }
      } catch {}
    }

    const list = Array.from(submissionsMap.values()).sort(
      (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
    );

    return NextResponse.json({
      success: true,
      submissions: list,
    });
  } catch (err: any) {
    console.error('[API /api/qiskit/submissions] Error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error.' },
      { status: 500 }
    );
  }
}
