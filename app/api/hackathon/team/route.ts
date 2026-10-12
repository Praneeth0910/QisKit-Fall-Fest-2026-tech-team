import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import {
  isEmailWhitelisted,
  invalidateEmailCache,
  getHackathonTeamCached,
  invalidateHackathonTeamCache,
} from '@/lib/redis';
import { isTeamFinalized } from '@/lib/finalized-teams';
import {
  getParticipantUniversitiesMap,
  saveParticipantUniversities,
} from '@/lib/participant-universities';

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const data = await getHackathonTeamCached(session.email, async () => {
      // 1. Check if user is a member of an active team (leader or accepted member)
      const { data: memberEntry } = await supabase
        .from('team_members')
        .select('team_id, role, status')
        .ilike('email', session.email)
        .neq('status', 'declined')
        .maybeSingle();

      let team = null;
      let pendingInvitations: any[] = [];

      if (memberEntry) {
        // Fetch full team with all members
        const { data: teamData } = await supabase
          .from('hackathon_teams')
          .select('*')
          .eq('id', memberEntry.team_id)
          .maybeSingle();

        if (teamData) {
          const { data: allMembers } = await supabase
            .from('team_members')
            .select('*')
            .eq('team_id', memberEntry.team_id)
            .order('role', { ascending: true }); // leader first

          const finCheck = await isTeamFinalized(memberEntry.team_id);
          const universitiesMap = await getParticipantUniversitiesMap();

          const membersWithUni = (allMembers || []).map((m: any) => {
            const cleanEmail = m.email?.toLowerCase();
            return {
              ...m,
              university:
                universitiesMap[cleanEmail] ||
                (cleanEmail?.endsWith('@srmap.edu.in') ? 'SRM University-AP' : 'SRM University-AP'),
            };
          });

          team = {
            ...teamData,
            currentUserRole: memberEntry.role,
            currentUserStatus: memberEntry.status,
            lead_university:
              universitiesMap[teamData.lead_email?.toLowerCase()] ||
              (teamData.lead_email?.toLowerCase()?.endsWith('@srmap.edu.in')
                ? 'SRM University-AP'
                : 'SRM University-AP'),
            members: membersWithUni,
            is_finalized: finCheck.isFinalized,
            finalized_at: finCheck.finalizedAt || null,
          };
        }
      }

      // 2. Also check if user has any pending invitations from OTHER teams
      const { data: invites } = await supabase
        .from('team_members')
        .select('id, team_id, invited_at, hackathon_teams(name, vertical, problem_statement_id, lead_name, lead_email)')
        .ilike('email', session.email)
        .eq('status', 'invited');

      if (invites && invites.length > 0) {
        pendingInvitations = invites.map((inv) => ({
          invitationId: inv.id,
          teamId: inv.team_id,
          invitedAt: inv.invited_at,
          // @ts-expect-error join
          teamName: inv.hackathon_teams?.name,
          // @ts-expect-error join
          vertical: inv.hackathon_teams?.vertical,
          // @ts-expect-error join
          problemStatementId: inv.hackathon_teams?.problem_statement_id,
          // @ts-expect-error join
          leadName: inv.hackathon_teams?.lead_name,
          // @ts-expect-error join
          leadEmail: inv.hackathon_teams?.lead_email,
        }));
      }

      return {
        team,
        pendingInvitations,
      };
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching hackathon team:', error);
    return NextResponse.json(
      { error: 'Failed to fetch team data' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { teamName, vertical, problemStatementId, leadUniversity, teammates } = body;

    const trimmedTeamName = teamName?.trim();
    if (!trimmedTeamName || trimmedTeamName.length < 3) {
      return NextResponse.json(
        { error: 'Team name must be at least 3 characters long.' },
        { status: 400 }
      );
    }

    if (!vertical || !problemStatementId) {
      return NextResponse.json(
        { error: 'Vertical and Problem Statement selection are required.' },
        { status: 400 }
      );
    }

    const trimmedLeadUni = leadUniversity?.trim();
    if (!trimmedLeadUni) {
      return NextResponse.json(
        { error: 'Please specify the Team Leader\'s University / Institution name.' },
        { status: 400 }
      );
    }

    // 1. Check if user is already in a team
    const { data: existingUserMember } = await supabase
      .from('team_members')
      .select('team_id, status')
      .ilike('email', session.email)
      .neq('status', 'declined')
      .maybeSingle();

    if (existingUserMember) {
      return NextResponse.json(
        { error: 'You are already registered in a team.' },
        { status: 400 }
      );
    }

    // 2. Check if team name already exists
    const { data: existingTeam } = await supabase
      .from('hackathon_teams')
      .select('id')
      .ilike('name', trimmedTeamName)
      .maybeSingle();

    if (existingTeam) {
      return NextResponse.json(
        { error: `The team name "${trimmedTeamName}" is already taken. Please pick another name.` },
        { status: 400 }
      );
    }

    // 3. Validate teammates list (1 to 5 additional members, total team size 2 to 6)
    const rawMembers: Array<{ email: string; fullName: string; university?: string }> = Array.isArray(
      teammates
    )
      ? teammates
      : [];

    if (rawMembers.length > 5) {
      return NextResponse.json(
        { error: 'A team can have a maximum of 6 members (1 leader + 5 members).' },
        { status: 400 }
      );
    }

    const cleanedMembers: Array<{ email: string; fullName: string; university: string }> = [];
    const seenEmails = new Set<string>([session.email.toLowerCase()]);

    // First pass: deduplication and basic structure
    const validMembers: Array<{ email: string; fullName: string; university: string }> = [];
    for (const m of rawMembers) {
      const email = m.email?.trim().toLowerCase();
      const fullName = m.fullName?.trim() || email.split('@')[0];
      const university = m.university?.trim() || '';

      if (!email || !email.includes('@')) continue;

      if (!university) {
        return NextResponse.json(
          { error: `Please provide the University / Institution name for teammate ${email}.` },
          { status: 400 }
        );
      }

      if (seenEmails.has(email)) {
        return NextResponse.json(
          { error: `Duplicate email detected in team roster: ${email}` },
          { status: 400 }
        );
      }
      seenEmails.add(email);
      validMembers.push({ email, fullName, university });
    }

    if (validMembers.length < 1) {
      return NextResponse.json(
        { error: 'A team must have at least 2 members. Please add at least 1 teammate (Team size: 2 to 6 members).' },
        { status: 400 }
      );
    }

    // Second pass: Concurrent Supabase/Redis checks using Promise.all
    const validationResults = await Promise.all(
      validMembers.map(async (member) => {
        // Verify whitelist
        const whitelistCheck = await isEmailWhitelisted(member.email);
        if (!whitelistCheck.whitelisted) {
          return {
            error: `Teammate ${member.email} is not in the registered whitelist. Tell your team member to register on Unstop and join the WhatsApp group to quickly resolve the issue.`,
          };
        }

        // Verify not in another active team
        const { data: activeTeam } = await supabase
          .from('team_members')
          .select('team_id')
          .ilike('email', member.email)
          .neq('status', 'declined')
          .maybeSingle();

        if (activeTeam) {
          return { error: `Teammate ${member.email} is already registered in another team.` };
        }

        return { success: true, member };
      })
    );

    // Return first error if any failed
    for (const result of validationResults) {
      if (result.error) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      if (result.member) {
        cleanedMembers.push(result.member);
      }
    }

    // 4. Create the team in hackathon_teams
    const { data: newTeam, error: teamInsertError } = await supabase
      .from('hackathon_teams')
      .insert({
        name: trimmedTeamName,
        lead_email: session.email,
        lead_name: session.fullName,
        vertical,
        problem_statement_id: problemStatementId,
      })
      .select()
      .single();

    if (teamInsertError || !newTeam) {
      throw teamInsertError || new Error('Failed to create team record');
    }

    // Clean up any stale declined invitation rows for these emails to avoid unique constraint violations
    const allRosterEmails = [session.email.toLowerCase(), ...cleanedMembers.map((m) => m.email.toLowerCase())];
    try {
      await supabase
        .from('team_members')
        .delete()
        .in('email', allRosterEmails)
        .eq('status', 'declined');
    } catch (cleanupErr) {
      console.warn('Note: Stale declined row cleanup notice:', cleanupErr);
    }

    // 5. Insert leader into team_members
    const membersToInsert = [
      {
        team_id: newTeam.id,
        email: session.email,
        full_name: session.fullName,
        role: 'leader',
        status: 'accepted',
        responded_at: new Date().toISOString(),
      },
      ...cleanedMembers.map((m) => ({
        team_id: newTeam.id,
        email: m.email,
        full_name: m.fullName,
        role: 'member',
        status: 'invited',
      })),
    ];

    const { error: membersError } = await supabase
      .from('team_members')
      .insert(membersToInsert);

    if (membersError) {
      // rollback team
      await supabase.from('hackathon_teams').delete().eq('id', newTeam.id);
      if (membersError.message?.includes('team_members_email_key') || (membersError as any).code === '23505') {
        return NextResponse.json(
          { error: 'One or more members are already registered in a team. Each participant can only join one team.' },
          { status: 400 }
        );
      }
      throw membersError;
    }

    // 6. Persist university affiliations for leader and all teammates
    await saveParticipantUniversities([
      { email: session.email, university: trimmedLeadUni, fullName: session.fullName },
      ...cleanedMembers.map((m) => ({ email: m.email, university: m.university, fullName: m.fullName })),
    ]);

    // Invalidate caches
    await invalidateEmailCache(session.email);
    for (const m of cleanedMembers) {
      await invalidateEmailCache(m.email);
    }

    return NextResponse.json({
      success: true,
      message: 'Team successfully created. Ask teammates to log into the portal to accept their invitations.',
      team: newTeam,
    });
  } catch (error: any) {
    console.error('Error creating team:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to create team' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { teamId, problemStatementId, vertical } = body;

    if (!teamId || !problemStatementId || !vertical) {
      return NextResponse.json(
        { error: 'Team ID, vertical, and problem statement ID are required.' },
        { status: 400 }
      );
    }

    // 1. Verify user is an authorized member/leader of this team
    const { data: memberEntry } = await supabase
      .from('team_members')
      .select('team_id, role, status')
      .ilike('email', session.email)
      .eq('team_id', teamId)
      .neq('status', 'declined')
      .maybeSingle();

    if (!memberEntry) {
      return NextResponse.json(
        { error: 'You are not authorized to modify this team.' },
        { status: 403 }
      );
    }

    // 2. Safely UPDATE only problem_statement_id and vertical without touching other fields
    const { data: updatedTeam, error: updateError } = await supabase
      .from('hackathon_teams')
      .update({
        problem_statement_id: problemStatementId,
        vertical: vertical,
      })
      .eq('id', teamId)
      .select()
      .single();

    if (updateError || !updatedTeam) {
      throw updateError || new Error('Failed to update problem statement record');
    }

    // 3. Invalidate Redis caches for all team members so the change reflects immediately
    const { data: allMembers } = await supabase
      .from('team_members')
      .select('email')
      .eq('team_id', teamId);

    if (allMembers && allMembers.length > 0) {
      for (const m of allMembers) {
        if (m.email) {
          await invalidateHackathonTeamCache(m.email);
        }
      }
    } else {
      await invalidateHackathonTeamCache(session.email);
    }

    return NextResponse.json({
      success: true,
      message: 'Problem statement successfully updated.',
      team: updatedTeam,
    });
  } catch (error: any) {
    console.error('Error updating problem statement:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to update problem statement' },
      { status: 500 }
    );
  }
}

