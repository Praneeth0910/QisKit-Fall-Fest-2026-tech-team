import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { QISKIT_CHALLENGES } from '@/data/qiskit/challenges';
import { getChallengeConfig, CompetitionConfig } from '@/lib/qiskit-judge';
import { invalidateCache, invalidatePlatformConfigCache } from '@/lib/redis';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session || !session.isAdmin) {
      return NextResponse.json({ success: false, error: 'Unauthorized admin access' }, { status: 403 });
    }

    const config = await getChallengeConfig();

    // 1. Fetch all submissions
    const { data: rawSubmissions, error: subErr } = await supabaseAdmin
      .from('coding_submissions')
      .select('id, user_email, challenge_id, source_code, status, score, max_score, passed_tests, total_tests, execution_time_ms, error_message, stdout, stderr, submitted_at')
      .order('submitted_at', { ascending: false })
      .limit(100);

    if (subErr) {
      return NextResponse.json({ success: false, error: subErr.message }, { status: 500 });
    }

    // Fetch evaluations for coding challenge
    const { data: rawEvals } = await supabaseAdmin
      .from('submission_evaluations')
      .select('*')
      .eq('category', 'coding');

    const evalMap: Record<string, any> = {};
    (rawEvals || []).forEach((ev: any) => {
      evalMap[ev.target_id] = ev;
    });

    const submissions = (rawSubmissions || []).map((s) => ({
      ...s,
      evaluation: evalMap[s.id] || null,
    }));

    // 2. Compute problem-wise statistics
    const problemStats = QISKIT_CHALLENGES.map((ch) => {
      const problemSubs = (submissions || []).filter((s) => s.challenge_id === ch.id);
      const totalCount = problemSubs.length;
      const solvedSubs = problemSubs.filter((s) => (s.score || 0) >= ch.points);
      const uniqueParticipants = new Set(problemSubs.map((s) => s.user_email)).size;
      const uniqueSolvers = new Set(solvedSubs.map((s) => s.user_email)).size;

      return {
        id: ch.id,
        problemCode: ch.problemCode,
        title: ch.title,
        points: ch.points,
        totalSubmissions: totalCount,
        uniqueParticipants,
        uniqueSolvers,
        solveRate: uniqueParticipants > 0 ? Math.round((uniqueSolvers / uniqueParticipants) * 100) : 0,
      };
    });

    const uniqueAllParticipants = new Set((submissions || []).map((s) => s.user_email)).size;

    return NextResponse.json({
      success: true,
      config,
      isLocked: Boolean(config.is_locked),
      stats: {
        totalSubmissions: (submissions || []).length,
        uniqueParticipants: uniqueAllParticipants,
        problems: problemStats,
      },
      recentSubmissions: submissions || [],
    });
  } catch (err: any) {
    console.error('[API /api/admin/coding-challenge GET] Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session || !session.isAdmin) {
      return NextResponse.json({ success: false, error: 'Unauthorized admin access' }, { status: 403 });
    }

    const body = await req.json();
    const { is_locked, enabled, config: customConfig, toggleLock } = body;

    const currentConfig = await getChallengeConfig();
    const nextLocked =
      is_locked !== undefined
        ? Boolean(is_locked)
        : toggleLock
        ? !currentConfig.is_locked
        : currentConfig.is_locked;

    const updatedConfig: CompetitionConfig = {
      ...currentConfig,
      ...(customConfig || {}),
      is_locked: nextLocked,
      ...(enabled !== undefined ? { enabled: Boolean(enabled) } : {}),
    };

    const { error } = await supabaseAdmin
      .from('platform_config')
      .upsert({
        key: 'qiskit_challenge_config',
        value: updatedConfig,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    await invalidatePlatformConfigCache('qiskit_challenge_config');
    await invalidateCache(['platform_config:qiskit_challenge', 'platform_config:all', 'admin:stats_overview']);

    return NextResponse.json({
      success: true,
      config: updatedConfig,
      isLocked: Boolean(updatedConfig.is_locked),
      message: `Python Coding Challenge in Qiskit is now ${
        updatedConfig.is_locked ? 'LOCKED (Coming Soon mode active)' : 'UNLOCKED (Live & Open to participants)'
      }.`,
    });
  } catch (err: any) {
    console.error('[API /api/admin/coding-challenge POST] Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
