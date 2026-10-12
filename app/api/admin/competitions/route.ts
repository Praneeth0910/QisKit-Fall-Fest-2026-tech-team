import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { invalidateCompetitionSubmissionsCache } from '@/lib/redis';
import { SubmissionEvaluation } from '@/types/evaluations';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const session = await getServerSession();
  if (!session || !session.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const typeFilter = searchParams.get('type') || 'all';
  const searchQuery = (searchParams.get('search') || '').trim().toLowerCase();

  try {
    let query = supabaseAdmin
      .from('competition_submissions')
      .select('id, email, competition_type, submission_url, submission_title, notes, status, submitted_at')
      .order('submitted_at', { ascending: false });

    if (typeFilter && typeFilter !== 'all') {
      query = query.eq('competition_type', typeFilter);
    }

    const { data: rawSubmissions, error } = await query;
    if (error) throw error;

    const emails = Array.from(new Set((rawSubmissions || []).map((s) => s.email.toLowerCase())));

    // Fetch participant full names from allowed_emails
    const nameMap: Record<string, string> = {};
    if (emails.length > 0) {
      const { data: allowedUsers } = await supabaseAdmin
        .from('allowed_emails')
        .select('email, full_name')
        .in('email', emails);

      (allowedUsers || []).forEach((u) => {
        if (u.email) {
          nameMap[u.email.toLowerCase()] = u.full_name || '';
        }
      });
    }

    // Fetch evaluations for creative competitions
    const { data: rawEvals } = await supabaseAdmin
      .from('submission_evaluations')
      .select('*')
      .in('category', ['reels', 'poster', 'essay']);

    const evalMap: Record<string, SubmissionEvaluation> = {};
    (rawEvals || []).forEach((ev: any) => {
      evalMap[ev.target_id] = ev as SubmissionEvaluation;
    });

    // Enrich submissions
    const enriched = (rawSubmissions || []).map((sub) => {
      const normalizedEmail = sub.email.toLowerCase();
      const fullName = nameMap[normalizedEmail] || '';
      const url = sub.submission_url || '';
      const isDocument =
        sub.notes === 'file_upload' ||
        url.includes('/storage/v1/object/public/media/competition-submissions/') ||
        /\.(pdf|docx)($|\?)/i.test(url);

      let documentType: 'pdf' | 'docx' | 'link' = 'link';
      if (isDocument) {
        if (/\.docx($|\?)/i.test(url)) {
          documentType = 'docx';
        } else {
          documentType = 'pdf';
        }
      }

      const evalData = evalMap[sub.id] || null;

      return {
        ...sub,
        fullName,
        isDocument,
        documentType,
        evaluation: evalData,
      };
    });

    // Apply search filter if present
    const filtered = searchQuery
      ? enriched.filter((sub) => {
          return (
            sub.email.toLowerCase().includes(searchQuery) ||
            sub.fullName.toLowerCase().includes(searchQuery) ||
            (sub.submission_title && sub.submission_title.toLowerCase().includes(searchQuery)) ||
            (sub.notes && sub.notes.toLowerCase().includes(searchQuery)) ||
            sub.competition_type.toLowerCase().includes(searchQuery)
          );
        })
      : enriched;

    // Stats
    const stats = {
      total: enriched.length,
      reels: enriched.filter((s) => s.competition_type === 'reels').length,
      poster: enriched.filter((s) => s.competition_type === 'poster').length,
      essay: enriched.filter((s) => s.competition_type === 'essay').length,
      documentsCount: enriched.filter((s) => s.isDocument).length,
      shortlistedCount: enriched.filter((s) => s.evaluation?.is_next_round).length,
      rejectedCount: enriched.filter((s) => s.evaluation?.status === 'rejected').length,
      evaluatedCount: enriched.filter((s) => s.evaluation && s.evaluation.status !== 'pending').length,
      downloadedCount: enriched.filter((s) => s.evaluation?.downloaded).length,
    };

    return NextResponse.json({
      submissions: filtered,
      stats,
    });
  } catch (error) {
    console.error('Error fetching admin competitions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch competition submissions' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession();
  if (!session || !session.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const submissionId = searchParams.get('id');

    if (!submissionId) {
      return NextResponse.json({ error: 'Submission ID is required' }, { status: 400 });
    }

    // Get submission first to know user email for cache invalidation
    const { data: sub } = await supabaseAdmin
      .from('competition_submissions')
      .select('email, competition_type')
      .eq('id', submissionId)
      .maybeSingle();

    const { error: deleteError } = await supabaseAdmin
      .from('competition_submissions')
      .delete()
      .eq('id', submissionId);

    if (deleteError) throw deleteError;

    if (sub?.email) {
      await invalidateCompetitionSubmissionsCache(sub.email);
    }

    return NextResponse.json({
      success: true,
      message: 'Submission removed successfully. Participant can now resubmit.',
    });
  } catch (error) {
    console.error('Error deleting submission:', error);
    return NextResponse.json(
      { error: 'Failed to delete submission' },
      { status: 500 }
    );
  }
}
