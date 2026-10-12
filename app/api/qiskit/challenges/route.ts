import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { QISKIT_CHALLENGES } from '@/data/qiskit/challenges';
import { getChallengeConfig } from '@/lib/qiskit-judge';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();
    const config = await getChallengeConfig();
    const isAdmin = Boolean(session?.isAdmin);
    const isLocked = Boolean(config.is_locked);

    let userSubmissions: Record<string, { status: string; score: number; maxScore: number }> = {};

    if (session?.email) {
      const { data: subs } = await supabaseAdmin
        .from('coding_submissions')
        .select('challenge_id, score, max_score, status')
        .eq('user_email', session.email.toLowerCase())
        .order('score', { ascending: false });

      for (const s of subs || []) {
        if (!userSubmissions[s.challenge_id]) {
          userSubmissions[s.challenge_id] = {
            status: s.status,
            score: s.score || 0,
            maxScore: s.max_score || 0,
          };
        } else if ((s.score || 0) > userSubmissions[s.challenge_id].score) {
          userSubmissions[s.challenge_id].score = s.score || 0;
        }
      }
    }

    const challengesWithStatus = QISKIT_CHALLENGES.map((ch) => {
      const userStat = userSubmissions[ch.id];
      let state: 'unattempted' | 'attempted' | 'solved' = 'unattempted';
      if (userStat) {
        state = userStat.score >= ch.points ? 'solved' : 'attempted';
      }

      return {
        ...ch,
        userState: state,
        userBestScore: userStat?.score || 0,
      };
    });

    // If challenge is locked: non-admin participants receive empty problem set (preventing leaks)
    // Administrators retain full access for testing purposes
    const challengesToReturn = isLocked && !isAdmin ? [] : challengesWithStatus;

    return NextResponse.json({
      success: true,
      challenges: challengesToReturn,
      config,
      isLocked,
      isAdmin,
    });
  } catch (err: any) {
    console.error('[API /api/qiskit/challenges] Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
