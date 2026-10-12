'use client';

import React, { useState, useEffect } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { AuthGate } from '@/components/learning/AuthGate';
import { TeammateInput } from '@/components/learning/TeammateInput';
import { ProblemStatementDossier } from '@/components/learning/ProblemStatementDossier';
import { ProblemStatementDriveNotice } from '@/components/learning/ProblemStatementDriveNotice';
import { PROBLEM_STATEMENTS } from '@/data/learning/problem-statements';
import { VerticalType, ProblemStatement } from '@/data/learning/types';
import { trackTeamCreated } from '@/lib/analytics';
import {
  Users,
  Shield,
  CheckCircle2,
  Clock,
  Plus,
  Send,
  AlertCircle,
  ExternalLink,
  Github,
  ArrowLeft,
  Lock,
  Edit3,
  X,
  Check,
  UserPlus,
  Trash2,
  RefreshCw,
  Trophy,
  GraduationCap,
  MessageCircle,
  Copy,
} from 'lucide-react';
import { REGISTRATION_URL, WHATSAPP_COMMUNITY_URL, HACKATHON_WORKSPACE_URL } from '@/lib/constants';
import { supabase } from '@/lib/supabase';

const VERTICALS: VerticalType[] = [
  'Quantum Chemistry',
  'Quantum Optimization',
  'Quantum Simulation',
  'Quantum Machine Learning',
  'Post-Quantum Cryptography',
];

