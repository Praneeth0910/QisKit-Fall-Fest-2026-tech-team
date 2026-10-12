import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { cacheAside } from '@/lib/redis';

export interface LeaderboardEntry {
  rank: number;
  displayName: string;
  totalScore: number;
  maxPossibleScore: number;
  solvedCount: number;
  totalProblems: number;
  lastSubmissionTime: string | null;
}

export async function GET(req: NextRequest) {
  try {
    const leaderboard = await cacheAside<LeaderboardEntry[]>('coding:leaderboard', 30, async () => {
      // 1. Fetch all completed submissions with scores
      const { data: submissions, error: subErr } = await supabaseAdmin
        .from('coding_submissions')
        .select('user_email, challenge_id, score, max_score, submitted_at, status')
        .eq('status', 'completed')
        .order('submitted_at', { ascending: true });

      if (subErr || !submissions) {
        return [];
      }

      // 2. Fetch full names from allowed_emails
      const { data: users } = await supabaseAdmin
        .from('allowed_emails')
        .select('email, full_name');

      const nameMap = new Map<string, string>();
      for (const u of users || []) {
        if (u.email) {
          nameMap.set(u.email.toLowerCase(), u.full_name || u.email.split('@')[0]);
        }
      }

      // 3. Aggregate best score per user per problem
      // user_email -> { challenge_id -> best_score }
      const userBest = new Map<string, Map<string, { score: number; maxScore: number; time: string }>>();

      for (const sub of submissions) {
        const email = sub.user_email.toLowerCase();
        if (!userBest.has(email)) {
          userBest.set(email, new Map());
        }
        const pMap = userBest.get(email)!;
        const current = pMap.get(sub.challenge_id);
        const score = sub.score || 0;
        const maxScore = sub.max_score || 0;

        if (!current || score > current.score) {
          pMap.set(sub.challenge_id, {
            score,
            maxScore,
            time: sub.submitted_at,
          });
        }
      }

      // 4. Compute totals per user
      const entries: Array<{
        email: string;
        displayName: string;
        totalScore: number;
        solvedCount: number;
        lastSubmissionTime: string | null;
      }> = [];

      for (const [email, pMap] of userBest.entries()) {
        let total = 0;
        let solved = 0;
        let latestTime: string | null = null;

        for (const [_, info] of pMap.entries()) {
          total += info.score;
          if (info.score >= info.maxScore && info.maxScore > 0) {
            solved += 1;
          }
          if (!latestTime || new Date(info.time) > new Date(latestTime)) {
            latestTime = info.time;
          }
        }

        // Anonymize/format display name
        const rawName = nameMap.get(email) || email.split('@')[0];
        const masked = rawName.length > 2
          ? `${rawName.slice(0, 1)}***${rawName.slice(-1)}`
          : rawName;

        entries.push({
          email,
          displayName: rawName, // Keep name visible or masked
          totalScore: total,
          solvedCount: solved,
          lastSubmissionTime: latestTime,
        });
      }

      // 5. Rank by totalScore DESC, then earliest lastSubmissionTime ASC
      entries.sort((a, b) => {
        if (b.totalScore !== a.totalScore) {
          return b.totalScore - a.totalScore;
        }
        if (!a.lastSubmissionTime) return 1;
        if (!b.lastSubmissionTime) return -1;
        return new Date(a.lastSubmissionTime).getTime() - new Date(b.lastSubmissionTime).getTime();
      });

      return entries.map((e, idx) => ({
        rank: idx + 1,
        displayName: e.displayName,
        totalScore: e.totalScore,
        maxPossibleScore: 100,
        solvedCount: e.solvedCount,
        totalProblems: 9,
        lastSubmissionTime: e.lastSubmissionTime,
      }));
    });

    return NextResponse.json(
      {
        success: true,
        leaderboard,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120',
        },
      }
    );
  } catch (err: any) {
    console.error('[API /api/qiskit/leaderboard] Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
