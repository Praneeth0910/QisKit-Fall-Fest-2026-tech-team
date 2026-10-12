import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { invalidateCache } from '@/lib/redis';
import {
  SubmissionEvaluation,
  EvaluationCategory,
  EvaluationStatus,
  EvaluationRubric,
  EvaluationDownload,
  EvaluationComment,
} from '@/types/evaluations';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const session = await getServerSession();
  if (!session || !session.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');
  const targetId = searchParams.get('target_id');

  try {
    let query = supabaseAdmin
      .from('submission_evaluations')
      .select('*')
      .order('updated_at', { ascending: false });

    if (category && category !== 'all') {
      query = query.eq('category', category);
    }
    if (targetId) {
      query = query.eq('target_id', targetId);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Build key-value map keyed by target_id for fast O(1) lookup
    const mapByTargetId: Record<string, SubmissionEvaluation> = {};
    (data || []).forEach((row: any) => {
      mapByTargetId[row.target_id] = row as SubmissionEvaluation;
    });

    return NextResponse.json({
      success: true,
      evaluations: data || [],
      map: mapByTargetId,
    });
  } catch (err: any) {
    console.error('Error fetching evaluations:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to fetch evaluations' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session || !session.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const {
      category,
      target_id,
      action,
      status,
      score,
      rubric_scores,
      is_next_round,
      comment_text,
    } = body;

    if (!category || !target_id || !action) {
      return NextResponse.json(
        { error: 'category, target_id, and action are required.' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const adminEmail = session.email;
    const adminName = session.fullName || adminEmail.split('@')[0];

    // Fetch existing record
    const { data: existing } = await supabaseAdmin
      .from('submission_evaluations')
      .select('*')
      .eq('category', category)
      .eq('target_id', target_id)
      .maybeSingle();

    let recordToSave: Partial<SubmissionEvaluation> = {
      category: category as EvaluationCategory,
      target_id: String(target_id),
      updated_at: now,
      last_evaluated_by_email: adminEmail,
      last_evaluated_by_name: adminName,
    };

    if (existing) {
      recordToSave = {
        ...existing,
        ...recordToSave,
      };
    } else {
      recordToSave = {
        category: category as EvaluationCategory,
        target_id: String(target_id),
        is_next_round: false,
        status: 'pending' as EvaluationStatus,
        score: null,
        max_score: 100,
        rubric_scores: {},
        downloaded: false,
        downloaded_by: null,
        downloaded_at: null,
        downloads: [],
        comments: [],
        created_at: now,
        updated_at: now,
        last_evaluated_by_email: adminEmail,
        last_evaluated_by_name: adminName,
      };
    }

    if (action === 'mark_download') {
      const existingDownloads: EvaluationDownload[] = Array.isArray(recordToSave.downloads)
        ? recordToSave.downloads
        : [];

      const newDownloadEntry: EvaluationDownload = {
        evaluator_email: adminEmail,
        evaluator_name: adminName,
        downloaded_at: now,
      };

      recordToSave.downloaded = true;
      recordToSave.downloaded_by = adminName;
      recordToSave.downloaded_at = now;
      recordToSave.downloads = [newDownloadEntry, ...existingDownloads];

      if (recordToSave.status === 'pending') {
        recordToSave.status = 'under_review';
      }
    } else if (action === 'toggle_next_round') {
      const currentNextRound = Boolean(recordToSave.is_next_round);
      const nextVal = !currentNextRound;
      recordToSave.is_next_round = nextVal;
      if (nextVal) {
        if (recordToSave.status === 'pending' || recordToSave.status === 'under_review' || recordToSave.status === 'rejected') {
          recordToSave.status = 'shortlisted';
        }
      } else {
        if (recordToSave.status === 'shortlisted') {
          recordToSave.status = 'under_review';
        }
      }
    } else if (action === 'toggle_reject') {
      const isCurrentlyRejected = recordToSave.status === 'rejected';
      if (isCurrentlyRejected) {
        // Un-reject: return to under_review if already inspected, or pending
        recordToSave.status = recordToSave.downloaded ? 'under_review' : 'pending';
      } else {
        // Reject: mark as rejected and clear next round shortlist
        recordToSave.status = 'rejected';
        recordToSave.is_next_round = false;
      }
    } else if (action === 'update_evaluation') {
      if (status !== undefined) {
        recordToSave.status = status as EvaluationStatus;
        if (status === 'rejected') {
          recordToSave.is_next_round = false;
        }
      }
      if (score !== undefined) recordToSave.score = score !== null ? Number(score) : null;
      if (rubric_scores !== undefined) recordToSave.rubric_scores = rubric_scores as EvaluationRubric;
      if (is_next_round !== undefined) {
        recordToSave.is_next_round = Boolean(is_next_round);
        if (recordToSave.is_next_round && recordToSave.status === 'rejected') {
          recordToSave.status = 'shortlisted';
        }
      }
    } else if (action === 'add_comment') {
      if (!comment_text || !comment_text.trim()) {
        return NextResponse.json({ error: 'comment_text cannot be empty.' }, { status: 400 });
      }

      const existingComments: EvaluationComment[] = Array.isArray(recordToSave.comments)
        ? recordToSave.comments
        : [];

      const newComment: EvaluationComment = {
        id: crypto.randomUUID(),
        evaluator_email: adminEmail,
        evaluator_name: adminName,
        text: comment_text.trim(),
        created_at: now,
      };

      recordToSave.comments = [...existingComments, newComment];
    } else {
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    // Upsert into Supabase
    const { data: saved, error: upsertErr } = await supabaseAdmin
      .from('submission_evaluations')
      .upsert(recordToSave, { onConflict: 'category,target_id' })
      .select('*')
      .single();

    if (upsertErr) {
      throw upsertErr;
    }

    // Invalidate Redis caches
    await invalidateCache([
      'admin:hackathon_details',
      'admin:stats_overview',
      'admin:config_and_stats',
    ]);

    return NextResponse.json({
      success: true,
      evaluation: saved as SubmissionEvaluation,
      message: 'Evaluation updated and synchronized successfully.',
    });
  } catch (err: any) {
    console.error('Error in POST /api/admin/evaluations:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to update evaluation' },
      { status: 500 }
    );
  }
}