export default function HackathonWorkspacePage() {
  const [sessionUser, setSessionUser] = useState<any>(null);
  const fetcher = (url: string) => fetch(url).then((res) => res.json());
  const { data: teamDataObj, error: teamError, mutate: mutateTeam } = useSWR('/api/hackathon/team', fetcher, {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    revalidateIfStale: false,
    dedupingInterval: 5000,
  });

  // Supabase Realtime: instant push updates on invitations, member status, and roster changes
  useEffect(() => {
    if (!sessionUser?.email) return;

    const channel = supabase
      .channel(`hackathon-realtime-${sessionUser.email.toLowerCase()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'team_members' },
        () => {
          mutateTeam();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'hackathon_teams' },
        () => {
          mutateTeam();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionUser?.email, mutateTeam]);
  
  const team = teamDataObj?.team || null;
  const pendingInvitations: any[] = teamDataObj?.pendingInvitations || [];
  const isLoading = !teamDataObj && !teamError;
  const [isRefreshingRoster, setIsRefreshingRoster] = useState(false);

  useEffect(() => {
    if (team?.github_repo_url) {
      setGithubUrl(team.github_repo_url);
    }
  }, [team]);

  // Team creation form state
  const [teamName, setTeamName] = useState('');
  const [leadUniversity, setLeadUniversity] = useState('');
  const [selectedVertical, setSelectedVertical] = useState<VerticalType>('Quantum Chemistry');
  const [selectedPSId, setSelectedPSId] = useState('PS-C1');
  const [teammates, setTeammates] = useState<Array<{ email: string; fullName: string; university?: string; status?: any }>>([
    { email: '', fullName: '', university: '', status: 'idle' },
  ]);
  const [isSubmittingTeam, setIsSubmittingTeam] = useState(false);
  const [teamFormError, setTeamFormError] = useState('');

  useEffect(() => {
    if (sessionUser?.email && !leadUniversity) {
      if (sessionUser.email.toLowerCase().endsWith('@srmap.edu.in')) {
        setLeadUniversity('SRM University-AP');
      }
    }
  }, [sessionUser, leadUniversity]);

  // GitHub submission state
  const [githubUrl, setGithubUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmittingRepo, setIsSubmittingRepo] = useState(false);
  const [repoSuccessMsg, setRepoSuccessMsg] = useState('');
  const [repoErrorMsg, setRepoErrorMsg] = useState('');

  // Problem statement edit state (post-confirmation)
  const [isChangingPS, setIsChangingPS] = useState(false);
  const [changeVertical, setChangeVertical] = useState<VerticalType>('Quantum Chemistry');
  const [changePSId, setChangePSId] = useState('PS-C1');
  const [isSubmittingPSChange, setIsSubmittingPSChange] = useState(false);
  const [changePSError, setChangePSError] = useState('');
  const [changePSSuccess, setChangePSSuccess] = useState('');

  // Active Team Member Management state
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberUniversity, setNewMemberUniversity] = useState('');
  const [newMemberStatus, setNewMemberStatus] = useState<any>('idle');
  const [isSubmittingNewMember, setIsSubmittingNewMember] = useState(false);
  const [memberActionMsg, setMemberActionMsg] = useState('');
  const [memberActionErr, setMemberActionErr] = useState('');
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [resendingMemberId, setResendingMemberId] = useState<string | null>(null);
  const [isFinalizeModalOpen, setIsFinalizeModalOpen] = useState(false);
  const [isFinalizingTeam, setIsFinalizingTeam] = useState(false);
  const [finalizeError, setFinalizeError] = useState('');
  const [finalizeSuccess, setFinalizeSuccess] = useState('');
  const [recentInvitedEmail, setRecentInvitedEmail] = useState<string | null>(null);
  const [copiedInviteEmail, setCopiedInviteEmail] = useState<string | null>(null);
  const [respondingInviteId, setRespondingInviteId] = useState<string | null>(null);
  const [respondingInviteErr, setRespondingInviteErr] = useState<string>('');

  function getInviteShareMessage(teammateEmail?: string) {
    const teamNameStr = team?.name ? `"${team.name}"` : 'our team';
    const emailStr = teammateEmail ? ` (${teammateEmail})` : '';
    return `Hey! You've been invited to join team ${teamNameStr} for Qiskit Fall Fest 2026. Please log in with your registered Gmail${emailStr} at ${HACKATHON_WORKSPACE_URL} to accept your in-portal invitation!`;
  }

  function handleCopyInviteMessage(teammateEmail?: string) {
    const msg = getInviteShareMessage(teammateEmail);
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(msg);
      setCopiedInviteEmail(teammateEmail || 'general');
      setTimeout(() => setCopiedInviteEmail(null), 3000);
    }
  }

  function getWhatsAppShareUrl(teammateEmail?: string) {
    const msg = getInviteShareMessage(teammateEmail);
    return `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
  }

  // Sync change state when team loads
  useEffect(() => {
    if (team?.vertical) {
      setChangeVertical(team.vertical);
    }
    if (team?.problem_statement_id) {
      setChangePSId(team.problem_statement_id);
    }
  }, [team?.vertical, team?.problem_statement_id]);

  // Debounced lookup for adding member to existing team
  useEffect(() => {
    const trimmed = newMemberEmail.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@')) {
      setNewMemberStatus('idle');
      return;
    }

    setNewMemberStatus('checking');
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/auth/verify-email?email=${encodeURIComponent(trimmed)}`);
        const data = await res.json();
        if (!data.whitelisted) {
          setNewMemberStatus('not_whitelisted');
        } else if (data.inTeam) {
          setNewMemberStatus('already_in_team');
        } else {
          setNewMemberStatus('valid');
          if (data.fullName && !newMemberName) {
            setNewMemberName(data.fullName);
          }
          if (trimmed.endsWith('@srmap.edu.in') && !newMemberUniversity) {
            setNewMemberUniversity('SRM University-AP');
          }
        }
      } catch {
        setNewMemberStatus('idle');
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [newMemberEmail]);

  // Release status state (Temporarily set to true for testing)
  const [isReleased, setIsReleased] = useState(true);

  useEffect(() => {
    checkReleaseStatus();
  }, []);

  async function checkReleaseStatus() {
    // TEMPORARY: Bypass release date check for testing purposes
    setIsReleased(true);
    return;
    
    const targetDate = new Date('2026-10-10T00:00:00+05:30');
    if (new Date() >= targetDate) {
      setIsReleased(true);
      return;
    }
    try {
      const res = await fetch('/api/admin/config');
      const data = await res.json();
      if (data?.config?.hackathon_release_override?.enabled === true) {
        setIsReleased(true);
      }
    } catch {}
  }

  async function fetchTeamData() {
    await mutateTeam();
  }

  // Handle vertical selection change -> auto-select first problem statement in that vertical
  function handleVerticalChange(vert: VerticalType) {
    setSelectedVertical(vert);
    const firstInVert = PROBLEM_STATEMENTS.find((ps) => ps.vertical === vert);
    if (firstInVert) {
      setSelectedPSId(firstInVert.id);
    }
  }

  // Teammates row handlers
  function handleAddTeammate() {
    if (teammates.length >= 5) return; // 1 leader + 5 members = 6 max
    setTeammates((prev) => [...prev, { email: '', fullName: '', university: '', status: 'idle' }]);
  }

  function handleTeammateChange(index: number, updated: { email: string; fullName: string; university?: string; status?: any }) {
    setTeammates((prev) => {
      const copy = [...prev];
      copy[index] = updated;
      return copy;
    });
  }

  function handleRemoveTeammate(index: number) {
    setTeammates((prev) => prev.filter((_, i) => i !== index));
  }

  // Team creation submission
  async function handleCreateTeam(e: React.FormEvent) {
    e.preventDefault();
    setTeamFormError('');

    if (!teamName.trim() || teamName.trim().length < 3) {
      setTeamFormError('Team name must be at least 3 characters.');
      return;
    }

    if (!leadUniversity.trim()) {
      setTeamFormError('Please enter your University / Institution name as the team leader.');
      return;
    }

    const filledTeammates = teammates.filter((t) => t.email.trim());
    if (filledTeammates.length < 1) {
      setTeamFormError('A team must have at least 2 members. Please add at least 1 teammate (Team size: 2 to 6 members).');
      return;
    }

    // Verify all teammate rows have valid email and university
    for (const m of filledTeammates) {
      if (!m.university?.trim()) {
        setTeamFormError(`Please specify the University / College name for teammate ${m.fullName || m.email}.`);
        return;
      }
      if (m.status === 'not_whitelisted') {
        setTeamFormError(`Teammate ${m.email} is not in the registered whitelist. Tell your team member to register on Unstop and join the WhatsApp group to quickly resolve the issue.`);
        return;
      }
      if (m.status === 'already_in_team') {
        setTeamFormError(`Teammate ${m.email} is already in another team.`);
        return;
      }
    }

    try {
      setIsSubmittingTeam(true);
      const res = await fetch('/api/hackathon/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamName: teamName.trim(),
          vertical: selectedVertical,
          problemStatementId: selectedPSId,
          leadUniversity: leadUniversity.trim(),
          teammates: filledTeammates.map((t) => ({
            email: (t.email || '').trim(),
            fullName: (t.fullName || '').trim() || (t.email || '').split('@')[0],
            university: t.university?.trim() || leadUniversity.trim(),
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setTeamFormError(data.error || 'Failed to create team.');
        return;
      }

      trackTeamCreated(teamName.trim(), 1 + teammates.length);
      await fetchTeamData();
    } catch (err: any) {
      setTeamFormError(err?.message || 'Error creating team.');
    } finally {
      setIsSubmittingTeam(false);
    }
  }

  // Respond to invitation (accept / decline)
  async function handleInviteResponse(invitationId: string, action: 'accept' | 'decline') {
    setRespondingInviteId(invitationId);
    setRespondingInviteErr('');
    try {
      const res = await fetch('/api/hackathon/invite-respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invitationId, action }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setRespondingInviteErr(data.error || 'Failed to process invitation response.');
        return;
      }
      // Revalidate fresh team data immediately
      await mutateTeam();
    } catch (err: any) {
      console.error('Error responding to invitation:', err);
      setRespondingInviteErr(err?.message || 'A network error occurred while responding to the invitation.');
    } finally {
      setRespondingInviteId(null);
    }
  }

  // Submit GitHub repository URL
  async function handleSubmitGithub(e: React.FormEvent) {
    e.preventDefault();
    setRepoSuccessMsg('');
    setRepoErrorMsg('');

    if (!team?.id || !githubUrl.trim()) return;

    try {
      setIsSubmittingRepo(true);
      const res = await fetch('/api/hackathon/submit-repo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId: team.id,
          githubRepoUrl: githubUrl.trim(),
          submissionNotes: notes.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setRepoErrorMsg(data.error || 'Failed to submit repository.');
        return;
      }

      setRepoSuccessMsg('GitHub repository link submitted successfully!');
      await fetchTeamData();
    } catch (err: any) {
      setRepoErrorMsg(err?.message || 'Failed to submit repository.');
    } finally {
      setIsSubmittingRepo(false);
    }
  }

  function handleChangeVertical(vert: VerticalType) {
    setChangeVertical(vert);
    const firstInVert = PROBLEM_STATEMENTS.find((ps) => ps.vertical === vert);
    if (firstInVert) {
      setChangePSId(firstInVert.id);
    }
  }

  async function handleUpdateProblemStatement(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!team?.id || !changePSId || !changeVertical) return;

    setIsSubmittingPSChange(true);
    setChangePSError('');
    setChangePSSuccess('');

    try {
      const res = await fetch('/api/hackathon/team', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId: team.id,
          vertical: changeVertical,
          problemStatementId: changePSId,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setChangePSError(data.error || 'Failed to update problem statement.');
        return;
      }

      setChangePSSuccess(`Successfully switched to ${changePSId}! The technical dossier below is now updated.`);
      await fetchTeamData();
      setIsChangingPS(false);
    } catch (err: any) {
      setChangePSError(err?.message || 'Error updating problem statement.');
    } finally {
      setIsSubmittingPSChange(false);
    }
  }

  function handleToggleChangePS() {
    if (!team) return;
    setChangeVertical(team.vertical);
    setChangePSId(team.problem_statement_id);
    const willOpen = !isChangingPS;
    setIsChangingPS(willOpen);
    if (willOpen) {
      setTimeout(() => {
        const el = document.getElementById('problem-statement-switcher');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    }
  }

  // Active Team: Add new teammate
  async function handleAddMemberToTeam(e: React.FormEvent) {
    e.preventDefault();
    if (!team?.id || !newMemberEmail.trim()) return;

    if (!newMemberUniversity.trim()) {
      setMemberActionErr('Please enter the teammate\'s University / Institution name.');
      return;
    }

    if (newMemberStatus === 'not_whitelisted') {
      setMemberActionErr(`Teammate ${newMemberEmail} is not authorized on the whitelist. Tell your team member to register on Unstop and join the WhatsApp group to quickly resolve the issue.`);
      return;
    }
    if (newMemberStatus === 'already_in_team') {
      setMemberActionErr(`Teammate ${newMemberEmail} is already registered in another team.`);
      return;
    }

    setIsSubmittingNewMember(true);
    setMemberActionMsg('');
    setMemberActionErr('');

    try {
      const res = await fetch('/api/hackathon/team/member', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId: team.id,
          email: newMemberEmail.trim(),
          fullName: newMemberName.trim(),
          university: newMemberUniversity.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setMemberActionErr(data.error || 'Failed to add teammate.');
        return;
      }

      const addedEmail = newMemberEmail.trim();
      setRecentInvitedEmail(addedEmail);
      setMemberActionMsg(`In-portal invitation created for ${addedEmail}!`);
      setNewMemberEmail('');
      setNewMemberName('');
      setNewMemberUniversity('');
      setNewMemberStatus('idle');
      setIsAddingMember(false);
      await fetchTeamData();
    } catch (err: any) {
      setMemberActionErr(err?.message || 'Error adding teammate.');
    } finally {
      setIsSubmittingNewMember(false);
    }
  }

  // Active Team: Remove teammate (enforces min 2 members)
  async function handleRemoveMember(memberId: string, memberEmail: string) {
    if (!team?.id) return;
    const confirmDelete = window.confirm(`Are you sure you want to remove ${memberEmail} from the team?`);
    if (!confirmDelete) return;

    setRemovingMemberId(memberId);
    setMemberActionMsg('');
    setMemberActionErr('');

    try {
      const res = await fetch(`/api/hackathon/team/member?teamId=${team.id}&memberId=${memberId}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setMemberActionErr(data.error || 'Failed to remove member.');
        return;
      }

      setMemberActionMsg(`Member ${memberEmail} removed from the team.`);
      await fetchTeamData();
    } catch (err: any) {
      setMemberActionErr(err?.message || 'Error removing member.');
    } finally {
      setRemovingMemberId(null);
    }
  }

  // Active Team: Resend invite
  async function handleResendInvite(memberId: string, memberEmail: string) {
    if (!team?.id) return;
    setResendingMemberId(memberId);
    setMemberActionMsg('');
    setMemberActionErr('');

    try {
      const res = await fetch('/api/hackathon/team/member', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId: team.id,
          memberId,
          action: 'resend',
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setMemberActionErr(data.error || 'Failed to resend invitation.');
        return;
      }

      setRecentInvitedEmail(memberEmail);
      setMemberActionMsg(`In-portal invitation refreshed for ${memberEmail}.`);
      await fetchTeamData();
    } catch (err: any) {
      setMemberActionErr(err?.message || 'Error resending invitation.');
    } finally {
      setResendingMemberId(null);
    }
  }

  // Active Team: Finalize Roster
  async function handleFinalizeTeam() {
    if (!team?.id) return;
    setIsFinalizingTeam(true);
    setFinalizeError('');
    try {
      const res = await fetch('/api/hackathon/team/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId: team.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to finalize team.');
      }
      setFinalizeSuccess(data.message || 'Team roster officially finalized and locked!');
      setIsFinalizeModalOpen(false);
      await fetchTeamData();
    } catch (err: any) {
      setFinalizeError(err?.message || 'Error finalizing team.');
    } finally {
      setIsFinalizingTeam(false);
    }
  }

  const confirmedMembers = (team?.members || []).filter(
    (m: any) => m.status === 'accepted' || m.role === 'leader'
  );
  const pendingMembers = (team?.members || []).filter(
    (m: any) => m.status === 'invited'
  );
  const declinedMembers = (team?.members || []).filter(
    (m: any) => m.status === 'declined'
  );
  const isFinalized = !!team?.is_finalized;
  const totalOccupiedSlots = confirmedMembers.length + pendingMembers.length;
  const canAddMore = !isFinalized && totalOccupiedSlots < 6;

  const verticalStatements = PROBLEM_STATEMENTS.filter((ps) => ps.vertical === selectedVertical);
  const changeVerticalStatements = PROBLEM_STATEMENTS.filter((ps) => ps.vertical === changeVertical);
  const selectedPSObj = PROBLEM_STATEMENTS.find((ps) => ps.id === (team ? team.problem_statement_id : selectedPSId));

  return (
    <AuthGate onSessionChange={setSessionUser}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 animate-in fade-in slide-in-from-bottom-4 duration-500 font-sans">

          {/* Loading state */}
          {isLoading ? (
            <div className="min-h-[50vh] flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-burgundy border-t-transparent rounded-full animate-spin" />
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Loading hackathon workspace...</p>
              </div>
            </div>
          ) : !isReleased ? (
            /* RELEASE GATE — Hackathon not yet available */
            <div className="min-h-[60vh] flex items-center justify-center px-4">
              <div className="max-w-md text-center space-y-5">
                <div className="w-16 h-16 bg-slate-100 dark:bg-[#1C0A0D] text-slate-400 dark:text-slate-500 rounded-full flex items-center justify-center mx-auto ring-8 ring-slate-100 dark:ring-[#1C0A0D]">
                  <Lock className="w-8 h-8" />
                </div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-[#FAF6F3] tracking-tight">
                  Hackathon Workspace Locked
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  The Flagship Hackathon Workspace will unlock on{' '}
                  <span className="font-bold text-slate-900 dark:text-[#FAF6F3]">October 10, 2026 at 12:00 AM IST</span>.
                  Complete the Learning Phase sessions and daily challenges in the meantime to prepare!
                </p>
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2 justify-center">
                  <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>Team formation, problem statements, and code submission will be available after release.</span>
                </div>
              </div>
            </div>
          ) : (
          <>
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="font-mono px-2.5 py-0.5 rounded bg-burgundy/10 text-burgundy dark:bg-burgundy/20 dark:text-[#E89BA5] font-semibold text-xs uppercase tracking-[0.2em]">
                Phase 1 Sprint
              </span>
              <span className="font-mono text-xs text-slate-500 dark:text-slate-400 font-medium tracking-wide">
                Releases 10 October 2026 · Algorithm-Architecture Co-Design
              </span>
            </div>
            <h1 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-bold text-[#181313] dark:text-[#FAF6F3] tracking-tight">
              Flagship Hackathon Workspace
            </h1>
            <p className="font-sans text-sm sm:text-base text-slate-600 dark:text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Form your team of 2 to 6 members, select your specialized domain track and problem
              statement, and benchmark quantum algorithms across Processors A and B.
            </p>
          </div>

          {/* Highlighted Grand Hackathon Prize Pool Banner (Visible both Before and After Creating Team) - Styled in Burgundy Shades */}
          <div className="relative overflow-hidden mb-8 p-4 sm:p-5 rounded-2xl border-2 border-burgundy/30 dark:border-burgundy/60 bg-linear-to-r from-burgundy/10 via-burgundy/[0.04] to-transparent dark:from-[#260C11] dark:via-[#1A080C] dark:to-[#120507] shadow-sm">
            <div className="absolute top-0 right-0 -mt-6 -mr-6 w-36 h-36 bg-burgundy/15 dark:bg-burgundy/25 rounded-full blur-2xl pointer-events-none" />

            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5 sm:gap-4">
                <div className="w-12 h-12 rounded-xl bg-linear-to-br from-burgundy via-burgundy-deep to-[#3D0A12] text-white flex items-center justify-center shrink-0 shadow-md ring-2 ring-burgundy/20 dark:ring-burgundy/50">
                  <Trophy className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-burgundy dark:text-[#E89BA5]">
                      Grand Hackathon Award
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-extrabold bg-burgundy text-white uppercase tracking-wider shadow-2xs">
                      Official Prize Pool
                    </span>
                  </div>
                  <div className="flex flex-wrap items-baseline gap-2 mt-0.5">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Total Prize Pool:
                    </span>
                    <span className="font-serif text-2xl sm:text-3xl font-black text-burgundy dark:text-[#FAF6F3] tracking-tight">
                      Up to ₹1,00,000
                    </span>
                    <span className="text-xs font-bold text-burgundy/80 dark:text-[#E89BA5]/90 font-mono">
                      (1 Lakh Rupees)
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                <div className="px-3.5 py-1.5 rounded-xl bg-burgundy/10 dark:bg-burgundy/25 border border-burgundy/25 dark:border-burgundy/50 shadow-2xs text-xs font-mono font-bold text-burgundy dark:text-[#E89BA5]">
                  <span>Phase 1 & Phase 2 Awards</span>
                </div>
              </div>
            </div>
          </div>

          {/* Pending Invitations Alert Banner */}
          {pendingInvitations.length > 0 && (
            <div className="mb-8 space-y-3">
              <h2 className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-burgundy dark:text-[#E89BA5] flex items-center gap-1.5">
                <Users className="w-4 h-4" />
                Action Required: Pending Team Invitations ({pendingInvitations.length})
              </h2>

              {respondingInviteErr && (
                <div className="p-3.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs flex items-center justify-between gap-2 animate-in fade-in">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                    <span>{respondingInviteErr}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRespondingInviteErr('')}
                    className="p-1 text-rose-600 hover:text-rose-800 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pendingInvitations.map((inv) => {
                  const isProcessing = respondingInviteId === inv.invitationId;
                  return (
                    <div
                      key={inv.invitationId}
                      className="p-5 bg-white dark:bg-[#150709] border-2 border-burgundy/40 dark:border-burgundy/60 rounded-xl shadow-xs space-y-3"
                    >
                      <div>
                        <span className="text-sm font-bold uppercase tracking-wider text-burgundy dark:text-[#E89BA5] block">
                          Team Invitation
                        </span>
                        <h3 className="text-base font-bold text-slate-900 dark:text-[#FAF6F3]">{inv.teamName}</h3>
                        <p className="text-base text-slate-600 dark:text-slate-300 mt-1">
                          Invited by <span className="font-semibold text-slate-800 dark:text-[#FAF6F3]">{inv.leadName}</span> ({inv.leadEmail})
                        </p>
                      </div>

                      <div className="text-sm bg-slate-50 dark:bg-[#1C0A0D] p-2.5 rounded border border-slate-200 dark:border-[#3D1418] text-slate-700 dark:text-slate-300 space-y-1">
                        <div>
                          <span className="font-bold">Track:</span> {inv.vertical}
                        </div>
                        <div>
                          <span className="font-bold">Problem Statement:</span> {inv.problemStatementId}
                        </div>
                      </div>

                      <p className="text-base text-slate-500 dark:text-slate-400 leading-snug">
                        Accepting this invitation confirms you as a full team member and unlocks the
                        dossier for {inv.problemStatementId}. You cannot join other teams once accepted.
                      </p>

                      <div className="flex gap-2 pt-1">
                        <button
                          disabled={isProcessing}
                          onClick={() => handleInviteResponse(inv.invitationId, 'accept')}
                          className="flex-1 px-4 py-2 bg-burgundy text-white text-sm font-semibold rounded hover:bg-burgundy-deep transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                        >
                          {isProcessing ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>Joining Team...</span>
                            </>
                          ) : (
                            <span>Accept Invitation</span>
                          )}
                        </button>
                        <button
                          disabled={isProcessing}
                          onClick={() => handleInviteResponse(inv.invitationId, 'decline')}
                          className="px-4 py-2 bg-slate-100 dark:bg-[#1C0A0D] hover:bg-slate-200 dark:hover:bg-[#250D11] text-slate-700 dark:text-slate-300 text-sm font-semibold rounded transition-colors cursor-pointer disabled:opacity-50"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Main Layout: Either Active Team Dashboard OR Team Formation Form */}
          {team ? (
            /* ACTIVE TEAM DASHBOARD */
            <div className="space-y-8">
              {/* Team Summary Card */}
              <div className="bg-white dark:bg-[#150709] border border-slate-200 dark:border-[#3D1418] rounded-xl p-6 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-[#3D1418]">
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-bold uppercase tracking-wider text-burgundy dark:text-[#E89BA5] block mb-1">
                      Your Hackathon Team
                    </span>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-[#FAF6F3]">{team.name}</h2>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600 dark:text-slate-300 mt-1">
                      <span>Track: <span className="font-semibold text-slate-800 dark:text-[#FAF6F3]">{team.vertical}</span></span>
                      <span>·</span>
                      <span>Problem Statement: <span className="font-mono font-bold text-burgundy dark:text-[#E89BA5]">{team.problem_statement_id}</span></span>
                      <button
                        type="button"
                        onClick={handleToggleChangePS}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-burgundy/30 bg-burgundy/5 dark:bg-burgundy/20 hover:bg-burgundy/10 text-burgundy dark:text-[#E89BA5] text-xs font-semibold transition-all cursor-pointer ml-0 sm:ml-1 mt-1 sm:mt-0"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>{isChangingPS ? 'Close Switcher' : 'Change Problem Statement'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center sm:justify-end gap-2.5 shrink-0 sm:ml-auto self-start sm:self-center">
                    <span className="px-3 py-1 rounded-full bg-burgundy/10 dark:bg-burgundy/25 text-burgundy dark:text-[#E89BA5] font-bold text-xs sm:text-sm border border-burgundy/25 dark:border-burgundy/40 flex items-center gap-1.5 shadow-2xs">
                      <Trophy className="w-3.5 h-3.5 text-burgundy dark:text-[#E89BA5]" />
                      Prize Pool: Up to ₹1,00,000
                    </span>
                    {isFinalized ? (
                      <span className="px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold text-xs sm:text-sm border border-emerald-300 dark:border-emerald-700 flex items-center gap-1.5 shadow-2xs">
                        <Lock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        Team Roster Finalized & Locked ({confirmedMembers.length} Members)
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 font-bold text-xs sm:text-sm border border-amber-200 dark:border-amber-800 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                        Draft Roster ({confirmedMembers.length}/6 Confirmed)
                      </span>
                    )}
                  </div>
                </div>

                {/* Success Feedback Alert */}
                {changePSSuccess && (
                  <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs sm:text-sm flex items-center justify-between gap-2 animate-in fade-in">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>{changePSSuccess}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setChangePSSuccess('')}
                      className="text-emerald-600 hover:text-emerald-800 dark:hover:text-emerald-200 p-1 rounded cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Change Problem Statement Drawer / Panel */}
                {isChangingPS && (
                  <div
                    id="problem-statement-switcher"
                    className="p-4 sm:p-5 rounded-xl border-2 border-burgundy/30 dark:border-[#E89BA5]/30 bg-slate-50/70 dark:bg-[#1A090C] space-y-4 animate-in fade-in slide-in-from-top-2 duration-200 scroll-mt-24"
                  >
                    <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-200 dark:border-[#3D1418]">
                      <div>
                        <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-[#FAF6F3] flex items-center gap-2">
                          <Edit3 className="w-4 h-4 text-burgundy dark:text-[#E89BA5]" />
                          Switch Problem Statement for {team.name}
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                          You can switch to any problem statement at any time. Your team roster, team name, and code submissions remain completely safe and untouched.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsChangingPS(false)}
                        className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                        aria-label="Close editor"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Change Vertical Select */}
                    <div>
                      <label className="block text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                        Domain Vertical:
                      </label>
                      <select
                        value={changeVertical}
                        onChange={(e) => handleChangeVertical(e.target.value as VerticalType)}
                        className="w-full px-3.5 py-2 text-xs sm:text-sm border border-slate-300 dark:border-[#3D1418] rounded-lg bg-white dark:bg-[#150709] font-medium text-slate-900 dark:text-[#FAF6F3] focus:outline-none focus:ring-1 focus:ring-burgundy"
                      >
                        {VERTICALS.map((v) => (
                          <option key={v} value={v}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Statement Radio Cards with Full Description from PDF */}
                    <div className="space-y-3">
                      <label className="block text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200">
                        Select Problem Statement in {changeVertical}:
                      </label>
                      {changeVerticalStatements.map((ps) => {
                        const isChosen = changePSId === ps.id;
                        return (
                          <label
                            key={ps.id}
                            className={`block p-3.5 sm:p-4 rounded-xl border text-xs sm:text-sm cursor-pointer transition-all ${
                              isChosen
                                ? 'bg-burgundy/10 dark:bg-burgundy/30 border-burgundy dark:border-[#E89BA5] ring-1 ring-burgundy dark:ring-[#E89BA5] text-slate-900 dark:text-[#FAF6F3] shadow-xs'
                                : 'bg-white dark:bg-[#150709] border-slate-200 dark:border-[#3D1418] text-slate-700 dark:text-slate-300 hover:bg-slate-100/60 dark:hover:bg-[#200B0E]'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <input
                                type="radio"
                                name="changeProblemStatement"
                                value={ps.id}
                                checked={isChosen}
                                onChange={() => setChangePSId(ps.id)}
                                className="mt-1 text-burgundy focus:ring-burgundy cursor-pointer shrink-0"
                              />
                              <div className="flex-1 min-w-0 space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-bold text-slate-900 dark:text-[#FAF6F3] font-mono text-xs bg-slate-200 dark:bg-[#250D11] px-2 py-0.5 rounded border border-slate-300/60 dark:border-[#3D1418]">
                                    {ps.id}
                                  </span>
                                  <span className="font-semibold text-slate-900 dark:text-[#FAF6F3]">
                                    {ps.title.split(': ')[1] || ps.title}
                                  </span>
                                </div>
                                <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed">
                                  {ps.subtitle}
                                </p>
                              </div>
                            </div>

                            {/* Mandatory Drive Notice */}
                            {isChosen && (
                              <div className="mt-3.5 pt-3.5 border-t border-burgundy/20 dark:border-[#E89BA5]/30 animate-in fade-in slide-in-from-top-1 duration-200">
                                <ProblemStatementDriveNotice psId={ps.id} />
                              </div>
                            )}
                          </label>
                        );
                      })}
                    </div>

                    {changePSError && (
                      <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs sm:text-sm flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                        <span>{changePSError}</span>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row items-center gap-2 pt-2">
                      <button
                        type="button"
                        onClick={handleUpdateProblemStatement}
                        disabled={isSubmittingPSChange || changePSId === team.problem_statement_id}
                        className="w-full sm:w-auto px-4 py-2.5 bg-burgundy hover:bg-burgundy-deep text-white text-xs sm:text-sm font-bold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        {isSubmittingPSChange ? (
                          <span>Updating in Supabase...</span>
                        ) : (
                          <>
                            <Check className="w-4 h-4" />
                            <span>Confirm & Switch to {changePSId}</span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsChangingPS(false)}
                        className="w-full sm:w-auto px-4 py-2.5 bg-slate-100 dark:bg-[#1C0A0D] hover:bg-slate-200 dark:hover:bg-[#250D11] text-slate-700 dark:text-slate-300 text-xs sm:text-sm font-semibold rounded-lg transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Team Roster */}
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-[#FAF6F3]">
                        Team Members Roster (2–6 Members)
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {isFinalized
                          ? 'Your team roster is finalized and permanently locked.'
                          : 'Manage your roster. Add, remove, or resend invites freely before finalization (min 2, max 6 accepted members).'}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs px-2.5 py-1 rounded-md bg-slate-100 dark:bg-[#1C0A0D] border border-slate-200 dark:border-[#3D1418] text-slate-700 dark:text-slate-300 font-semibold">
                        {confirmedMembers.length}/6 Confirmed
                        {pendingMembers.length > 0 ? ` · ${pendingMembers.length} Pending` : ''}
                        {declinedMembers.length > 0 ? ` · ${declinedMembers.length} Declined` : ''}
                      </span>
                      <button
                        type="button"
                        onClick={async () => {
                          setIsRefreshingRoster(true);
                          await mutateTeam();
                          setTimeout(() => setIsRefreshingRoster(false), 500);
                        }}
                        disabled={isRefreshingRoster}
                        title="Check for newly accepted teammate invitations"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 dark:bg-[#1C0A0D] hover:bg-slate-200 dark:hover:bg-[#250D11] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#3D1418] text-xs font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingRoster ? 'animate-spin' : ''}`} />
                        <span>Refresh Roster</span>
                      </button>
                      {canAddMore && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsAddingMember(!isAddingMember);
                            setMemberActionMsg('');
                            setMemberActionErr('');
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-burgundy hover:bg-burgundy-deep text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer shadow-xs"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>{isAddingMember ? 'Close' : 'Add Teammate'}</span>
                        </button>
                      )}
                    </div>
                  </div>



                  {/* Feedback alerts */}
                  {memberActionMsg && (
                    <div className="p-4 rounded-xl bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs space-y-2.5 animate-in fade-in">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                          <div className="space-y-1">
                            <p className="font-bold text-slate-900 dark:text-[#FAF6F3] text-sm">
                              {memberActionMsg}
                            </p>
                            <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-xs">
                              <strong>Important:</strong> Invitations are delivered in-platform (no external email is sent). Your teammate must sign into this portal to see and accept their invitation.
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setMemberActionMsg('');
                            setRecentInvitedEmail(null);
                          }}
                          className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                          aria-label="Dismiss notification"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {recentInvitedEmail && (
                        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-emerald-200/60 dark:border-emerald-900/40">
                          <button
                            type="button"
                            onClick={() => handleCopyInviteMessage(recentInvitedEmail)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors cursor-pointer shadow-xs"
                          >
                            {copiedInviteEmail === recentInvitedEmail ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                <span>Invite Message Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>Copy Invite Message</span>
                              </>
                            )}
                          </button>

                          <a
                            href={getWhatsAppShareUrl(recentInvitedEmail)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-900/60 dark:hover:bg-emerald-900 text-emerald-950 dark:text-emerald-100 border border-emerald-300 dark:border-emerald-700 font-semibold text-xs transition-colors"
                          >
                            <MessageCircle className="w-3.5 h-3.5 text-[#25D366]" />
                            <span>Share on WhatsApp</span>
                            <ExternalLink className="w-3 h-3 text-[#25D366]" />
                          </a>
                        </div>
                      )}
                    </div>
                  )}

                  {memberActionErr && (
                    <div className="p-3.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs space-y-2 animate-in fade-in">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                          <span>{memberActionErr}</span>
                        </div>
                        <button type="button" onClick={() => setMemberActionErr('')} className="p-1 text-rose-600 hover:text-rose-800 cursor-pointer">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {(memberActionErr.toLowerCase().includes('whitelist') ||
                        memberActionErr.toLowerCase().includes('authorized') ||
                        memberActionErr.toLowerCase().includes('unstop')) && (
                        <div className="flex flex-wrap items-center gap-2 pl-6 pt-1">
                          <a
                            href={REGISTRATION_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-rose-100 hover:bg-rose-200 dark:bg-rose-900/40 dark:hover:bg-rose-900/70 text-rose-900 dark:text-rose-200 font-semibold text-xs transition-colors"
                          >
                            <span>Register on Unstop</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                          <a
                            href={WHATSAPP_COMMUNITY_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950/60 dark:hover:bg-emerald-900 text-emerald-900 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800 font-semibold text-xs transition-colors"
                          >
                            <MessageCircle className="w-3 h-3 text-[#25D366]" />
                            <span>Join WhatsApp Group</span>
                            <ExternalLink className="w-3 h-3 text-[#25D366]" />
                          </a>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Inline Add Member Panel */}
                  {isAddingMember && (
                    <form onSubmit={handleAddMemberToTeam} className="p-4 rounded-xl border border-burgundy/30 bg-burgundy/[0.03] dark:bg-burgundy/10 space-y-3 animate-in fade-in slide-in-from-top-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-burgundy dark:text-[#E89BA5]">
                          Invite Additional Teammate (Up to 6 total)
                        </span>
                        <button type="button" onClick={() => setIsAddingMember(false)} className="text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="text-[11.5px] text-slate-600 dark:text-slate-300 leading-relaxed bg-white/70 dark:bg-[#150709] p-2.5 rounded-lg border border-slate-200/80 dark:border-[#3D1418]">
                        <strong>In-Portal Invites:</strong> No external email is sent. After you send the invite, your teammate simply signs into <span className="font-mono font-semibold text-burgundy dark:text-[#E89BA5]">qffsrmap2026.com/learning/hackathon</span> with their registered Gmail to accept.
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Teammate Email (Registered Gmail):
                          </label>
                          <input
                            type="email"
                            value={newMemberEmail}
                            onChange={(e) => setNewMemberEmail(e.target.value)}
                            placeholder="teammate@gmail.com"
                            required
                            className="w-full px-3 py-1.5 text-xs rounded border border-slate-300 dark:border-[#3D1418] bg-white dark:bg-[#150709] text-slate-900 dark:text-[#FAF6F3] focus:outline-none focus:ring-1 focus:ring-burgundy"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Full Name (Optional):
                          </label>
                          <input
                            type="text"
                            value={newMemberName}
                            onChange={(e) => setNewMemberName(e.target.value)}
                            placeholder="Teammate Full Name"
                            className="w-full px-3 py-1.5 text-xs rounded border border-slate-300 dark:border-[#3D1418] bg-white dark:bg-[#150709] text-slate-900 dark:text-[#FAF6F3] focus:outline-none focus:ring-1 focus:ring-burgundy"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            University / College *:
                          </label>
                          <input
                            type="text"
                            value={newMemberUniversity}
                            onChange={(e) => setNewMemberUniversity(e.target.value)}
                            placeholder="e.g. SRM University-AP"
                            required
                            className="w-full px-3 py-1.5 text-xs rounded border border-slate-300 dark:border-[#3D1418] bg-white dark:bg-[#150709] text-slate-900 dark:text-[#FAF6F3] focus:outline-none focus:ring-1 focus:ring-burgundy"
                          />
                        </div>
                      </div>

                      {/* Validation status badge */}
                      {newMemberStatus !== 'idle' && (
                        <div className="text-xs pt-1">
                          {newMemberStatus === 'checking' && (
                            <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                              <RefreshCw className="w-3 h-3 animate-spin text-slate-500 dark:text-slate-400" />
                              Verifying platform whitelist...
                            </span>
                          )}

                          {newMemberStatus === 'valid' && (
                            <span className="text-emerald-700 dark:text-emerald-300 font-medium flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                              Authorized & Available
                            </span>
                          )}

                          {newMemberStatus === 'not_whitelisted' && (
                            <div className="w-full rounded-lg border border-amber-300/80 dark:border-amber-700/60 bg-amber-50/90 dark:bg-amber-950/40 p-2.5 space-y-1.5 animate-in fade-in duration-200">
                              <div className="flex items-center gap-1.5 font-semibold text-amber-800 dark:text-amber-300">
                                <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                                <span>Email not found in registered whitelist</span>
                              </div>
                              <p className="text-[11.5px] leading-relaxed text-amber-900/90 dark:text-amber-200/90 pl-5">
                                Tell your team member to register on Unstop and join the WhatsApp group for quickly resolving the issue.
                              </p>
                              <div className="flex flex-wrap items-center gap-2 pl-5 pt-0.5">
                                <a
                                  href={REGISTRATION_URL}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-200/80 hover:bg-amber-300/90 dark:bg-amber-900/60 dark:hover:bg-amber-900 text-amber-950 dark:text-amber-100 font-semibold text-[11px] transition-colors"
                                >
                                  <span>Register on Unstop</span>
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                                <a
                                  href={WHATSAPP_COMMUNITY_URL}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950/60 dark:hover:bg-emerald-900 text-emerald-900 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800 font-semibold text-[11px] transition-colors"
                                >
                                  <MessageCircle className="w-3 h-3 text-[#25D366]" />
                                  <span>Join WhatsApp Group</span>
                                  <ExternalLink className="w-3 h-3 text-[#25D366]" />
                                </a>
                              </div>
                            </div>
                          )}

                          {newMemberStatus === 'already_in_team' && (
                            <span className="text-rose-700 dark:text-rose-300 font-medium flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                              Already registered in another team
                            </span>
                          )}
                        </div>
                      )}

                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setIsAddingMember(false)}
                          className="px-3 py-1.5 text-xs rounded border border-slate-200 dark:border-[#3D1418] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#200B0E] cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={isSubmittingNewMember || !newMemberEmail.trim() || newMemberStatus === 'not_whitelisted' || newMemberStatus === 'checking'}
                          className="px-4 py-1.5 text-xs font-bold rounded bg-burgundy hover:bg-burgundy-deep text-white transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                        >
                          {isSubmittingNewMember ? (
                            <span>Inviting...</span>
                          ) : (
                            <>
                              <Send className="w-3.5 h-3.5" />
                              <span>Send In-Portal Invite</span>
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Member cards grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {team.members?.map((m: any) => {
                      const isLeader = m.role === 'leader';
                      const isPending = m.status === 'invited';
                      const isLeaderOrAdmin = team.currentUserRole === 'leader' || Boolean(sessionUser?.isAdmin);
                      const canRemove =
                        !isFinalized &&
                        !isLeader &&
                        (isLeaderOrAdmin ||
                          isPending ||
                          m.email?.toLowerCase() === sessionUser?.email?.toLowerCase());

                      return (
                        <div
                          key={m.id}
                          className="p-3.5 rounded-xl border border-slate-200 dark:border-[#3D1418] bg-slate-50 dark:bg-[#1C0A0D] text-xs space-y-2 flex flex-col justify-between"
                        >
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-bold text-slate-900 dark:text-[#FAF6F3] truncate text-sm">
                                {m.full_name || (m.email || '').split('@')[0]}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${
                                  isLeader
                                    ? 'bg-burgundy/15 text-burgundy dark:bg-burgundy/25 dark:text-[#E89BA5]'
                                    : 'bg-slate-200 dark:bg-[#250D11] text-slate-700 dark:text-slate-300'
                                }`}
                              >
                                {m.role}
                              </span>
                            </div>
                            <span className="text-slate-500 dark:text-slate-400 truncate block font-mono text-[11px]">
                              {m.email}
                            </span>
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-300 pt-0.5">
                              <GraduationCap className="w-3.5 h-3.5 text-burgundy dark:text-[#E89BA5] shrink-0" />
                              <span className="truncate font-medium">{m.university || 'SRM University-AP'}</span>
                            </div>
                          </div>

                          <div className="pt-2 border-t border-slate-200/60 dark:border-[#3D1418] flex items-center justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              {m.status === 'accepted' ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> Confirmed
                                </span>
                              ) : m.status === 'invited' ? (
                                <div className="space-y-1.5 w-full">
                                  <div className="flex items-center justify-between gap-1.5">
                                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                                      <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
                                      <span>Pending Acceptance</span>
                                    </span>
                                    {!isFinalized && (isLeaderOrAdmin || team.currentUserStatus === 'accepted') && (
                                      <button
                                        type="button"
                                        onClick={() => handleResendInvite(m.id, m.email)}
                                        disabled={resendingMemberId === m.id}
                                        title="Refresh in-portal invitation"
                                        className="text-[10px] font-semibold text-slate-500 hover:text-burgundy dark:hover:text-[#E89BA5] underline cursor-pointer"
                                      >
                                        {resendingMemberId === m.id ? 'Refreshing...' : 'Refresh'}
                                      </button>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 pt-0.5 border-t border-slate-100 dark:border-[#3D1418]/60">
                                    <button
                                      type="button"
                                      onClick={() => handleCopyInviteMessage(m.email)}
                                      title="Copy invite text for this teammate"
                                      className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-burgundy dark:text-[#E89BA5] hover:underline cursor-pointer"
                                    >
                                      {copiedInviteEmail === m.email ? (
                                        <>
                                          <Check className="w-3 h-3 text-emerald-600" />
                                          <span>Copied!</span>
                                        </>
                                      ) : (
                                        <>
                                          <Copy className="w-3 h-3" />
                                          <span>Copy Invite</span>
                                        </>
                                      )}
                                    </button>
                                    <span className="text-slate-300 dark:text-slate-600 text-[10px]">·</span>
                                    <a
                                      href={getWhatsAppShareUrl(m.email)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      title="Share invite via WhatsApp"
                                      className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-emerald-700 dark:text-emerald-400 hover:underline"
                                    >
                                      <MessageCircle className="w-3 h-3 text-[#25D366]" />
                                      <span>WhatsApp</span>
                                    </a>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold">Declined</span>
                                  {!isFinalized && (isLeaderOrAdmin || team.currentUserStatus === 'accepted') && (
                                    <button
                                      type="button"
                                      onClick={() => handleResendInvite(m.id, m.email)}
                                      disabled={resendingMemberId === m.id}
                                      className="text-[10px] font-bold text-burgundy dark:text-[#E89BA5] underline hover:text-burgundy-deep cursor-pointer"
                                    >
                                      {resendingMemberId === m.id ? 'Resending...' : 'Resend Invite'}
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Remove / Cancel Invite button */}
                            {canRemove && (
                              <button
                                type="button"
                                onClick={() => handleRemoveMember(m.id, m.email)}
                                disabled={removingMemberId === m.id}
                                title={isPending ? 'Cancel in-portal invitation' : 'Remove from team'}
                                className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded text-[10.5px] font-semibold text-rose-600 hover:text-rose-800 dark:text-rose-400 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>{removingMemberId === m.id ? 'Removing...' : isPending ? 'Cancel' : 'Remove'}</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Team Finalization Banner & Action */}
                  {team.currentUserRole === 'leader' ? (
                    <>
                      {!isFinalized ? (
                        <div className="p-4 rounded-xl border border-burgundy/30 bg-burgundy/[0.04] dark:bg-[#1A090C] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Shield className="w-4 h-4 text-burgundy dark:text-[#E89BA5]" />
                              <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-[#FAF6F3]">
                                Finalize & Lock Team Roster
                              </h4>
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-burgundy/10 text-burgundy dark:bg-burgundy/20 dark:text-[#E89BA5] font-bold uppercase tracking-wider">
                                Draft Mode
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-300 max-w-xl leading-relaxed">
                              You can freely add, remove, and resend teammate invitations. Once all teammates have accepted, click <strong>Finalize Team Roster</strong> to lock your team. Once finalized, the roster cannot be modified.
                            </p>
                            {confirmedMembers.length < 2 ? (
                              <p className="text-[11px] text-amber-700 dark:text-amber-400 font-semibold flex items-center gap-1">
                                <Clock className="w-3 h-3 shrink-0" />
                                <span>Waiting for at least 1 teammate to accept their invite before you can finalize (currently {confirmedMembers.length} confirmed).</span>
                              </p>
                            ) : (
                              <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 shrink-0" />
                                <span>Ready to finalize! You have {confirmedMembers.length} confirmed members (2–6 required).</span>
                              </p>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setFinalizeError('');
                              setIsFinalizeModalOpen(true);
                            }}
                            disabled={confirmedMembers.length < 2 || isFinalizingTeam}
                            className="px-4 py-2.5 rounded-lg bg-burgundy hover:bg-burgundy-deep text-white font-bold text-xs disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 shrink-0 shadow-xs cursor-pointer transition-colors"
                          >
                            <Lock className="w-3.5 h-3.5" />
                            <span>Finalize Team Roster</span>
                          </button>
                        </div>
                      ) : (
                        <div className="p-3.5 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50/80 dark:bg-emerald-950/40 flex items-center justify-between gap-3 text-xs">
                          <div className="flex items-center gap-2.5 text-emerald-900 dark:text-emerald-200">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            <span>
                              <strong>Team Roster Permanently Finalized:</strong> Your team of {confirmedMembers.length} members is officially locked. Team roster cannot be edited anymore.
                            </span>
                          </div>
                          <span className="font-mono text-[11px] font-bold text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/60 shrink-0">
                            LOCKED
                          </span>
                        </div>
                      )}
                    </>
                  ) : isFinalized ? (
                    <div className="p-3.5 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50/80 dark:bg-emerald-950/40 flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2.5 text-emerald-900 dark:text-emerald-200">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span>
                          <strong>Team Roster Permanently Finalized:</strong> Your team of {confirmedMembers.length} members is officially locked.
                        </span>
                      </div>
                      <span className="font-mono text-[11px] font-bold text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/60 shrink-0">
                        LOCKED
                      </span>
                    </div>
                  ) : null}

                  {/* Finalize success feedback */}
                  {finalizeSuccess && (
                    <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs flex items-center justify-between gap-2 animate-in fade-in">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span>{finalizeSuccess}</span>
                      </div>
                      <button type="button" onClick={() => setFinalizeSuccess('')} className="p-1 text-emerald-600 hover:text-emerald-800 cursor-pointer">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* GitHub Repository Submission Card */}
              <div className="bg-white dark:bg-[#150709] border border-slate-200 dark:border-[#3D1418] rounded-xl p-6 shadow-xs space-y-4">
                <div className="flex items-center gap-2 text-slate-900 dark:text-[#FAF6F3]">
                  <Github className="w-5 h-5 text-burgundy dark:text-[#E89BA5]" />
                  <h3 className="text-base font-bold">Hackathon Code Submission</h3>
                </div>
                <p className="text-base text-slate-600 dark:text-slate-300 leading-relaxed">
                  Provide your team&apos;s public GitHub, GitLab, or Hugging Face Space repository link.
                </p>

                {repoSuccessMsg && (
                  <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-sm flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>{repoSuccessMsg}</span>
                  </div>
                )}

                {repoErrorMsg && (
                  <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                    <span>{repoErrorMsg}</span>
                  </div>
                )}

                <form onSubmit={handleSubmitGithub} className="space-y-3">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="url"
                      value={githubUrl}
                      onChange={(e) => setGithubUrl(e.target.value)}
                      placeholder="https://github.com/organization/qff-2026-solution"
                      required
                      className="flex-1 px-4 py-2.5 text-sm border border-slate-300 dark:border-[#3D1418] bg-white dark:bg-[#1C0A0D] text-slate-900 dark:text-[#FAF6F3] rounded focus:outline-none focus:ring-1 focus:ring-burgundy focus:border-burgundy dark:placeholder-slate-500"
                    />
                    <button
                      type="submit"
                      disabled={isSubmittingRepo}
                      className="px-4 py-2 bg-slate-900 dark:bg-burgundy text-white text-sm font-semibold rounded hover:bg-slate-800 dark:hover:bg-burgundy-deep transition-colors shrink-0 disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      {team.github_repo_url ? 'Update Repository Link' : 'Submit Repository'}
                    </button>
                  </div>

                  {team.github_repo_url && (
                    <div className="p-2.5 rounded bg-slate-50 dark:bg-[#1C0A0D] border border-slate-200 dark:border-[#3D1418] text-sm flex items-center justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Active submission:</span>
                      <a
                        href={team.github_repo_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-burgundy dark:text-[#E89BA5] font-semibold hover:underline flex items-center gap-1"
                      >
                        {team.github_repo_url}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                </form>
              </div>

              {/* UNLOCKED PROBLEM STATEMENT DOSSIER */}
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-[#FAF6F3] flex items-center gap-2">
                      <Shield className="w-4 h-4 text-burgundy dark:text-[#E89BA5]" />
                      <span>Unlocked Problem Statement Dossier ({team.problem_statement_id})</span>
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Confidential to Team {team.name}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleToggleChangePS}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-burgundy/30 bg-burgundy/5 dark:bg-burgundy/20 hover:bg-burgundy/10 text-burgundy dark:text-[#E89BA5] text-xs font-semibold transition-all cursor-pointer self-start sm:self-auto shadow-2xs"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>{isChangingPS ? 'Close Switcher' : 'Change Problem Statement'}</span>
                  </button>
                </div>

                {selectedPSObj ? (
                  <ProblemStatementDossier ps={selectedPSObj} />
                ) : (
                  <div className="p-6 bg-white dark:bg-[#150709] border border-slate-200 dark:border-[#3D1418] rounded-xl text-center text-base text-slate-600 dark:text-slate-400">
                    Problem statement details could not be found.
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* TEAM FORMATION & PROBLEM SELECTION FORM */
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="bg-white dark:bg-[#150709] border border-slate-200 dark:border-[#3D1418] rounded-xl p-6 shadow-xs space-y-6">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-[#FAF6F3]">
                      Step 1: Choose Domain Track & Problem Statement
                    </h2>
                    <p className="text-base text-slate-600 dark:text-slate-300 mt-1">
                      Choose from 5 domain verticals. Each vertical contains 3 specialized problem
                      statements and 1 open innovation track. Your team will unlock the full
                      technical dossier for the selected statement upon creation.
                    </p>
                    <div className="inline-flex items-center gap-2 mt-2 px-3 py-1.5 rounded-lg bg-burgundy/10 dark:bg-burgundy/25 border border-burgundy/25 dark:border-burgundy/40 text-burgundy dark:text-[#E89BA5] text-xs font-semibold">
                      <Trophy className="w-3.5 h-3.5 text-burgundy dark:text-[#E89BA5]" />
                      <span>Hackathon Grand Prize Pool: <strong>Up to ₹1,00,000</strong></span>
                    </div>
                  </div>

                  {/* Mandatory Drive Notice across all statements */}
                  <ProblemStatementDriveNotice />

                  {/* Vertical Selection Dropdown */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                      Select Domain Vertical:
                    </label>
                    <select
                      value={selectedVertical}
                      onChange={(e) => handleVerticalChange(e.target.value as VerticalType)}
                      className="w-full px-4 py-2.5 text-sm border border-slate-300 dark:border-[#3D1418] rounded-lg bg-white dark:bg-[#1C0A0D] font-medium text-slate-900 dark:text-[#FAF6F3] focus:outline-none focus:ring-1 focus:ring-burgundy focus:border-burgundy"
                    >
                      {VERTICALS.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Problem Statement Radio/Card Selection */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2">
                      Choose Problem Statement in {selectedVertical}:
                    </label>
                    <div className="space-y-3">
                      {verticalStatements.map((ps) => {
                        const isSelected = selectedPSId === ps.id;
                        return (
                          <label
                            key={ps.id}
                            className={`block p-3.5 sm:p-4 rounded-xl border text-sm cursor-pointer transition-all ${
                              isSelected
                                ? 'bg-burgundy/5 dark:bg-burgundy/25 border-burgundy dark:border-[#E89BA5] ring-1 ring-burgundy dark:ring-[#E89BA5] text-slate-900 dark:text-[#FAF6F3] shadow-xs'
                                : 'bg-slate-50/50 dark:bg-[#1C0A0D]/60 border-slate-200 dark:border-[#3D1418] text-slate-700 dark:text-slate-300 hover:bg-slate-100/60 dark:hover:bg-[#250D11]'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <input
                                type="radio"
                                name="problemStatement"
                                value={ps.id}
                                checked={isSelected}
                                onChange={() => setSelectedPSId(ps.id)}
                                className="mt-1 text-burgundy focus:ring-burgundy cursor-pointer shrink-0"
                              />
                              <div className="flex-1 min-w-0 space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-bold text-slate-900 dark:text-[#FAF6F3] font-mono text-xs sm:text-sm bg-slate-200 dark:bg-[#250D11] px-2 py-0.5 rounded border border-slate-300/60 dark:border-[#3D1418]">
                                    {ps.id}
                                  </span>
                                  <span className="font-semibold text-xs sm:text-sm text-slate-900 dark:text-[#FAF6F3]">
                                    {ps.title.split(': ')[1] || ps.title}
                                  </span>
                                </div>
                                <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm leading-relaxed">
                                  {ps.subtitle}
                                </p>
                              </div>
                            </div>

                            {/* Mandatory Drive Notice - Revealed on selection */}
                            {isSelected && (
                              <div className="mt-3.5 pt-3.5 border-t border-burgundy/15 dark:border-[#E89BA5]/20 animate-in fade-in slide-in-from-top-1 duration-200">
                                <ProblemStatementDriveNotice psId={ps.id} />
                              </div>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Step 2: Team Details */}
                  <div className="pt-6 border-t border-slate-200 dark:border-[#3D1418] space-y-4">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900 dark:text-[#FAF6F3]">
                        Step 2: Team Name & Members (2–6 Members)
                      </h2>
                      <p className="text-base text-slate-600 dark:text-slate-300 mt-1">
                        Team names must be globally unique. You are the team leader. Teams must consist of 2 to 6 members (1 leader + 1 to 5 teammates). Add between 1 and 5 additional teammates. Teammate Gmails are authenticated in real time against the platform whitelist.
                      </p>
                    </div>

                    {teamFormError && (
                      <div className="p-3.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs sm:text-sm space-y-2">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                          <span className="leading-relaxed">{teamFormError}</span>
                        </div>
                        {(teamFormError.toLowerCase().includes('whitelist') ||
                          teamFormError.toLowerCase().includes('unstop')) && (
                          <div className="flex flex-wrap items-center gap-2 pl-6 pt-0.5">
                            <a
                              href={REGISTRATION_URL}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-rose-100 hover:bg-rose-200 dark:bg-rose-900/40 dark:hover:bg-rose-900/70 text-rose-900 dark:text-rose-200 font-semibold text-xs transition-colors"
                            >
                              <span>Register on Unstop</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                            <a
                              href={WHATSAPP_COMMUNITY_URL}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950/60 dark:hover:bg-emerald-900 text-emerald-900 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800 font-semibold text-xs transition-colors"
                            >
                              <MessageCircle className="w-3 h-3 text-[#25D366]" />
                              <span>Join WhatsApp Group</span>
                              <ExternalLink className="w-3 h-3 text-[#25D366]" />
                            </a>
                          </div>
                        )}
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">
                        Team Name:
                      </label>
                      <input
                        type="text"
                        value={teamName}
                        onChange={(e) => setTeamName(e.target.value)}
                        placeholder="e.g. Quantum Singularity Labs"
                        required
                        className="w-full px-4 py-2.5 text-sm border border-slate-300 dark:border-[#3D1418] bg-white dark:bg-[#1C0A0D] text-slate-900 dark:text-[#FAF6F3] rounded-lg focus:outline-none focus:ring-1 focus:ring-burgundy focus:border-burgundy dark:placeholder-slate-500"
                      />
                    </div>

                    {/* Team Leader Badge & University Input */}
                    <div className="p-3.5 rounded-lg border border-slate-200 dark:border-[#3D1418] bg-slate-50 dark:bg-[#1C0A0D] text-sm space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 dark:text-[#FAF6F3]">
                          Team Leader: {sessionUser?.fullName || 'You'}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-burgundy/10 dark:bg-burgundy/20 text-burgundy dark:text-[#E89BA5] uppercase">
                          Leader (Confirmed)
                        </span>
                      </div>
                      <span className="text-slate-500 dark:text-slate-400 font-mono text-xs block">{sessionUser?.email}</span>
                      
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Leader University / Institution Name *:
                        </label>
                        <input
                          type="text"
                          value={leadUniversity}
                          onChange={(e) => setLeadUniversity(e.target.value)}
                          placeholder="e.g. SRM University-AP, IIT Madras, etc."
                          required
                          className="w-full px-3 py-1.5 text-xs bg-white dark:bg-[#150709] border border-slate-300 dark:border-[#3D1418] text-slate-900 dark:text-[#FAF6F3] rounded focus:outline-none focus:ring-1 focus:ring-burgundy focus:border-burgundy dark:placeholder-slate-500"
                        />
                      </div>
                    </div>

                    {/* Additional Teammates */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                          Additional Teammates ({teammates.length}/5)
                        </span>
                      </div>

                      {teammates.map((m, idx) => {
                        const isLast = idx === teammates.length - 1;
                        return (
                          <TeammateInput
                            key={idx}
                            index={idx}
                            member={m}
                            onChange={handleTeammateChange}
                            onRemove={handleRemoveTeammate}
                            onAdd={handleAddTeammate}
                            canAdd={isLast && teammates.length < 5}
                          />
                        );
                      })}
                      {teammates.length === 0 && (
                        <button
                          type="button"
                          onClick={handleAddTeammate}
                          className="w-full p-3 border border-dashed border-slate-300 dark:border-[#3D1418] rounded-lg text-slate-500 dark:text-slate-400 hover:text-burgundy dark:hover:text-[#E89BA5] hover:border-burgundy dark:hover:border-[#E89BA5] hover:bg-burgundy/5 dark:hover:bg-burgundy/10 transition-colors text-sm font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                          Add First Teammate
                        </button>
                      )}
                    </div>

                    {/* In-Portal Invitation Notice */}
                    <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#1A090C] border border-slate-200 dark:border-[#3D1418] text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      <span className="font-semibold text-slate-900 dark:text-[#FAF6F3]">How invitations work:</span> Invitations are managed entirely in-portal (no external email is dispatched). Once you create your team, your teammates must log into <span className="font-mono font-semibold text-burgundy dark:text-[#E89BA5]">qffsrmap2026.com/learning/hackathon</span> using their registered Gmail to accept their invitation.
                    </div>

                    {/* Submit Button */}
                    <button
                      type="button"
                      onClick={handleCreateTeam}
                      disabled={isSubmittingTeam}
                      className="w-full px-4 py-2.5 bg-burgundy text-white text-sm font-bold rounded-lg hover:bg-burgundy-deep transition-colors shadow-xs disabled:opacity-50 flex items-center justify-center gap-2 mt-4 cursor-pointer"
                    >
                      {isSubmittingTeam ? (
                        'Creating Team & Dispatching In-Portal Invites...'
                      ) : (
                        <span className="flex items-center gap-1.5">
                          <Users className="w-4 h-4" />
                          Confirm Team & Unlock {selectedPSId} Dossier
                        </span>
                      )}
                    </button>
                  </div>
                </div>
            </div>
          )}
          </>
          )}
        </div>

        {/* Finalize Team Confirmation Modal */}
        {isFinalizeModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
            <div className="bg-white dark:bg-[#150709] border border-slate-200 dark:border-[#3D1418] rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
              <div className="flex items-center gap-2 text-burgundy dark:text-[#E89BA5]">
                <Lock className="w-5 h-5" />
                <h3 className="font-bold text-base text-slate-900 dark:text-[#FAF6F3]">Confirm Team Finalization</h3>
              </div>
              <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                Are you sure you want to finalize <strong>{team?.name}</strong>?
              </p>
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs space-y-1.5">
                <span className="font-bold block">⚠️ Important: This action cannot be undone.</span>
                <ul className="list-disc list-inside space-y-1 text-amber-800 dark:text-amber-300">
                  <li>Your team roster will be <strong>permanently locked</strong>.</li>
                  <li>You will <strong>not</strong> be able to add, delete, or change teammates anymore.</li>
                  <li>Your confirmed roster will be locked with <strong>{confirmedMembers.length} members</strong>.</li>
                </ul>
              </div>
              {pendingMembers.length > 0 && (
                <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">
                  Notice: {pendingMembers.length} teammate(s) with pending invitations have not accepted yet and will NOT be included in your finalized team.
                </p>
              )}
              {finalizeError && (
                <div className="p-2.5 rounded bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs">
                  {finalizeError}
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-[#3D1418]">
                <button
                  type="button"
                  onClick={() => setIsFinalizeModalOpen(false)}
                  disabled={isFinalizingTeam}
                  className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-[#3D1418] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#200B0E] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleFinalizeTeam}
                  disabled={isFinalizingTeam}
                  className="px-4 py-2 text-xs font-bold rounded-lg bg-burgundy hover:bg-burgundy-deep text-white flex items-center gap-1.5 shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {isFinalizingTeam ? (
                    <span>Locking Team...</span>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Yes, Finalize & Lock</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
    </AuthGate>
  );
}
