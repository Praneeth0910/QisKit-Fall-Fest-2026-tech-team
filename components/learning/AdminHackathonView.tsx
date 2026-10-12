'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  Trophy,
  Users,
  Building2,
  GraduationCap,
  Github,
  Search,
  Filter,
  Download,
  RefreshCw,
  CheckCircle2,
  Clock,
  Lock,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  FileSpreadsheet,
  Layers,
  Sparkles,
  Zap,
  Sliders,
  MessageSquare,
  Copy,
  Check,
  XCircle,
} from 'lucide-react';
import type {
  AdminHackathonData,
  AdminHackathonTeam,
  AdminHackathonParticipant,
} from '@/app/api/admin/hackathon/route';
import { supabase } from '@/lib/supabase';
import { EvaluationDrawer } from './EvaluationDrawer';
import { SubmissionEvaluation } from '@/types/evaluations';

export function AdminHackathonView() {
  const [data, setData] = useState<AdminHackathonData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPurging, setIsPurging] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // View mode
  const [viewMode, setViewMode] = useState<'teams' | 'participants' | 'insights'>('teams');

  // Pipeline Filter (Teams view)
  const [pipelineFilter, setPipelineFilter] = useState<'all' | 'ready' | 'shortlisted' | 'rejected' | 'downloaded' | 'draft'>('all');

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVertical, setSelectedVertical] = useState<string>('all');
  const [selectedPS, setSelectedPS] = useState<string>('all');
  const [selectedFinalized, setSelectedFinalized] = useState<string>('all');
  const [selectedSubmission, setSelectedSubmission] = useState<string>('all');

  // Expanded team IDs
  const [expandedTeamIds, setExpandedTeamIds] = useState<Set<string>>(new Set());

  // Evaluation Drawer State
  const [selectedTeamForEvaluation, setSelectedTeamForEvaluation] = useState<AdminHackathonTeam | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [actionInProgressId, setActionInProgressId] = useState<string | null>(null);
  const [copiedRepoId, setCopiedRepoId] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/admin/hackathon');
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          setData(json.data);
          // Auto expand first 5 teams
          const initialSet = new Set<string>();
          (json.data.teams || []).slice(0, 5).forEach((t: AdminHackathonTeam) => initialSet.add(t.id));
          setExpandedTeamIds(initialSet);
        }
      }
    } catch (err) {
      console.error('Error fetching admin hackathon data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePurge = async () => {
    try {
      setIsPurging(true);
      setFeedbackMsg(null);
      const res = await fetch('/api/admin/hackathon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'purge-cache' }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          setData(json.data);
        }
        setFeedbackMsg('Hackathon data synchronized fresh from database!');
        setTimeout(() => setFeedbackMsg(null), 4000);
      }
    } catch (err) {
      console.error('Error refreshing hackathon cache:', err);
    } finally {
      setIsPurging(false);
    }
  };

  // Real-time synchronization via Supabase Postgres Changes
  useEffect(() => {
    fetchData();

    // Listen to real-time evaluation updates across all admin sessions
    const channel = supabase
      .channel('hackathon-evaluations-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'submission_evaluations' },
        (payload) => {
          const updated = (payload.new || {}) as SubmissionEvaluation;
          if (updated && updated.category === 'hackathon') {
            setData((prev) => {
              if (!prev) return prev;
              const nextTeams = prev.teams.map((t) => {
                if (t.id === updated.target_id) {
                  return { ...t, evaluation: updated };
                }
                return t;
              });

              let downloadedCount = 0;
              let shortlistedCount = 0;
              let evaluatedCount = 0;
              let rejectedCount = 0;
              nextTeams.forEach((t) => {
                if (t.evaluation?.downloaded) downloadedCount++;
                if (t.evaluation?.is_next_round) shortlistedCount++;
                if (t.evaluation?.status === 'rejected') rejectedCount++;
                if (t.evaluation?.status && t.evaluation.status !== 'pending') evaluatedCount++;
              });

              return {
                ...prev,
                teams: nextTeams,
                stats: {
                  ...prev.stats,
                  downloadedSubmissionsCount: downloadedCount,
                  shortlistedTeamsCount: shortlistedCount,
                  rejectedTeamsCount: rejectedCount,
                  evaluatedTeamsCount: evaluatedCount,
                },
              };
            });

            // Also update active drawer if currently inspecting this team
            setSelectedTeamForEvaluation((current) => {
              if (current && current.id === updated.target_id) {
                return { ...current, evaluation: updated };
              }
              return current;
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const recomputeHackathonStats = (teams: AdminHackathonTeam[], baseStats: any) => {
    if (!baseStats) return baseStats;
    let downloadedCount = 0;
    let shortlistedCount = 0;
    let evaluatedCount = 0;
    let rejectedCount = 0;
    teams.forEach((t) => {
      if (t.evaluation?.downloaded) downloadedCount++;
      if (t.evaluation?.is_next_round) shortlistedCount++;
      if (t.evaluation?.status === 'rejected') rejectedCount++;
      if (t.evaluation?.status && t.evaluation.status !== 'pending') evaluatedCount++;
    });
    return {
      ...baseStats,
      downloadedSubmissionsCount: downloadedCount,
      shortlistedTeamsCount: shortlistedCount,
      rejectedTeamsCount: rejectedCount,
      evaluatedTeamsCount: evaluatedCount,
    };
  };

  // Quick Action: Download Repo ZIP + Auto-Tick in DB
  const handleQuickDownload = async (team: AdminHackathonTeam) => {
    if (!team.github_repo_url) return;

    try {
      setActionInProgressId(team.id);

      // Trigger ZIP download
      const cleanRepo = team.github_repo_url.replace(/\/+$/, '');
      const zipUrl = `${cleanRepo}/archive/refs/heads/main.zip`;

      const link = document.createElement('a');
      link.href = zipUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Call API to register download audit
      const res = await fetch('/api/admin/evaluations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: 'hackathon',
          target_id: team.id,
          action: 'mark_download',
        }),
      });

      const json = await res.json();
      if (json.success && json.evaluation) {
        // Optimistic local update
        setData((prev) => {
          if (!prev) return prev;
          const nextTeams = prev.teams.map((t) =>
            t.id === team.id ? { ...t, evaluation: json.evaluation } : t
          );
          return { ...prev, teams: nextTeams, stats: recomputeHackathonStats(nextTeams, prev.stats) };
        });
      }
    } catch (err) {
      console.error('Error during quick download:', err);
    } finally {
      setActionInProgressId(null);
    }
  };

  // Quick Action: Toggle Next Round Shortlist
  const handleQuickToggleNextRound = async (team: AdminHackathonTeam) => {
    try {
      setActionInProgressId(team.id);

      const res = await fetch('/api/admin/evaluations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: 'hackathon',
          target_id: team.id,
          action: 'toggle_next_round',
        }),
      });

      const json = await res.json();
      if (json.success && json.evaluation) {
        setData((prev) => {
          if (!prev) return prev;
          const nextTeams = prev.teams.map((t) =>
            t.id === team.id ? { ...t, evaluation: json.evaluation } : t
          );
          return { ...prev, teams: nextTeams, stats: recomputeHackathonStats(nextTeams, prev.stats) };
        });
      }
    } catch (err) {
      console.error('Error toggling next round:', err);
    } finally {
      setActionInProgressId(null);
    }
  };

  // Quick Action: Toggle Rejection
  const handleQuickToggleReject = async (team: AdminHackathonTeam) => {
    try {
      setActionInProgressId(team.id);

      const res = await fetch('/api/admin/evaluations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: 'hackathon',
          target_id: team.id,
          action: 'toggle_reject',
        }),
      });

      const json = await res.json();
      if (json.success && json.evaluation) {
        setData((prev) => {
          if (!prev) return prev;
          const nextTeams = prev.teams.map((t) =>
            t.id === team.id ? { ...t, evaluation: json.evaluation } : t
          );
          return { ...prev, teams: nextTeams, stats: recomputeHackathonStats(nextTeams, prev.stats) };
        });
        const wasRejected = json.evaluation.status === 'rejected';
        setFeedbackMsg(
          wasRejected
            ? `Team "${team.name}" marked as rejected.`
            : `Rejection cleared for "${team.name}" (restored to review).`
        );
        setTimeout(() => setFeedbackMsg(null), 4000);
      }
    } catch (err) {
      console.error('Error toggling rejection:', err);
    } finally {
      setActionInProgressId(null);
    }
  };

  // Quick Action: Copy git clone command
  const handleCopyClone = (team: AdminHackathonTeam) => {
    if (!team.github_repo_url) return;
    const cmd = `git clone ${team.github_repo_url}.git`;
    navigator.clipboard.writeText(cmd);
    setCopiedRepoId(team.id);
    setTimeout(() => setCopiedRepoId(null), 2500);
  };

  const openEvaluationDesk = (team: AdminHackathonTeam) => {
    setSelectedTeamForEvaluation(team);
    setIsDrawerOpen(true);
  };

  const handleEvaluationUpdated = (updated: SubmissionEvaluation) => {
    setData((prev) => {
      if (!prev) return prev;
      const nextTeams = prev.teams.map((t) =>
        t.id === updated.target_id ? { ...t, evaluation: updated } : t
      );
      return { ...prev, teams: nextTeams, stats: recomputeHackathonStats(nextTeams, prev.stats) };
    });
  };

  const toggleExpandTeam = (teamId: string) => {
    setExpandedTeamIds((prev) => {
      const copy = new Set(prev);
      if (copy.has(teamId)) {
        copy.delete(teamId);
      } else {
        copy.add(teamId);
      }
      return copy;
    });
  };

  const expandAll = () => {
    const allIds = new Set<string>((data?.teams || []).map((t) => t.id));
    setExpandedTeamIds(allIds);
  };

  const collapseAll = () => {
    setExpandedTeamIds(new Set());
  };

  // Filtered Teams
  const filteredTeams = useMemo(() => {
    if (!data?.teams) return [];
    const query = searchQuery.trim().toLowerCase();

    return data.teams.filter((t) => {
      // Search filter
      if (query) {
        const matchesName = (t.name || '').toLowerCase().includes(query);
        const matchesLead =
          (t.lead_name || '').toLowerCase().includes(query) ||
          (t.lead_email || '').toLowerCase().includes(query) ||
          (t.lead_university || '').toLowerCase().includes(query);
        const matchesPS = (t.problem_statement_id || '').toLowerCase().includes(query);
        const matchesVertical = (t.vertical || '').toLowerCase().includes(query);
        const matchesMember = (t.members || []).some(
          (m) =>
            (m.full_name || '').toLowerCase().includes(query) ||
            (m.email || '').toLowerCase().includes(query) ||
            (m.university || '').toLowerCase().includes(query)
        );

        if (!matchesName && !matchesLead && !matchesPS && !matchesVertical && !matchesMember) {
          return false;
        }
      }

      // Pipeline filter
      if (pipelineFilter === 'ready' && !t.github_repo_url) return false;
      if (pipelineFilter === 'shortlisted' && !t.evaluation?.is_next_round) return false;
      if (pipelineFilter === 'rejected' && t.evaluation?.status !== 'rejected') return false;
      if (pipelineFilter === 'downloaded' && !t.evaluation?.downloaded) return false;
      if (pipelineFilter === 'draft' && t.github_repo_url) return false;

      // Vertical filter
      if (selectedVertical !== 'all' && t.vertical !== selectedVertical) {
        return false;
      }

      // Problem statement filter
      if (selectedPS !== 'all' && t.problem_statement_id !== selectedPS) {
        return false;
      }

      // Finalized status filter
      if (selectedFinalized === 'finalized' && !t.is_finalized) return false;
      if (selectedFinalized === 'draft' && t.is_finalized) return false;

      // Submission status filter
      if (selectedSubmission === 'submitted' && !t.github_repo_url) return false;
      if (selectedSubmission === 'unsubmitted' && t.github_repo_url) return false;

      return true;
    });
  }, [data?.teams, searchQuery, pipelineFilter, selectedVertical, selectedPS, selectedFinalized, selectedSubmission]);

  // Filtered Participants
  const filteredParticipants = useMemo(() => {
    if (!data?.participants) return [];
    const query = searchQuery.trim().toLowerCase();

    return data.participants.filter((p) => {
      if (query) {
        const matchesName = (p.full_name || '').toLowerCase().includes(query);
        const matchesEmail = (p.email || '').toLowerCase().includes(query);
        const matchesUni = (p.university || '').toLowerCase().includes(query);
        const matchesTeam = (p.team_name || '').toLowerCase().includes(query);
        const matchesPS = (p.problem_statement_id || '').toLowerCase().includes(query);
        const matchesVertical = (p.vertical || '').toLowerCase().includes(query);

        if (!matchesName && !matchesEmail && !matchesUni && !matchesTeam && !matchesPS && !matchesVertical) {
          return false;
        }
      }

      if (selectedVertical !== 'all' && p.vertical !== selectedVertical) return false;
      if (selectedPS !== 'all' && p.problem_statement_id !== selectedPS) return false;
      if (selectedFinalized === 'finalized' && !p.is_finalized) return false;
      if (selectedFinalized === 'draft' && p.is_finalized) return false;
      if (selectedSubmission === 'submitted' && !p.github_repo_url) return false;
      if (selectedSubmission === 'unsubmitted' && p.github_repo_url) return false;

      return true;
    });
  }, [data?.participants, searchQuery, selectedVertical, selectedPS, selectedFinalized, selectedSubmission]);

  // Export to CSV Function
  const handleExportCSV = () => {
    if (!data) return;

    const headers = [
      'Team Name',
      'Vertical Track',
      'Problem Statement',
      'Roster Status',
      'Finalized At',
      'GitHub Submission URL',
      'Submitted At',
      'Round 2 Shortlisted',
      'Evaluation Status',
      'Score',
      'Downloaded',
      'Downloaded By',
      'Participant Role',
      'Participant Name',
      'Participant Email',
      'Participant University / Institution',
      'Invitation Status',
      'Invited At',
      'Accepted At',
    ];

    const rows: string[][] = [];

    (data.teams || []).forEach((team) => {
      (team.members || []).forEach((m) => {
        rows.push([
          `"${(team.name || '').replace(/"/g, '""')}"`,
          `"${team.vertical || ''}"`,
          `"${team.problem_statement_id || ''}"`,
          team.is_finalized ? 'Finalized & Locked' : 'Draft',
          team.finalized_at ? `"${new Date(team.finalized_at).toLocaleString()}"` : 'N/A',
          team.github_repo_url ? `"${team.github_repo_url}"` : 'Not Submitted',
          team.submitted_at ? `"${new Date(team.submitted_at).toLocaleString()}"` : 'N/A',
          team.evaluation?.is_next_round ? 'YES (Round 2)' : 'NO',
          team.evaluation?.status || 'pending',
          team.evaluation?.score !== null && team.evaluation?.score !== undefined ? String(team.evaluation.score) : 'N/A',
          team.evaluation?.downloaded ? 'YES' : 'NO',
          `"${(team.evaluation?.downloaded_by || '').replace(/"/g, '""')}"`,
          m.role === 'leader' ? 'Team Leader' : 'Team Member',
          `"${(m.full_name || '').replace(/"/g, '""')}"`,
          `"${m.email || ''}"`,
          `"${(m.university || '').replace(/"/g, '""')}"`,
          m.status || '',
          m.invited_at ? `"${new Date(m.invited_at).toLocaleString()}"` : '',
          m.responded_at ? `"${new Date(m.responded_at).toLocaleString()}"` : '',
        ]);
      });
    });

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `QFF2026_Hackathon_Teams_Roster_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading && !data) {
    return (
      <div className="p-12 bg-white dark:bg-[#150709] border border-slate-200 dark:border-[#3D1418] rounded-xl flex flex-col items-center justify-center text-slate-500 dark:text-slate-400 gap-3 font-sans">
        <RefreshCw className="w-6 h-6 animate-spin text-burgundy dark:text-[#E89BA5]" />
        <p className="text-xs font-medium">Aggregating Hackathon Teams, Participants & Universities...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans">
      {/* Top Banner & Action Controls */}
      <div className="p-5 bg-linear-to-r from-burgundy via-burgundy-deep to-[#18070B] text-white rounded-xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 border border-burgundy/40">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-300" />
            <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
              Flagship Hackathon Participant Registry
            </span>
          </div>
          <h2 className="text-lg font-bold">Hackathon Teams, Rosters & University Affiliations</h2>
          <p className="text-xs text-slate-200 max-w-xl">
            Live directory of all formed teams, member universities/institutions, track problem
            statements, GitHub repositories, and finalized rosters.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={fetchData}
            disabled={isLoading}
            className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-semibold text-white flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
            title="Refresh latest team data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={handlePurge}
            disabled={isPurging}
            className="px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 border border-white/25 text-xs font-semibold text-white flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
            title="Purge Redis cache and sync directly from DB"
          >
            <Zap className={`w-3.5 h-3.5 text-amber-300 ${isPurging ? 'animate-spin' : ''}`} />
            <span>Purge Cache</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 border border-emerald-400/40 text-xs font-bold text-white flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {feedbackMsg && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs rounded-lg flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {/* KPI Highlight Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Total Teams Formed */}
        <div className="p-4 rounded-xl bg-white dark:bg-[#150709] border border-slate-200 dark:border-[#3D1418] shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Total Teams
            </span>
            <div className="p-1.5 rounded-lg bg-burgundy/10 text-burgundy dark:bg-burgundy/20 dark:text-[#E89BA5]">
              <Trophy className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-[#FAF6F3]">
              {data?.stats?.totalTeams || 0}
            </span>
            <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1 py-0.5 rounded">
              {data?.stats?.finalizedTeams || 0} locked
            </span>
          </div>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 block mt-0.5">
            {data?.stats?.draftTeams || 0} in draft
          </span>
        </div>

        {/* Ready for Review (Repo Submitted) */}
        <div className="p-4 rounded-xl bg-white dark:bg-[#150709] border border-slate-200 dark:border-[#3D1418] shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Ready for Review
            </span>
            <div className="p-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400">
              <Github className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-[#FAF6F3]">
              {data?.stats?.teamsWithSubmissions || 0}
            </span>
            <span className="text-[10px] font-semibold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 px-1 py-0.5 rounded">
              Repos Live
            </span>
          </div>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 block mt-0.5">
            Code available
          </span>
        </div>

        {/* Round 2 Shortlisted */}
        <div className="p-4 rounded-xl bg-white dark:bg-[#150709] border border-slate-200 dark:border-[#3D1418] shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Round 2 Shortlist
            </span>
            <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
              {data?.stats?.shortlistedTeamsCount || 0}
            </span>
            <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-1 py-0.5 rounded">
              Advanced
            </span>
          </div>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 block mt-0.5">
            Selected teams
          </span>
        </div>

        {/* Downloaded & Inspected */}
        <div className="p-4 rounded-xl bg-white dark:bg-[#150709] border border-slate-200 dark:border-[#3D1418] shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Downloaded
            </span>
            <div className="p-1.5 rounded-lg bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400">
              <Download className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-sky-700 dark:text-sky-400">
              {data?.stats?.downloadedSubmissionsCount || 0}
            </span>
            <span className="text-[10px] font-semibold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/40 px-1 py-0.5 rounded">
              Audited
            </span>
          </div>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 block mt-0.5">
            Verified by evaluators
          </span>
        </div>

        {/* Total Participants */}
        <div className="p-4 rounded-xl bg-white dark:bg-[#150709] border border-slate-200 dark:border-[#3D1418] shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Participants
            </span>
            <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
              <Users className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-[#FAF6F3]">
              {data?.stats?.totalParticipants || 0}
            </span>
            <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-1 py-0.5 rounded">
              {data?.stats?.confirmedParticipants || 0} confirmed
            </span>
          </div>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 block mt-0.5">
            {data?.stats?.pendingParticipants || 0} pending
          </span>
        </div>

        {/* Universities Represented */}
        <div className="p-4 rounded-xl bg-white dark:bg-[#150709] border border-slate-200 dark:border-[#3D1418] shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Colleges
            </span>
            <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
              <GraduationCap className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-[#FAF6F3]">
              {data?.stats?.uniqueUniversitiesCount || 0}
            </span>
            <span className="text-[10px] font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 px-1 py-0.5 rounded">
              Institutes
            </span>
          </div>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 block mt-0.5">
            Pan-India representation
          </span>
        </div>
      </div>

      {/* Sub-Tabs Selector & Search/Filter Controls */}
      <div className="bg-white dark:bg-[#150709] border border-slate-200 dark:border-[#3D1418] rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-[#3D1418] pb-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setViewMode('teams')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'teams'
                  ? 'bg-burgundy text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-[#1C0A0D] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#250D11]'
              }`}
            >
              Teams View ({filteredTeams.length})
            </button>
            <button
              type="button"
              onClick={() => setViewMode('participants')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'participants'
                  ? 'bg-burgundy text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-[#1C0A0D] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#250D11]'
              }`}
            >
              All Participants Roster ({filteredParticipants.length})
            </button>
            <button
              type="button"
              onClick={() => setViewMode('insights')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'insights'
                  ? 'bg-burgundy text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-[#1C0A0D] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#250D11]'
              }`}
            >
              University & Track Insights
            </button>
          </div>

          {viewMode === 'teams' && (
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={expandAll}
                className="text-slate-600 dark:text-slate-400 hover:text-burgundy dark:hover:text-[#E89BA5] underline cursor-pointer"
              >
                Expand All
              </button>
              <span>·</span>
              <button
                type="button"
                onClick={collapseAll}
                className="text-slate-600 dark:text-slate-400 hover:text-burgundy dark:hover:text-[#E89BA5] underline cursor-pointer"
              >
                Collapse All
              </button>
            </div>
          )}
        </div>

        {/* Review Pipeline Sub-Tabs */}
        {viewMode === 'teams' && (
          <div className="flex flex-wrap items-center gap-1.5 p-2 bg-slate-50 dark:bg-[#1C0A0D]/70 rounded-lg border border-slate-200 dark:border-[#3D1418]">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider px-2">
              Review Pipeline:
            </span>
            <button
              type="button"
              onClick={() => setPipelineFilter('all')}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                pipelineFilter === 'all'
                  ? 'bg-white dark:bg-[#250D11] text-burgundy dark:text-[#E89BA5] shadow-xs border border-slate-200 dark:border-[#3D1418]'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              All Teams ({data?.stats?.totalTeams || 0})
            </button>
            <button
              type="button"
              onClick={() => setPipelineFilter('ready')}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                pipelineFilter === 'ready'
                  ? 'bg-white dark:bg-[#250D11] text-purple-700 dark:text-purple-300 shadow-xs border border-purple-200 dark:border-purple-800'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Ready for Review ({data?.stats?.teamsWithSubmissions || 0})
            </button>
            <button
              type="button"
              onClick={() => setPipelineFilter('shortlisted')}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                pipelineFilter === 'shortlisted'
                  ? 'bg-white dark:bg-[#250D11] text-emerald-700 dark:text-emerald-300 shadow-xs border border-emerald-200 dark:border-emerald-800'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Round 2 Shortlisted ({data?.stats?.shortlistedTeamsCount || 0})
            </button>
            <button
              type="button"
              onClick={() => setPipelineFilter('rejected')}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                pipelineFilter === 'rejected'
                  ? 'bg-white dark:bg-[#250D11] text-rose-700 dark:text-rose-300 shadow-xs border border-rose-200 dark:border-rose-800'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Rejected ({data?.stats?.rejectedTeamsCount ?? data?.teams.filter((t) => t.evaluation?.status === 'rejected').length ?? 0})
            </button>
            <button
              type="button"
              onClick={() => setPipelineFilter('downloaded')}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                pipelineFilter === 'downloaded'
                  ? 'bg-white dark:bg-[#250D11] text-sky-700 dark:text-sky-300 shadow-xs border border-sky-200 dark:border-sky-800'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Downloaded & Inspected ({data?.stats?.downloadedSubmissionsCount || 0})
            </button>
            <button
              type="button"
              onClick={() => setPipelineFilter('draft')}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                pipelineFilter === 'draft'
                  ? 'bg-white dark:bg-[#250D11] text-amber-700 dark:text-amber-300 shadow-xs border border-amber-200 dark:border-amber-800'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Awaiting Repo ({data?.stats?.draftTeams || 0})
            </button>
          </div>
        )}

        {/* Filter Controls Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          {/* Search Box */}
          <div className="lg:col-span-2 relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search team, member, email, university..."
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 dark:border-[#3D1418] bg-white dark:bg-[#1C0A0D] text-slate-900 dark:text-[#FAF6F3] rounded-lg focus:outline-none focus:ring-1 focus:ring-burgundy"
            />
          </div>

          {/* Track Filter */}
          <div>
            <select
              value={selectedVertical}
              onChange={(e) => setSelectedVertical(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-300 dark:border-[#3D1418] bg-white dark:bg-[#1C0A0D] text-slate-900 dark:text-[#FAF6F3] rounded-lg focus:outline-none focus:ring-1 focus:ring-burgundy"
            >
              <option value="all">All Tracks</option>
              <option value="Quantum Chemistry">Quantum Chemistry</option>
              <option value="Quantum Optimization">Quantum Optimization</option>
              <option value="Quantum Simulation">Quantum Simulation</option>
              <option value="Quantum Machine Learning">Quantum Machine Learning</option>
              <option value="Post-Quantum Cryptography">Post-Quantum Cryptography</option>
            </select>
          </div>

          {/* Finalized Filter */}
          <div>
            <select
              value={selectedFinalized}
              onChange={(e) => setSelectedFinalized(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-300 dark:border-[#3D1418] bg-white dark:bg-[#1C0A0D] text-slate-900 dark:text-[#FAF6F3] rounded-lg focus:outline-none focus:ring-1 focus:ring-burgundy"
            >
              <option value="all">All Roster Statuses</option>
              <option value="finalized">Finalized & Locked Only</option>
              <option value="draft">Draft Only</option>
            </select>
          </div>

          {/* Submissions Filter */}
          <div>
            <select
              value={selectedSubmission}
              onChange={(e) => setSelectedSubmission(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-300 dark:border-[#3D1418] bg-white dark:bg-[#1C0A0D] text-slate-900 dark:text-[#FAF6F3] rounded-lg focus:outline-none focus:ring-1 focus:ring-burgundy"
            >
              <option value="all">All Submissions</option>
              <option value="submitted">Repo Submitted</option>
              <option value="unsubmitted">No Repo Yet</option>
            </select>
          </div>
        </div>
      </div>

      {/* MODE 1: TEAMS VIEW */}
      {viewMode === 'teams' && (
        <div className="space-y-4">
          {filteredTeams.map((team, idx) => {
            const isExpanded = expandedTeamIds.has(team.id);

            return (
              <div
                key={team.id}
                className="bg-white dark:bg-[#150709] border border-slate-200 dark:border-[#3D1418] rounded-xl shadow-xs overflow-hidden transition-all duration-200"
              >
                {/* Team Header Strip */}
                <div
                  onClick={() => toggleExpandTeam(team.id)}
                  className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer hover:bg-slate-50/70 dark:hover:bg-[#1C0A0D]/70 transition-colors"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-base text-slate-900 dark:text-[#FAF6F3]">
                        #{idx + 1} {team.name}
                      </span>

                      {team.is_finalized ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 flex items-center gap-1">
                          <Lock className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                          Finalized
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-700 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                          Draft ({team.confirmed_count}/6 Confirmed)
                        </span>
                      )}

                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-burgundy/10 text-burgundy dark:bg-burgundy/25 dark:text-[#E89BA5]">
                        {team.problem_statement_id}
                      </span>

                      {team.evaluation?.status === 'rejected' && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-700 flex items-center gap-1">
                          <XCircle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                          Rejected
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
                      <span>Track: <strong>{team.vertical}</strong></span>
                      <span>·</span>
                      <span>
                        Leader: <strong>{team.lead_name}</strong> ({team.lead_email})
                      </span>
                      <span>·</span>
                      <span className="flex items-center gap-1 text-burgundy dark:text-[#E89BA5] font-semibold">
                        <GraduationCap className="w-3.5 h-3.5" />
                        {team.lead_university}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 self-start md:self-center">
                    {team.github_repo_url ? (
                      <a
                        href={team.github_repo_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="px-2.5 py-1 rounded bg-slate-900 dark:bg-[#250D11] hover:bg-slate-800 text-white text-xs font-mono font-medium flex items-center gap-1.5 transition-colors shadow-2xs"
                      >
                        <Github className="w-3.5 h-3.5" />
                        <span>Repo</span>
                        <ExternalLink className="w-3 h-3 text-slate-400" />
                      </a>
                    ) : (
                      <span className="text-[11px] text-slate-400 dark:text-slate-500 italic">
                        No repo submitted
                      </span>
                    )}

                    <button
                      type="button"
                      className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Evaluation & Review Strip */}
                <div className="border-t border-slate-100 dark:border-[#3D1418] bg-slate-50/70 dark:bg-[#180709] px-4 py-2.5 sm:px-5 flex flex-wrap items-center justify-between gap-2.5 text-xs">
                  {/* Left: Download Action & Audit Status */}
                  <div className="flex flex-wrap items-center gap-2">
                    {team.github_repo_url ? (
                      <>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleQuickDownload(team);
                          }}
                          disabled={actionInProgressId === team.id}
                          className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer disabled:opacity-50 ${
                            team.evaluation?.downloaded
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 hover:bg-emerald-100'
                              : 'bg-burgundy hover:bg-burgundy-deep text-white'
                          }`}
                          title="Download repository ZIP archive and register inspection audit"
                        >
                          {actionInProgressId === team.id ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : team.evaluation?.downloaded ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <Download className="w-3.5 h-3.5" />
                          )}
                          <span>
                            {team.evaluation?.downloaded
                              ? `Downloaded (${team.evaluation.downloaded_by?.split(' ')[0] || 'Admin'})`
                              : 'Download Submission ZIP'}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyClone(team);
                          }}
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-[#3D1418] bg-white dark:bg-[#1C0A0D] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors cursor-pointer"
                          title="Copy git clone command"
                        >
                          {copiedRepoId === team.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>

                        {team.evaluation?.downloaded && team.evaluation.downloaded_at && (
                          <span className="text-[11px] text-slate-400 dark:text-slate-500 hidden md:inline">
                            Verified {new Date(team.evaluation.downloaded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-[11px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded border border-amber-200 dark:border-amber-800 flex items-center gap-1.5 font-medium">
                        <Clock className="w-3 h-3 text-amber-600" />
                        <span>Pending Repository Submission</span>
                      </span>
                    )}
                  </div>

                  {/* Right: Round 2 Shortlist, Score Pill, Notes & Drawer Desk */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleQuickToggleNextRound(team);
                      }}
                      disabled={actionInProgressId === team.id}
                      className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer disabled:opacity-50 ${
                        team.evaluation?.is_next_round
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-500'
                          : 'bg-white dark:bg-[#1C0A0D] hover:bg-slate-100 dark:hover:bg-[#250D11] text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-[#3D1418]'
                      }`}
                      title="Toggle Round 2 Shortlist"
                    >
                      <CheckCircle2 className={`w-3.5 h-3.5 ${team.evaluation?.is_next_round ? 'text-white' : 'text-slate-400'}`} />
                      <span>{team.evaluation?.is_next_round ? 'Round 2 Shortlisted' : 'Mark Next Round'}</span>
                    </button>

                    {/* Quick Toggle Reject */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleQuickToggleReject(team);
                      }}
                      disabled={actionInProgressId === team.id}
                      className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer disabled:opacity-50 ${
                        team.evaluation?.status === 'rejected'
                          ? 'bg-rose-600 hover:bg-rose-700 text-white border border-rose-500'
                          : 'bg-white dark:bg-[#1C0A0D] hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/40 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-[#3D1418]'
                      }`}
                      title={team.evaluation?.status === 'rejected' ? 'Undo rejection (restore to review)' : 'Reject team submission'}
                    >
                      <XCircle className={`w-3.5 h-3.5 ${team.evaluation?.status === 'rejected' ? 'text-white' : 'text-slate-400'}`} />
                      <span>{team.evaluation?.status === 'rejected' ? 'Rejected' : 'Reject'}</span>
                    </button>

                    {team.evaluation?.score !== null && team.evaluation?.score !== undefined && (
                      <span className="px-2.5 py-1 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 font-mono font-bold">
                        {team.evaluation.score}/100 pts
                      </span>
                    )}

                    {team.evaluation?.comments && team.evaluation.comments.length > 0 && (
                      <span className="px-2 py-1 rounded-md bg-slate-100 dark:bg-[#1C0A0D] border border-slate-200 dark:border-[#3D1418] text-slate-700 dark:text-slate-300 flex items-center gap-1">
                        <MessageSquare className="w-3 h-3 text-burgundy dark:text-[#E89BA5]" />
                        <span>{team.evaluation.comments.length}</span>
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEvaluationDesk(team);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-[#250D11] hover:bg-slate-800 text-white font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                    >
                      <Sliders className="w-3.5 h-3.5" />
                      <span>Review Desk</span>
                    </button>
                  </div>
                </div>

                {/* Expanded Member Roster Table */}
                {isExpanded && (
                  <div className="border-t border-slate-100 dark:border-[#3D1418] bg-slate-50/50 dark:bg-[#1C0A0D]/50 p-4 sm:p-5 space-y-3 animate-in fade-in">
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                      <span>Full Team Roster ({team.members.length} Members)</span>
                      <span>Created {new Date(team.created_at).toLocaleDateString()}</span>
                    </div>

                    <div className="border border-slate-200 dark:border-[#3D1418] rounded-lg overflow-hidden bg-white dark:bg-[#150709]">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100/80 dark:bg-[#200B0E] border-b border-slate-200 dark:border-[#3D1418] text-slate-700 dark:text-slate-300 font-semibold text-[11px]">
                          <tr>
                            <th className="py-2.5 px-3">Role</th>
                            <th className="py-2.5 px-3">Full Name</th>
                            <th className="py-2.5 px-3">Email Address</th>
                            <th className="py-2.5 px-3">University / Institution</th>
                            <th className="py-2.5 px-3">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-[#250D11]">
                          {team.members.map((m) => {
                            const isLeader = m.role === 'leader';
                            return (
                              <tr key={m.id} className="hover:bg-slate-50/60 dark:hover:bg-[#1C0A0D]/60">
                                <td className="py-2.5 px-3">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                      isLeader
                                        ? 'bg-burgundy/15 text-burgundy dark:bg-burgundy/25 dark:text-[#E89BA5]'
                                        : 'bg-slate-100 dark:bg-[#250D11] text-slate-700 dark:text-slate-300'
                                    }`}
                                  >
                                    {m.role}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-[#FAF6F3]">
                                  {m.full_name}
                                </td>
                                <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-400">
                                  {m.email}
                                </td>
                                <td className="py-2.5 px-3">
                                  <span className="inline-flex items-center gap-1.5 font-medium text-slate-800 dark:text-slate-200">
                                    <GraduationCap className="w-3.5 h-3.5 text-burgundy dark:text-[#E89BA5] shrink-0" />
                                    <span>{m.university}</span>
                                  </span>
                                </td>
                                <td className="py-2.5 px-3">
                                  {m.status === 'accepted' || isLeader ? (
                                    <span className="text-emerald-700 dark:text-emerald-400 font-semibold inline-flex items-center gap-1 text-[11px]">
                                      <CheckCircle2 className="w-3 h-3" /> Confirmed
                                    </span>
                                  ) : m.status === 'invited' ? (
                                    <span className="text-amber-700 dark:text-amber-400 font-medium inline-flex items-center gap-1 text-[11px]">
                                      <Clock className="w-3 h-3" /> Pending Invite
                                    </span>
                                  ) : (
                                    <span className="text-rose-600 dark:text-rose-400 font-semibold text-[11px]">
                                      Declined
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {team.submission_notes && (
                      <div className="p-3 rounded-lg bg-slate-100 dark:bg-[#1C0A0D] text-xs text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#3D1418]">
                        <strong>Submission Notes:</strong> {team.submission_notes}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {filteredTeams.length === 0 && (
            <div className="p-12 text-center text-xs text-slate-500 dark:text-slate-400 bg-white dark:bg-[#150709] border border-slate-200 dark:border-[#3D1418] rounded-xl">
              No hackathon teams match your active search and filter criteria.
            </div>
          )}
        </div>
      )}

      {/* MODE 2: FLAT PARTICIPANTS ROSTER */}
      {viewMode === 'participants' && (
        <div className="bg-white dark:bg-[#150709] border border-slate-200 dark:border-[#3D1418] rounded-xl shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-200 dark:border-[#3D1418] flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-[#FAF6F3]">
              All Registered Hackathon Participants ({filteredParticipants.length})
            </h3>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Showing every member across all formed teams
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-[#1C0A0D] border-b border-slate-200 dark:border-[#3D1418] text-slate-700 dark:text-slate-300 font-semibold text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">#</th>
                  <th className="py-3 px-4">Participant Name</th>
                  <th className="py-3 px-4">Email Address</th>
                  <th className="py-3 px-4">University / Institution</th>
                  <th className="py-3 px-4">Team Name</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Track (PS)</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Repo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#3D1418]">
                {filteredParticipants.map((p, idx) => (
                  <tr key={p.id} className="hover:bg-slate-50/60 dark:hover:bg-[#1C0A0D]/60 transition-colors">
                    <td className="py-3 px-4 text-slate-400">{idx + 1}</td>
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-[#FAF6F3]">
                      {p.full_name}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400">
                      {p.email}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 font-medium text-slate-800 dark:text-slate-200">
                        <GraduationCap className="w-3.5 h-3.5 text-burgundy dark:text-[#E89BA5] shrink-0" />
                        <span>{p.university}</span>
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900 dark:text-[#FAF6F3]">
                      {p.team_name}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          p.role === 'leader'
                            ? 'bg-burgundy/15 text-burgundy dark:bg-burgundy/25 dark:text-[#E89BA5]'
                            : 'bg-slate-100 dark:bg-[#250D11] text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {p.role}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-mono text-[11px] font-bold text-burgundy dark:text-[#E89BA5]">
                        {p.problem_statement_id}
                      </span>
                      <span className="text-[11px] text-slate-500 block">{p.vertical}</span>
                    </td>
                    <td className="py-3 px-4">
                      {p.status === 'accepted' || p.role === 'leader' ? (
                        <span className="text-emerald-700 dark:text-emerald-400 font-semibold inline-flex items-center gap-1 text-[11px]">
                          <CheckCircle2 className="w-3 h-3" /> Confirmed
                        </span>
                      ) : p.status === 'invited' ? (
                        <span className="text-amber-700 dark:text-amber-400 font-medium inline-flex items-center gap-1 text-[11px]">
                          <Clock className="w-3 h-3" /> Pending
                        </span>
                      ) : (
                        <span className="text-rose-600 dark:text-rose-400 font-semibold text-[11px]">
                          Declined
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {p.github_repo_url ? (
                        <a
                          href={p.github_repo_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-burgundy dark:text-[#E89BA5] hover:underline flex items-center gap-1 font-mono text-[11px]"
                        >
                          <Github className="w-3 h-3" />
                          <span>Link</span>
                        </a>
                      ) : (
                        <span className="text-slate-400 text-[11px]">—</span>
                      )}
                    </td>
                  </tr>
                ))}

                {filteredParticipants.length === 0 && (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
                      No participants match your active search and filter criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODE 3: UNIVERSITY & TRACK INSIGHTS */}
      {viewMode === 'insights' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Universities Breakdown */}
          <div className="bg-white dark:bg-[#150709] border border-slate-200 dark:border-[#3D1418] rounded-xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#3D1418] pb-3">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-burgundy dark:text-[#E89BA5]" />
                <h3 className="text-base font-bold text-slate-900 dark:text-[#FAF6F3]">
                  Universities & Institutions Representation
                </h3>
              </div>
              <span className="text-xs font-semibold text-slate-500">
                {Object.keys(data?.stats?.universitiesBreakdown || {}).length} Institutions
              </span>
            </div>

            <div className="space-y-3">
              {Object.entries(data?.stats?.universitiesBreakdown || {})
                .sort((a, b) => b[1] - a[1])
                .map(([uni, count]) => {
                  const pct = Math.round(
                    (count / Math.max(1, data?.stats?.totalParticipants || 1)) * 100
                  );

                  return (
                    <div key={uni} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-800 dark:text-[#FAF6F3] truncate pr-2">
                          {uni}
                        </span>
                        <span className="font-bold text-slate-900 dark:text-[#FAF6F3] shrink-0 font-mono">
                          {count} ({pct}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-[#1C0A0D] h-2 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${Math.max(4, pct)}%` }}
                          className="bg-burgundy dark:bg-[#E89BA5] h-full rounded-full transition-all duration-500"
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Domain Track Distribution */}
          <div className="bg-white dark:bg-[#150709] border border-slate-200 dark:border-[#3D1418] rounded-xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#3D1418] pb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-burgundy dark:text-[#E89BA5]" />
                <h3 className="text-base font-bold text-slate-900 dark:text-[#FAF6F3]">
                  Track & Problem Statement Distribution
                </h3>
              </div>
              <span className="text-xs font-semibold text-slate-500">5 Verticals</span>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Domain Verticals:
                </h4>
                {Object.entries(data?.stats?.verticalsBreakdown || {}).map(([vert, count]) => {
                  const pct = Math.round((count / Math.max(1, data?.stats?.totalTeams || 1)) * 100);
                  return (
                    <div key={vert} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-800 dark:text-[#FAF6F3]">{vert}</span>
                        <span className="font-bold text-slate-900 dark:text-[#FAF6F3] font-mono">
                          {count} teams ({pct}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-[#1C0A0D] h-2 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${Math.max(4, pct)}%` }}
                          className="bg-sky-500 h-full rounded-full transition-all duration-500"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-[#3D1418] space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Problem Statements Chosen:
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {Object.entries(data?.stats?.problemStatementsBreakdown || {}).map(([ps, count]) => (
                    <div
                      key={ps}
                      className="p-2.5 rounded-lg border border-slate-200 dark:border-[#3D1418] bg-slate-50 dark:bg-[#1C0A0D] text-xs flex items-center justify-between"
                    >
                      <span className="font-mono font-bold text-burgundy dark:text-[#E89BA5]">{ps}</span>
                      <span className="font-bold text-slate-900 dark:text-[#FAF6F3]">{count} teams</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Evaluation Drawer Modal */}
      {selectedTeamForEvaluation && (
        <EvaluationDrawer
          isOpen={isDrawerOpen}
          onClose={() => {
            setIsDrawerOpen(false);
            setSelectedTeamForEvaluation(null);
          }}
          category="hackathon"
          targetId={selectedTeamForEvaluation.id}
          targetTitle={selectedTeamForEvaluation.name}
          targetSubtitle={`Track: ${selectedTeamForEvaluation.vertical} · Problem: ${selectedTeamForEvaluation.problem_statement_id} · Lead: ${selectedTeamForEvaluation.lead_name} (${selectedTeamForEvaluation.lead_university})`}
          targetUrl={selectedTeamForEvaluation.github_repo_url}
          initialEvaluation={selectedTeamForEvaluation.evaluation}
          onEvaluationUpdated={handleEvaluationUpdated}
        />
      )}
    </div>
  );
}
