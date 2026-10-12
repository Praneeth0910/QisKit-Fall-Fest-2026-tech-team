import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { cacheAside } from '@/lib/redis';
import { QISKIT_CHALLENGES } from '@/data/qiskit/challenges';
import { isLocalTestAuthRequest, LOCAL_TEST_FULL_NAME, LOCAL_TEST_EMAIL } from '@/lib/local-test-auth';
import { listLocalTestSubmissions } from '@/lib/local-test-store';

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
    if (await isLocalTestAuthRequest()) {
      const submissions = await listLocalTestSubmissions();
      const bestByChallenge = new Map<string, number>();
      for (const submission of submissions) {
        if (submission.status !== 'completed') continue;
        const key = `${submission.user_email}:${submission.challenge_id}`;
        bestByChallenge.set(key, Math.max(bestByChallenge.get(key) || 0, submission.score));
      }

      const totals = new Map<string, { totalScore: number; solvedCount: number; lastSubmissionTime: string | null }>();
      const countedChallenges = new Set<string>();
      for (const submission of submissions) {
        if (submission.status !== 'completed') continue;
        const current = totals.get(submission.user_email) || {
          totalScore: 0,
          solvedCount: 0,
          lastSubmissionTime: null,
        };
        const key = `${submission.user_email}:${submission.challenge_id}`;
        if (countedChallenges.has(key) || bestByChallenge.get(key) !== submission.score) continue;
        countedChallenges.add(key);
        current.totalScore += submission.score;
        const challenge = QISKIT_CHALLENGES.find((item) => item.id === submission.challenge_id);
        if (challenge && submission.score >= challenge.points) current.solvedCount += 1;
        if (
          !current.lastSubmissionTime ||
          new Date(submission.submitted_at) > new Date(current.lastSubmissionTime)
        ) {
          current.lastSubmissionTime = submission.submitted_at;
        }
        totals.set(submission.user_email, current);
      }

      const leaderboard = Array.from(totals.entries())
        .map(([email, entry]) => ({
          rank: 0,
          displayName: LOCAL_TEST_FULL_NAME,
          totalScore: entry.totalScore,
          maxPossibleScore: QISKIT_CHALLENGES.reduce((sum, challenge) => sum + challenge.points, 0),
          solvedCount: entry.solvedCount,
          totalProblems: QISKIT_CHALLENGES.length,
          lastSubmissionTime: entry.lastSubmissionTime,
          email,
        }))
        .sort((a, b) => b.totalScore - a.totalScore)
        .map((entry, index) => ({ ...entry, rank: index + 1 }));

      return NextResponse.json({ success: true, leaderboard, localTestMode: true });
    }

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

      const challengePoints = new Map(
        QISKIT_CHALLENGES.map((challenge) => [challenge.id, challenge.points])
      );

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
        // Prevent local-test records or test identities from affecting production leaderboards
        if (
          email.endsWith('.invalid') ||
          email === LOCAL_TEST_EMAIL.toLowerCase() ||
          email.includes('localhost')
        ) {
          continue;
        }

        const maxScore = challengePoints.get(sub.challenge_id);
        if (
          maxScore === undefined ||
          !Number.isInteger(sub.score) ||
          sub.score < 0 ||
          sub.score > maxScore
        ) {
          continue;
        }
        if (!userBest.has(email)) {
          userBest.set(email, new Map());
        }
        const pMap = userBest.get(email)!;
        const current = pMap.get(sub.challenge_id);
        const score = sub.score;

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
          displayName: masked,
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
        maxPossibleScore: QISKIT_CHALLENGES.reduce((sum, challenge) => sum + challenge.points, 0),
        solvedCount: e.solvedCount,
        totalProblems: 9,
        lastSubmissionTime: e.lastSubmissionTime,
      }));
    });

    return NextResponse.json({
      success: true,
      leaderboard,
    });
  } catch (err: any) {
    console.error('[API /api/qiskit/leaderboard] Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
