import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { cacheAside, CACHE_TTL, invalidateCache } from '@/lib/redis';
import { getFinalizedTeamsMap } from '@/lib/finalized-teams';
import { getParticipantUniversitiesMap } from '@/lib/participant-universities';
import { SubmissionEvaluation } from '@/types/evaluations';

export interface AdminHackathonMember {
  id: string;
  team_id: string;
  email: string;
  full_name: string;
  university: string;
  role: 'leader' | 'member';
  status: 'invited' | 'accepted' | 'declined';
  invited_at: string;
  responded_at: string | null;
}

export interface AdminHackathonTeam {
  id: string;
  name: string;
  lead_name: string;
  lead_email: string;
  lead_university: string;
  vertical: string;
  problem_statement_id: string;
  github_repo_url: string | null;
  submission_notes: string | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
  is_finalized: boolean;
  finalized_at: string | null;
  finalized_by: string | null;
  members: AdminHackathonMember[];
  confirmed_count: number;
  pending_count: number;
  declined_count: number;
  total_members_count: number;
  evaluation?: SubmissionEvaluation | null;
}

export interface AdminHackathonParticipant {
  id: string;
  team_id: string;
  team_name: string;
  email: string;
  full_name: string;
  university: string;
  role: 'leader' | 'member';
  status: 'invited' | 'accepted' | 'declined';
  vertical: string;
  problem_statement_id: string;
  is_finalized: boolean;
  github_repo_url: string | null;
  submitted_at: string | null;
  invited_at: string;
  responded_at: string | null;
}

export interface AdminHackathonData {
  teams: AdminHackathonTeam[];
  participants: AdminHackathonParticipant[];
  stats: {
    totalTeams: number;
    finalizedTeams: number;
    draftTeams: number;
    teamsWithSubmissions: number;
    downloadedSubmissionsCount: number;
    shortlistedTeamsCount: number;
    rejectedTeamsCount?: number;
    evaluatedTeamsCount: number;
    totalParticipants: number;
    confirmedParticipants: number;
    pendingParticipants: number;
    declinedParticipants: number;
    uniqueUniversitiesCount: number;
    universitiesBreakdown: Record<string, number>;
    verticalsBreakdown: Record<string, number>;
    problemStatementsBreakdown: Record<string, number>;
  };
}

