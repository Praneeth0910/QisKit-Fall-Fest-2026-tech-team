import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { isEmailWhitelisted, invalidateHackathonTeamCache, invalidateEmailCache } from '@/lib/redis';
import { isTeamFinalized } from '@/lib/finalized-teams';
import { saveParticipantUniversities } from '@/lib/participant-universities';

// Helper to invalidate all team member caches
async function invalidateAllTeamCaches(teamId: string, additionalEmail?: string) {
  try {
    const { data: members } = await supabase
      .from('team_members')
      .select('email')
      .eq('team_id', teamId);

    const emailSet = new Set<string>();
    if (additionalEmail) emailSet.add(additionalEmail.toLowerCase());
    (members || []).forEach((m) => {
      if (m.email) emailSet.add(m.email.toLowerCase());
    });

    for (const email of emailSet) {
      await invalidateHackathonTeamCache(email);
      await invalidateEmailCache(email);
    }
  } catch (err) {
    console.warn('Cache invalidation notice:', err);
  }
}

// ---------------------------------------------------------------------------
// POST: Add a new teammate to an existing team (Max 6 members limit)
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { teamId, email, fullName, university } = body;

    const trimmedEmail = email?.trim().toLowerCase();
    const cleanFullName = fullName?.trim() || trimmedEmail?.split('@')[0] || '';
    const cleanUniversity = university?.trim() || '';

    if (!teamId || !trimmedEmail || !trimmedEmail.includes('@')) {
      return NextResponse.json(
        { error: 'Team ID and valid teammate email are required.' },
        { status: 400 }
      );
    }

    if (!cleanUniversity) {
      return NextResponse.json(
        { error: 'Please provide the teammate\'s University / Institution name.' },
        { status: 400 }
      );
    }

    // 1. Guard: Check if team is finalized
    const finStatus = await isTeamFinalized(teamId);
    if (finStatus.isFinalized) {
      return NextResponse.json(
        { error: 'Team roster has been finalized and locked. No further teammates can be added.' },
        { status: 400 }
      );
    }

    // 2. Verify caller is authorized (must be leader or accepted member of this team)
    const { data: callerMembership } = await supabase
      .from('team_members')
      .select('role, status')
      .ilike('email', session.email)
      .eq('team_id', teamId)
      .neq('status', 'declined')
      .maybeSingle();

    if (!callerMembership) {
      return NextResponse.json(
        { error: 'You are not authorized to manage members for this team.' },
        { status: 403 }
      );
    }

    // 3. Check current team member count (Max 6 active/pending members)
    const { data: currentMembers } = await supabase
      .from('team_members')
      .select('id, email, status')
      .eq('team_id', teamId)
      .neq('status', 'declined');

    const activeMemberCount = currentMembers?.length || 0;
    if (activeMemberCount >= 6) {
      return NextResponse.json(
        { error: 'Team has reached the maximum capacity of 6 members.' },
        { status: 400 }
      );
    }

    // 4. Check if email already has a record in THIS team
    const { data: existingInThisTeam } = await supabase
      .from('team_members')
      .select('id, email, status')
      .ilike('email', trimmedEmail)
      .eq('team_id', teamId)
      .maybeSingle();

    if (existingInThisTeam) {
      // If they were previously declined, re-invite them seamlessly!
      if (existingInThisTeam.status === 'declined') {
        const { data: resurrected, error: resurrectErr } = await supabase
          .from('team_members')
          .update({
            status: 'invited',
            invited_at: new Date().toISOString(),
            responded_at: null,
          })
          .eq('id', existingInThisTeam.id)
          .select()
          .single();

        if (resurrectErr) throw resurrectErr;
        await invalidateAllTeamCaches(teamId, trimmedEmail);

        return NextResponse.json({
          success: true,
          message: `In-portal invitation restored for ${trimmedEmail}. Ask them to sign into the Hackathon Workspace to accept.`,
          member: resurrected,
        });
      }

      return NextResponse.json(
        { error: `${trimmedEmail} is already in your team roster.` },
        { status: 400 }
      );
    }

    // 5. Verify teammate email is whitelisted on Unstop
    const whitelistCheck = await isEmailWhitelisted(trimmedEmail);
    if (!whitelistCheck.whitelisted) {
      return NextResponse.json(
        {
          error: `Teammate ${trimmedEmail} is not in the registered whitelist. Tell your team member to register on Unstop and join the WhatsApp group to quickly resolve the issue.`,
        },
        { status: 400 }
      );
    }

    // 6. Verify teammate is not already registered in another active team
    const { data: activeTeam } = await supabase
      .from('team_members')
      .select('team_id, hackathon_teams(name)')
      .ilike('email', trimmedEmail)
      .neq('status', 'declined')
      .maybeSingle();

    if (activeTeam) {
      // @ts-expect-error join
      const conflictingTeamName = activeTeam.hackathon_teams?.name || 'another team';
      return NextResponse.json(
        { error: `${trimmedEmail} is already registered in team "${conflictingTeamName}".` },
        { status: 400 }
      );
    }

    // Clean up any stale declined row for this email across any team to avoid unique constraint collisions
    await supabase
      .from('team_members')
      .delete()
      .ilike('email', trimmedEmail)
      .eq('status', 'declined');

    // 7. Insert new invited member
    const { data: newMember, error: insertError } = await supabase
      .from('team_members')
      .insert({
        team_id: teamId,
        email: trimmedEmail,
        full_name: cleanFullName || whitelistCheck.fullName || trimmedEmail.split('@')[0],
        role: 'member',
        status: 'invited',
        invited_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError || !newMember) {
      if (insertError?.message?.includes('team_members_email_key') || (insertError as any)?.code === '23505') {
        return NextResponse.json(
          { error: `${trimmedEmail} is already registered in a team.` },
          { status: 400 }
        );
      }
      throw insertError || new Error('Failed to insert member');
    }

    // 8. Persist university name
    await saveParticipantUniversities([
      {
        email: trimmedEmail,
        university: cleanUniversity,
        fullName: cleanFullName || whitelistCheck.fullName || trimmedEmail.split('@')[0],
      },
    ]);

    // Invalidate caches
    await invalidateAllTeamCaches(teamId, trimmedEmail);

    return NextResponse.json({
      success: true,
      message: `In-portal invitation created for ${trimmedEmail}. Ask them to sign in to accept.`,
      member: {
        ...newMember,
        university: cleanUniversity,
      },
    });
  } catch (error: any) {
    console.error('Error adding team member:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to add team member' },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE: Remove a member from an existing team (Freely editable before finalization)
// ---------------------------------------------------------------------------
export async function DELETE(request: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('teamId');
    const memberId = searchParams.get('memberId');

    if (!teamId || !memberId) {
      return NextResponse.json(
        { error: 'Team ID and Member ID are required.' },
        { status: 400 }
      );
    }

    // 1. Guard: Check if team is finalized
    const finStatus = await isTeamFinalized(teamId);
    if (finStatus.isFinalized) {
      return NextResponse.json(
        { error: 'Team roster has been finalized and locked. Members cannot be removed.' },
        { status: 400 }
      );
    }

    // 2. Fetch member to be removed
    const { data: targetMember } = await supabase
      .from('team_members')
      .select('id, team_id, email, role, status')
      .eq('id', memberId)
      .eq('team_id', teamId)
      .maybeSingle();

    if (!targetMember) {
      return NextResponse.json(
        { error: 'Member not found in this team.' },
        { status: 404 }
      );
    }

    // Leader cannot be removed
    if (targetMember.role === 'leader') {
      return NextResponse.json(
        { error: 'The team leader cannot be removed. Leadership cannot be deleted.' },
        { status: 400 }
      );
    }

    // 3. Verify caller is team leader, admin, the member removing themselves, or an accepted teammate removing an unaccepted pending invite
    const { data: callerEntry } = await supabase
      .from('team_members')
      .select('role, status')
      .ilike('email', session.email)
      .eq('team_id', teamId)
      .neq('status', 'declined')
      .maybeSingle();

    const isLeader = callerEntry?.role === 'leader';
    const isAdmin = Boolean(session.isAdmin);
    const isSelf = targetMember.email.toLowerCase() === session.email.toLowerCase();
    const isPendingInvite = targetMember.status === 'invited';
    const isAcceptedMember = callerEntry?.status === 'accepted' || isLeader;

    if (!isLeader && !isAdmin && !isSelf && !(isPendingInvite && isAcceptedMember)) {
      return NextResponse.json(
        { error: 'Only team leaders, admins, or teammates managing pending invites can remove members.' },
        { status: 403 }
      );
    }

    // 4. Delete the member record (leader can freely remove anyone before finalization)
    const { error: deleteError } = await supabase
      .from('team_members')
      .delete()
      .eq('id', memberId);

    if (deleteError) {
      throw deleteError;
    }

    // Invalidate caches
    await invalidateAllTeamCaches(teamId, targetMember.email);

    return NextResponse.json({
      success: true,
      message: `Member ${targetMember.email} has been removed from the team.`,
    });
  } catch (error: any) {
    console.error('Error removing team member:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to remove team member' },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// PATCH: Resend invitation (for pending or declined invitations)
// ---------------------------------------------------------------------------
export async function PATCH(request: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { teamId, memberId, action } = body;

    if (!teamId || !memberId) {
      return NextResponse.json(
        { error: 'Team ID and Member ID are required.' },
        { status: 400 }
      );
    }

    // 1. Guard: Check if team is finalized
    const finStatus = await isTeamFinalized(teamId);
    if (finStatus.isFinalized) {
      return NextResponse.json(
        { error: 'Team roster has been finalized and locked. Invitations cannot be modified.' },
        { status: 400 }
      );
    }

    // 2. Verify caller is team leader, admin, or accepted member
    const { data: callerEntry } = await supabase
      .from('team_members')
      .select('role, status')
      .ilike('email', session.email)
      .eq('team_id', teamId)
      .maybeSingle();

    const isLeader = callerEntry?.role === 'leader';
    const isAdmin = Boolean(session.isAdmin);
    const isAcceptedMember = callerEntry?.status === 'accepted';

    if (!isLeader && !isAdmin && !isAcceptedMember) {
      return NextResponse.json(
        { error: 'Only team leaders, admins, or active teammates can manage invitations.' },
        { status: 403 }
      );
    }

    // 3. Fetch target member
    const { data: targetMember } = await supabase
      .from('team_members')
      .select('*')
      .eq('id', memberId)
      .eq('team_id', teamId)
      .maybeSingle();

    if (!targetMember) {
      return NextResponse.json({ error: 'Member not found.' }, { status: 404 });
    }

    if (action === 'resend') {
      const { data: updated, error: updateErr } = await supabase
        .from('team_members')
        .update({
          invited_at: new Date().toISOString(),
          status: 'invited',
          responded_at: null,
        })
        .eq('id', memberId)
        .select()
        .single();

      if (updateErr) throw updateErr;

      await invalidateAllTeamCaches(teamId, targetMember.email);

      return NextResponse.json({
        success: true,
        message: `In-portal invitation refreshed for ${targetMember.email}.`,
        member: updated,
      });
    }

    return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
  } catch (error: any) {
    console.error('Error updating team member:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to update member' },
      { status: 500 }
    );
  }
}
