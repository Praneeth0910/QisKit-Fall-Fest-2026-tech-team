import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getSubmissionWithFallback } from '@/lib/qiskit-judge';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ submissionId: string }> }
) {
  try {
    const { submissionId } = await params;

    // 1. Authenticate user
    const session = await getServerSession();
    if (!session || !session.email) {
      return NextResponse.json(
        { success: false, error: 'Authentication required.' },
        { status: 401 }
      );
    }

    if (!submissionId) {
      return NextResponse.json(
        { success: false, error: 'Submission ID is required.' },
        { status: 400 }
      );
    }

    // 2. Fetch submission record (Supabase with memory/redis fallback)
    let submission: any = null;

    try {
      const { data, error } = await supabaseAdmin
        .from('coding_submissions')
        .select('*')
        .eq('id', submissionId)
        .single();
      if (!error && data) {
        submission = data;
      }
    } catch {}

    if (!submission) {
      submission = await getSubmissionWithFallback(submissionId);
    }

    if (!submission) {
      return NextResponse.json(
        { success: false, error: 'Submission not found.' },
        { status: 404 }
      );
    }


    // 3. Authorization check: participant can only view their own submission (unless admin)
    const normUserEmail = session.email.trim().toLowerCase();
    const subEmail = submission.user_email.trim().toLowerCase();

    if (normUserEmail !== subEmail && !session.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized to view this submission.' },
        { status: 403 }
      );
    }

    // 4. If submission is still queued or running, return status early
    if (submission.status === 'queued' || submission.status === 'running') {
      return NextResponse.json({
        success: true,
        submissionId: submission.id,
        status: submission.status,
      });
    }

    // 5. Fetch test results breakdown
    const { data: testResults } = await supabaseAdmin
      .from('coding_test_results')
      .select('test_type, test_number, test_name, passed, execution_time_ms, error_message')
      .eq('submission_id', submissionId)
      .order('test_number', { ascending: true });

    const publicTests = (testResults || []).filter((t) => t.test_type === 'public');
    const hiddenTests = (testResults || []).filter((t) => t.test_type === 'hidden');

    return NextResponse.json({
      success: true,
      submissionId: submission.id,
      status: submission.status,
      score: submission.score,
      maxScore: submission.max_score,
      passedTests: submission.passed_tests,
      totalTests: submission.total_tests,
      executionTimeMs: submission.execution_time_ms,
      stdout: submission.stdout,
      stderr: submission.stderr,
      errorMessage: submission.error_message,
      submittedAt: submission.submitted_at,
      completedAt: submission.completed_at,
      publicResults: publicTests.length > 0 ? publicTests : (submission.public_results || []),
      hiddenResults: hiddenTests.length > 0 ? hiddenTests : (submission.hidden_results || []),
    });
  } catch (err: any) {
    console.error('[API /api/qiskit/submission/[id]] Error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error.' },
      { status: 500 }
    );
  }
}
