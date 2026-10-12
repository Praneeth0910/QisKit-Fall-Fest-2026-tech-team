import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import {
  checkCompetitionStatus,
  checkRateLimit,
  dispatchJudgeEvaluation,
} from '@/lib/qiskit-judge';
import { QISKIT_CHALLENGES } from '@/data/qiskit/challenges';

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate user
    const session = await getServerSession();
    if (!session || !session.email) {
      return NextResponse.json(
        { success: false, error: 'Authentication required. Please sign in to run code.' },
        { status: 401 }
      );
    }

    // 2. Server-authoritative competition window check
    const statusCheck = await checkCompetitionStatus();
    if (!statusCheck.allowed && !session.isAdmin) {
      return NextResponse.json(
        { success: false, error: statusCheck.reason },
        { status: 403 }
      );
    }

    // 3. Parse and validate body
    const body = await req.json();
    const { problemId, code } = body;

    if (!problemId || typeof problemId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Problem ID is required.' },
        { status: 400 }
      );
    }

    const normProblemId = problemId.trim().toUpperCase();
    const challengeExists = QISKIT_CHALLENGES.some((c) => c.id === normProblemId);
    if (!challengeExists) {
      return NextResponse.json(
        { success: false, error: `Invalid problem ID: ${problemId}` },
        { status: 400 }
      );
    }

    if (typeof code !== 'string' || !code.trim()) {
      return NextResponse.json(
        { success: false, error: 'Source code cannot be empty.' },
        { status: 400 }
      );
    }

    if (code.length > 64 * 1024) {
      return NextResponse.json(
        { success: false, error: 'Source code exceeds maximum permitted size of 64 KB.' },
        { status: 400 }
      );
    }

    // 4. Rate Limiting check
    const rateLimit = await checkRateLimit(session.email, 'run', normProblemId);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, error: rateLimit.message },
        { status: 429 }
      );
    }

    // 5. Dispatch code execution in 'run' mode (public tests only)
    const result = await dispatchJudgeEvaluation(normProblemId, code, 'run');

    return NextResponse.json({
      success: result.success,
      stdout: result.stdout,
      stderr: result.stderr,
      error: result.error_message,
      executionTimeMs: result.execution_time_ms,
      publicResults: result.public_results,
      passedTests: result.passed_tests,
      totalTests: result.total_tests,
    });
  } catch (err: any) {
    console.error('[API /api/qiskit/run] Error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error while executing code.' },
      { status: 500 }
    );
  }
}