async function fetchHackathonAdminData(): Promise<AdminHackathonData> {
  // 1. Fetch all teams
  const { data: rawTeams, error: teamsErr } = await supabase
    .from('hackathon_teams')
    .select('*')
    .order('created_at', { ascending: false });

  if (teamsErr) {
    throw teamsErr;
  }

  // 2. Fetch all team members
  const { data: rawMembers, error: membersErr } = await supabase
    .from('team_members')
    .select('*')
    .order('role', { ascending: true })
    .order('invited_at', { ascending: true });

  if (membersErr) {
    throw membersErr;
  }

  // 3. Fetch finalized teams map, participant universities map & evaluations
  const finalizedMap = await getFinalizedTeamsMap();
  const universitiesMap = await getParticipantUniversitiesMap();

  const { data: rawEvals } = await supabaseAdmin
    .from('submission_evaluations')
    .select('*')
    .eq('category', 'hackathon');

  const evaluationsByTeam: Record<string, SubmissionEvaluation> = {};
  (rawEvals || []).forEach((ev: any) => {
    evaluationsByTeam[ev.target_id] = ev as SubmissionEvaluation;
  });

  // Group members by team_id
  const membersByTeam: Record<string, AdminHackathonMember[]> = {};
  const participantsList: AdminHackathonParticipant[] = [];

  const teamByIdMap: Record<string, any> = {};
  (rawTeams || []).forEach((t) => {
    teamByIdMap[t.id] = t;
  });

  const universitiesCount: Record<string, number> = {};
  const verticalsCount: Record<string, number> = {};
  const problemStatementsCount: Record<string, number> = {};

  let confirmedParticipants = 0;
  let pendingParticipants = 0;
  let declinedParticipants = 0;

  (rawMembers || []).forEach((m) => {
    const cleanEmail = m.email?.toLowerCase();
    const uni =
      universitiesMap[cleanEmail] ||
      (cleanEmail?.endsWith('@srmap.edu.in') ? 'SRM University-AP' : 'SRM University-AP');

    const memberObj: AdminHackathonMember = {
      id: m.id,
      team_id: m.team_id,
      email: m.email,
      full_name: m.full_name || cleanEmail?.split('@')[0] || 'Anonymous',
      university: uni,
      role: m.role,
      status: m.status,
      invited_at: m.invited_at,
      responded_at: m.responded_at,
    };

    if (!membersByTeam[m.team_id]) {
      membersByTeam[m.team_id] = [];
    }
    membersByTeam[m.team_id].push(memberObj);

    // Track participant counts
    if (m.status === 'accepted' || m.role === 'leader') {
      confirmedParticipants++;
    } else if (m.status === 'invited') {
      pendingParticipants++;
    } else if (m.status === 'declined') {
      declinedParticipants++;
    }

    // University tally
    universitiesCount[uni] = (universitiesCount[uni] || 0) + 1;

    // Build flat participant entry
    const parentTeam = teamByIdMap[m.team_id];
    if (parentTeam) {
      const finInfo = finalizedMap[parentTeam.id];
      participantsList.push({
        id: m.id,
        team_id: m.team_id,
        team_name: parentTeam.name,
        email: m.email,
        full_name: memberObj.full_name,
        university: uni,
        role: m.role,
        status: m.status,
        vertical: parentTeam.vertical,
        problem_statement_id: parentTeam.problem_statement_id,
        is_finalized: !!finInfo,
        github_repo_url: parentTeam.github_repo_url || null,
        submitted_at: parentTeam.submitted_at || null,
        invited_at: m.invited_at,
        responded_at: m.responded_at,
      });
    }
  });

  let finalizedTeamsCount = 0;
  let teamsWithSubmissionsCount = 0;
  let downloadedSubmissionsCount = 0;
  let shortlistedTeamsCount = 0;
  let rejectedTeamsCount = 0;
  let evaluatedTeamsCount = 0;

  const enrichedTeams: AdminHackathonTeam[] = (rawTeams || []).map((t) => {
    const finInfo = finalizedMap[t.id];
    const isFinalized = !!finInfo;
    if (isFinalized) finalizedTeamsCount++;
    if (t.github_repo_url) teamsWithSubmissionsCount++;

    const evalData = evaluationsByTeam[t.id] || null;
    if (evalData?.downloaded) downloadedSubmissionsCount++;
    if (evalData?.is_next_round) shortlistedTeamsCount++;
    if (evalData?.status === 'rejected') rejectedTeamsCount++;
    if (evalData?.status && evalData.status !== 'pending') evaluatedTeamsCount++;

    const teamMembers = membersByTeam[t.id] || [];
    const confirmedCount = teamMembers.filter((m) => m.status === 'accepted' || m.role === 'leader').length;
    const pendingCount = teamMembers.filter((m) => m.status === 'invited').length;
    const declinedCount = teamMembers.filter((m) => m.status === 'declined').length;

    // Track vertical and PS distribution
    if (t.vertical) {
      verticalsCount[t.vertical] = (verticalsCount[t.vertical] || 0) + 1;
    }
    if (t.problem_statement_id) {
      problemStatementsCount[t.problem_statement_id] = (problemStatementsCount[t.problem_statement_id] || 0) + 1;
    }

    const leadEmailClean = t.lead_email?.toLowerCase();
    const leadUni =
      universitiesMap[leadEmailClean] ||
      (leadEmailClean?.endsWith('@srmap.edu.in') ? 'SRM University-AP' : 'SRM University-AP');

    return {
      id: t.id,
      name: t.name,
      lead_name: t.lead_name,
      lead_email: t.lead_email,
      lead_university: leadUni,
      vertical: t.vertical,
      problem_statement_id: t.problem_statement_id,
      github_repo_url: t.github_repo_url || null,
      submission_notes: t.submission_notes || null,
      submitted_at: t.submitted_at || null,
      created_at: t.created_at,
      updated_at: t.updated_at,
      is_finalized: isFinalized,
      finalized_at: finInfo?.finalized_at || null,
      finalized_by: finInfo?.finalized_by || null,
      members: teamMembers,
      confirmed_count: confirmedCount,
      pending_count: pendingCount,
      declined_count: declinedCount,
      total_members_count: teamMembers.length,
      evaluation: evalData,
    };
  });

  const totalTeams = enrichedTeams.length;
  const draftTeams = totalTeams - finalizedTeamsCount;
  const uniqueUniversitiesCount = Object.keys(universitiesCount).length;

  return {
    teams: enrichedTeams,
    participants: participantsList,
    stats: {
      totalTeams,
      finalizedTeams: finalizedTeamsCount,
      draftTeams,
      teamsWithSubmissions: teamsWithSubmissionsCount,
      downloadedSubmissionsCount,
      shortlistedTeamsCount,
      rejectedTeamsCount,
      evaluatedTeamsCount,
      totalParticipants: rawMembers?.length || 0,
      confirmedParticipants,
      pendingParticipants,
      declinedParticipants,
      uniqueUniversitiesCount,
      universitiesBreakdown: universitiesCount,
      verticalsBreakdown: verticalsCount,
      problemStatementsBreakdown: problemStatementsCount,
    },
  };
}

export async function GET() {
  const session = await getServerSession();
  if (!session || !session.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 403 });
  }

  try {
    const data = await cacheAside(
      'admin:hackathon_details',
      CACHE_TTL.ADMIN_STATS,
      fetchHackathonAdminData
    );

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error: any) {
    console.error('Error in GET /api/admin/hackathon:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch hackathon admin data' },
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
    const body = await request.json().catch(() => ({}));
    const action = body.action || 'purge-cache';

    if (action === 'purge-cache') {
      await invalidateCache('admin:hackathon_details');
      const freshData = await fetchHackathonAdminData();
      return NextResponse.json({
        success: true,
        message: 'Hackathon admin cache refreshed.',
        data: freshData,
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Error in POST /api/admin/hackathon:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to execute hackathon admin action' },
      { status: 500 }
    );
  }
}
