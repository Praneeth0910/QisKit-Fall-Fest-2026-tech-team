'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Trophy,
  Search,
  Filter,
  Download,
  RefreshCw,
  ExternalLink,
  Trash2,
  FileText,
  Video,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  Loader2,
  FileCode,
  Calendar,
  Layers,
  Sparkles,
  Clock,
  Sliders,
  MessageSquare,
  XCircle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { EvaluationDrawer } from './EvaluationDrawer';
import { SubmissionEvaluation } from '@/types/evaluations';

export interface CompetitionSubmissionItem {
  id: string;
  email: string;
  fullName?: string;
  competition_type: 'reels' | 'poster' | 'essay';
  submission_url: string;
  submission_title?: string | null;
  notes?: string | null;
  status: string;
  submitted_at: string;
  isDocument: boolean;
  documentType: 'pdf' | 'docx' | 'link';
  evaluation?: SubmissionEvaluation | null;
}

interface Stats {
  total: number;
  reels: number;
  poster: number;
  essay: number;
  documentsCount: number;
  shortlistedCount?: number;
  rejectedCount?: number;
  evaluatedCount?: number;
  downloadedCount?: number;
}

export function AdminCompetitionsView() {
  const [submissions, setSubmissions] = useState<CompetitionSubmissionItem[]>([]);
  const [stats, setStats] = useState<Stats>({
    total: 0,
    reels: 0,
    poster: 0,
    essay: 0,
    documentsCount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'reels' | 'poster' | 'essay' | 'documents' | 'shortlisted' | 'rejected' | 'downloaded'>('all');
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; isError: boolean } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Evaluation drawer state
  const [selectedSubForEvaluation, setSelectedSubForEvaluation] = useState<CompetitionSubmissionItem | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [actionInProgressId, setActionInProgressId] = useState<string | null>(null);

  const fetchSubmissions = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/admin/competitions');
      if (res.ok) {
        const data = await res.json();
        setSubmissions(data.submissions || []);
        if (data.stats) {
          setStats(data.stats);
        }
      }
    } catch (err) {
      console.error('Error fetching admin competitions data:', err);
      setFeedbackMsg({ text: 'Failed to load submissions from server.', isError: true });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubmissions();

    // Listen to real-time evaluation updates across all admin sessions
    const channel = supabase
      .channel('competitions-evaluations-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'submission_evaluations' },
        (payload) => {
          const updated = (payload.new || {}) as SubmissionEvaluation;
          if (['reels', 'poster', 'essay'].includes(updated.category)) {
            setSubmissions((prev) =>
              prev.map((sub) => (sub.id === updated.target_id ? { ...sub, evaluation: updated } : sub))
            );
            setSelectedSubForEvaluation((curr) =>
              curr && curr.id === updated.target_id ? { ...curr, evaluation: updated } : curr
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchSubmissions]);

  // Quick Action: Download / Inspect & Auto-Tick in DB
  const handleQuickDownload = async (sub: CompetitionSubmissionItem) => {
    try {
      setActionInProgressId(sub.id);
      const link = document.createElement('a');
      link.href = sub.submission_url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      if (sub.isDocument) link.download = '';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      const res = await fetch('/api/admin/evaluations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: sub.competition_type,
          target_id: sub.id,
          action: 'mark_download',
        }),
      });

      const json = await res.json();
      if (json.success && json.evaluation) {
        setSubmissions((prev) =>
          prev.map((s) => (s.id === sub.id ? { ...s, evaluation: json.evaluation } : s))
        );
      }
    } catch (err) {
      console.error('Error logging competition download:', err);
    } finally {
      setActionInProgressId(null);
    }
  };

  // Quick Action: Toggle Next Round Shortlist
  const handleQuickToggleNextRound = async (sub: CompetitionSubmissionItem) => {
    try {
      setActionInProgressId(sub.id);
      const res = await fetch('/api/admin/evaluations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: sub.competition_type,
          target_id: sub.id,
          action: 'toggle_next_round',
        }),
      });

      const json = await res.json();
      if (json.success && json.evaluation) {
        setSubmissions((prev) =>
          prev.map((s) => (s.id === sub.id ? { ...s, evaluation: json.evaluation } : s))
        );
      }
    } catch (err) {
      console.error('Error toggling competition next round:', err);
    } finally {
      setActionInProgressId(null);
    }
  };

  // Quick Action: Toggle Rejection
  const handleQuickToggleReject = async (sub: CompetitionSubmissionItem) => {
    try {
      setActionInProgressId(sub.id);
      const res = await fetch('/api/admin/evaluations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: sub.competition_type,
          target_id: sub.id,
          action: 'toggle_reject',
        }),
      });

      const json = await res.json();
      if (json.success && json.evaluation) {
        setSubmissions((prev) =>
          prev.map((s) => (s.id === sub.id ? { ...s, evaluation: json.evaluation } : s))
        );
        const wasRejected = json.evaluation.status === 'rejected';
        setFeedbackMsg({
          text: wasRejected
            ? `Submission for ${sub.email} marked as rejected.`
            : `Rejection cleared for ${sub.email} (restored to review).`,
          isError: false,
        });
      } else {
        setFeedbackMsg({
          text: json.error || 'Failed to update rejection status.',
          isError: true,
        });
      }
    } catch (err) {
      console.error('Error toggling competition rejection:', err);
      setFeedbackMsg({ text: 'Network error updating rejection status.', isError: true });
    } finally {
      setActionInProgressId(null);
    }
  };

  const openEvaluationDesk = (sub: CompetitionSubmissionItem) => {
    setSelectedSubForEvaluation(sub);
    setIsDrawerOpen(true);
  };

  const handleEvaluationUpdated = (updated: SubmissionEvaluation) => {
    setSubmissions((prev) =>
      prev.map((s) => (s.id === updated.target_id ? { ...s, evaluation: updated } : s))
    );
  };

  const handleDelete = async (sub: CompetitionSubmissionItem) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to remove the ${sub.competition_type.toUpperCase()} submission for ${sub.email}? This will reset their challenge status to pending so they can resubmit.`
    );
    if (!confirmDelete) return;

    try {
      setDeletingId(sub.id);
      const res = await fetch(`/api/admin/competitions?id=${encodeURIComponent(sub.id)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setFeedbackMsg({ text: data.message || 'Submission deleted successfully.', isError: false });
        await fetchSubmissions();
      } else {
        setFeedbackMsg({ text: data.error || 'Failed to delete submission.', isError: true });
      }
    } catch (err) {
      console.error('Error deleting submission:', err);
      setFeedbackMsg({ text: 'Network error deleting submission.', isError: true });
    } finally {
      setDeletingId(null);
    }
  };

  const filteredSubmissions = useMemo(() => {
    return submissions.filter((sub) => {
      // Type and evaluation filter
      if (typeFilter === 'documents' && !sub.isDocument) return false;
      if (typeFilter === 'shortlisted' && !sub.evaluation?.is_next_round) return false;
      if (typeFilter === 'rejected' && sub.evaluation?.status !== 'rejected') return false;
      if (typeFilter === 'downloaded' && !sub.evaluation?.downloaded) return false;
      if (
        typeFilter !== 'all' &&
        typeFilter !== 'documents' &&
        typeFilter !== 'shortlisted' &&
        typeFilter !== 'rejected' &&
        typeFilter !== 'downloaded' &&
        sub.competition_type !== typeFilter
      ) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesEmail = sub.email.toLowerCase().includes(query);
        const matchesName = (sub.fullName || '').toLowerCase().includes(query);
        const matchesTitle = (sub.submission_title || '').toLowerCase().includes(query);
        const matchesNotes = (sub.notes || '').toLowerCase().includes(query);
        const matchesType = sub.competition_type.toLowerCase().includes(query);
        return matchesEmail || matchesName || matchesTitle || matchesNotes || matchesType;
      }

      return true;
    });
  }, [submissions, typeFilter, searchQuery]);

  const shortlistedCount = useMemo(
    () => submissions.filter((s) => s.evaluation?.is_next_round).length,
    [submissions]
  );
  const rejectedCount = useMemo(
    () => submissions.filter((s) => s.evaluation?.status === 'rejected').length,
    [submissions]
  );
  const downloadedCount = useMemo(
    () => submissions.filter((s) => s.evaluation?.downloaded).length,
    [submissions]
  );

  const exportCSV = () => {
    if (filteredSubmissions.length === 0) return;

    const headers = [
      'Participant Name',
      'Email',
      'Competition Track',
      'Day',
      'Submission Mode',
      'Document Format',
      'Submission / File URL',
      'Submission Title',
      'Notes / Abstract',
      'Round 2 Shortlisted',
      'Evaluation Status',
      'Score',
      'Downloaded',
      'Downloaded By',
      'Submitted At (UTC)',
    ];

    const rows = filteredSubmissions.map((sub) => {
      const day =
        sub.competition_type === 'reels' ? 'Day 1' : sub.competition_type === 'poster' ? 'Day 2' : 'Day 3';
      const mode = sub.isDocument ? 'Uploaded Document' : 'External Web Link';
      const format = sub.documentType.toUpperCase();

      return [
        `"${(sub.fullName || '').replace(/"/g, '""')}"`,
        `"${sub.email.replace(/"/g, '""')}"`,
        `"${sub.competition_type.toUpperCase()}"`,
        `"${day}"`,
        `"${mode}"`,
        `"${format}"`,
        `"${sub.submission_url.replace(/"/g, '""')}"`,
        `"${(sub.submission_title || '').replace(/"/g, '""')}"`,
        `"${(sub.notes || '').replace(/"/g, '""')}"`,
        sub.evaluation?.is_next_round ? 'YES (Round 2)' : 'NO',
        sub.evaluation?.status || 'pending',
        sub.evaluation?.score !== null && sub.evaluation?.score !== undefined ? String(sub.evaluation.score) : 'N/A',
        sub.evaluation?.downloaded ? 'YES' : 'NO',
        `"${(sub.evaluation?.downloaded_by || '').replace(/"/g, '""')}"`,
        `"${sub.submitted_at}"`,
      ];
    });

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `qff_competition_submissions_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="p-6 bg-white dark:bg-[#150709] border border-slate-200 dark:border-[#3D1418] rounded-xl shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-burgundy/10 dark:bg-burgundy/20 text-burgundy dark:text-[#E89BA5]">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-[#FAF6F3]">
                Daily Competitions & Jury Registry
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Review, filter, inspect, and export participant submissions across Day 1 (Reels), Day 2 (Digital Poster), and Day 3 (Quantum Essay). Supports direct document downloads (.pdf / .docx) and web links.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={exportCSV}
              disabled={filteredSubmissions.length === 0}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-medium text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV ({filteredSubmissions.length})</span>
            </button>

            <button
              type="button"
              onClick={fetchSubmissions}
              disabled={isLoading}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-[#3D1418] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1E0B0E] transition-colors cursor-pointer disabled:opacity-50"
              title="Refresh submissions"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Feedback Alert */}
        {feedbackMsg && (
          <div
            className={`p-3.5 rounded-lg text-xs flex items-center justify-between gap-2.5 ${
              feedbackMsg.isError
                ? 'bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300'
                : 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {feedbackMsg.isError ? (
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              )}
              <span>{feedbackMsg.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedbackMsg(null)}
              className="text-xs font-semibold underline hover:opacity-75"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Metrics Row */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#1A0A0D] border border-slate-100 dark:border-[#331115]">
            <span className="text-2xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Entries
            </span>
            <div className="text-lg font-bold text-slate-900 dark:text-[#FAF6F3] mt-0.5">
              {stats.total}
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#1A0A0D] border border-slate-100 dark:border-[#331115]">
            <span className="text-2xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Day 1 Reels
            </span>
            <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">
              {stats.reels}
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#1A0A0D] border border-slate-100 dark:border-[#331115]">
            <span className="text-2xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Day 2 Posters
            </span>
            <div className="text-lg font-bold text-amber-600 dark:text-amber-400 mt-0.5">
              {stats.poster}
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#1A0A0D] border border-slate-100 dark:border-[#331115]">
            <span className="text-2xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Day 3 Essays
            </span>
            <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
              {stats.essay}
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#1A0A0D] border border-slate-100 dark:border-[#331115]">
            <span className="text-2xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Uploaded Docs
            </span>
            <div className="text-lg font-bold text-burgundy dark:text-[#E89BA5] mt-0.5">
              {stats.documentsCount}
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by participant name, email, submission title or notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-slate-200 dark:border-[#3D1418] bg-white dark:bg-[#150709] text-slate-900 dark:text-[#FAF6F3] placeholder-slate-400 focus:outline-hidden focus:border-burgundy dark:focus:border-[#E89BA5]"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setTypeFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer shrink-0 ${
              typeFilter === 'all'
                ? 'bg-burgundy text-white dark:bg-[#E89BA5] dark:text-[#100405]'
                : 'bg-white dark:bg-[#150709] border border-slate-200 dark:border-[#3D1418] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1E0B0E]'
            }`}
          >
            All Tracks ({submissions.length})
          </button>

          <button
            type="button"
            onClick={() => setTypeFilter('reels')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer shrink-0 ${
              typeFilter === 'reels'
                ? 'bg-indigo-600 text-white dark:bg-indigo-500'
                : 'bg-white dark:bg-[#150709] border border-slate-200 dark:border-[#3D1418] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1E0B0E]'
            }`}
          >
            Reels (Day 1)
          </button>

          <button
            type="button"
            onClick={() => setTypeFilter('poster')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer shrink-0 ${
              typeFilter === 'poster'
                ? 'bg-amber-600 text-white dark:bg-amber-500'
                : 'bg-white dark:bg-[#150709] border border-slate-200 dark:border-[#3D1418] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1E0B0E]'
            }`}
          >
            Posters (Day 2)
          </button>

          <button
            type="button"
            onClick={() => setTypeFilter('essay')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer shrink-0 ${
              typeFilter === 'essay'
                ? 'bg-emerald-600 text-white dark:bg-emerald-500'
                : 'bg-white dark:bg-[#150709] border border-slate-200 dark:border-[#3D1418] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1E0B0E]'
            }`}
          >
            Essays (Day 3)
          </button>

          <button
            type="button"
            onClick={() => setTypeFilter('documents')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer shrink-0 ${
              typeFilter === 'documents'
                ? 'bg-burgundy text-white dark:bg-[#E89BA5] dark:text-[#100405]'
                : 'bg-white dark:bg-[#150709] border border-slate-200 dark:border-[#3D1418] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1E0B0E]'
            }`}
          >
            Docs Only ({stats.documentsCount})
          </button>

          <button
            type="button"
            onClick={() => setTypeFilter('shortlisted')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer shrink-0 ${
              typeFilter === 'shortlisted'
                ? 'bg-emerald-600 text-white'
                : 'bg-white dark:bg-[#150709] border border-slate-200 dark:border-[#3D1418] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1E0B0E]'
            }`}
          >
            Round 2 Shortlisted ({shortlistedCount})
          </button>

          <button
            type="button"
            onClick={() => setTypeFilter('rejected')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer shrink-0 ${
              typeFilter === 'rejected'
                ? 'bg-rose-600 text-white'
                : 'bg-white dark:bg-[#150709] border border-slate-200 dark:border-[#3D1418] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1E0B0E]'
            }`}
          >
            Rejected ({rejectedCount})
          </button>

          <button
            type="button"
            onClick={() => setTypeFilter('downloaded')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer shrink-0 ${
              typeFilter === 'downloaded'
                ? 'bg-sky-600 text-white'
                : 'bg-white dark:bg-[#150709] border border-slate-200 dark:border-[#3D1418] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1E0B0E]'
            }`}
          >
            Downloaded ({downloadedCount})
          </button>
        </div>
      </div>

      {/* Submissions List Table */}
      <div className="bg-white dark:bg-[#150709] border border-slate-200 dark:border-[#3D1418] rounded-xl shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-burgundy dark:text-[#E89BA5]" />
            <p className="text-xs">Loading competition registry...</p>
          </div>
        ) : filteredSubmissions.length === 0 ? (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400 space-y-2">
            <Trophy className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              No competition submissions found
            </p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {searchQuery
                ? 'No entries match your search query. Try clearing the filter.'
                : 'No participants have submitted entries for this category yet.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-[#1D0A0E] border-b border-slate-200 dark:border-[#3D1418] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">
                  <th className="py-3 px-4">Participant</th>
                  <th className="py-3 px-4">Track</th>
                  <th className="py-3 px-4">Format</th>
                  <th className="py-3 px-4">Title & Details</th>
                  <th className="py-3 px-4">Submitted At</th>
                  <th className="py-3 px-4">Evaluation & Audit</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#280C10]">
                {filteredSubmissions.map((sub) => {
                  const trackBadge =
                    sub.competition_type === 'reels' ? (
                      <span className="px-2 py-0.5 rounded text-2xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800 flex items-center gap-1 w-fit">
                        <Video className="w-3 h-3" />
                        Day 1 Reel
                      </span>
                    ) : sub.competition_type === 'poster' ? (
                      <span className="px-2 py-0.5 rounded text-2xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 flex items-center gap-1 w-fit">
                        <Layers className="w-3 h-3" />
                        Day 2 Poster
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-2xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 flex items-center gap-1 w-fit">
                        <FileText className="w-3 h-3" />
                        Day 3 Essay
                      </span>
                    );

                  const isDrive = (sub.submission_url || '').toLowerCase().includes('drive.google');
                  const isInstagram = (sub.submission_url || '').toLowerCase().includes('instagram.com');
                  const isLinkedIn =
                    (sub.submission_url || '').toLowerCase().includes('linkedin.com') ||
                    (sub.submission_url || '').toLowerCase().includes('lnkd.in');
                  const isYouTube =
                    (sub.submission_url || '').toLowerCase().includes('youtube.com') ||
                    (sub.submission_url || '').toLowerCase().includes('youtu.be');

                  const formatBadge =
                    sub.documentType === 'pdf' ? (
                      <span className="px-2 py-0.5 rounded text-2xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800 flex items-center gap-1 w-fit">
                        <FileCode className="w-3 h-3" />
                        PDF Document
                      </span>
                    ) : sub.documentType === 'docx' ? (
                      <span className="px-2 py-0.5 rounded text-2xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800 flex items-center gap-1 w-fit">
                        <FileText className="w-3 h-3" />
                        Word (DOCX)
                      </span>
                    ) : sub.competition_type === 'reels' && isDrive ? (
                      <span className="px-2 py-0.5 rounded text-2xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 flex items-center gap-1 w-fit">
                        <AlertCircle className="w-3 h-3" />
                        Drive Link (Needs Social URL)
                      </span>
                    ) : sub.competition_type === 'reels' && isInstagram ? (
                      <span className="px-2 py-0.5 rounded text-2xs font-semibold bg-pink-50 text-pink-700 border border-pink-200 dark:bg-pink-950/40 dark:text-pink-300 dark:border-pink-800 flex items-center gap-1 w-fit">
                        <ExternalLink className="w-3 h-3" />
                        Instagram Reel
                      </span>
                    ) : sub.competition_type === 'reels' && isLinkedIn ? (
                      <span className="px-2 py-0.5 rounded text-2xs font-semibold bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800 flex items-center gap-1 w-fit">
                        <ExternalLink className="w-3 h-3" />
                        LinkedIn Video
                      </span>
                    ) : sub.competition_type === 'reels' && isYouTube ? (
                      <span className="px-2 py-0.5 rounded text-2xs font-semibold bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800 flex items-center gap-1 w-fit">
                        <ExternalLink className="w-3 h-3" />
                        YouTube Short
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-2xs font-semibold bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 flex items-center gap-1 w-fit">
                        <ExternalLink className="w-3 h-3" />
                        Web Link
                      </span>
                    );

                  const formattedDate = new Date(sub.submitted_at).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <tr
                      key={sub.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-[#1A0A0D]/70 transition-colors"
                    >
                      {/* Participant */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 dark:text-[#FAF6F3]">
                          {sub.fullName || 'Anonymous Participant'}
                        </div>
                        <div className="text-2xs text-slate-500 dark:text-slate-400 font-mono">
                          {sub.email}
                        </div>
                      </td>

                      {/* Track */}
                      <td className="py-3 px-4">{trackBadge}</td>

                      {/* Format */}
                      <td className="py-3 px-4">{formatBadge}</td>

                      {/* Title & Notes */}
                      <td className="py-3 px-4 max-w-xs">
                        {sub.submission_title ? (
                          <div className="font-medium text-slate-800 dark:text-slate-200 truncate">
                            {sub.submission_title}
                          </div>
                        ) : (
                          <div className="text-slate-400 italic">No custom title</div>
                        )}
                        {sub.notes && sub.notes !== 'file_upload' && (
                          <p className="text-2xs text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                            {sub.notes}
                          </p>
                        )}
                      </td>

                      {/* Submitted At */}
                      <td className="py-3 px-4 whitespace-nowrap text-slate-500 dark:text-slate-400">
                        {formattedDate}
                      </td>

                      {/* Evaluation & Audit Status */}
                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {sub.evaluation?.downloaded ? (
                              <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>Downloaded ({sub.evaluation.downloaded_by?.split(' ')[0] || 'Admin'})</span>
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                                <Clock className="w-3 h-3" /> Not inspected
                              </span>
                            )}

                            {sub.evaluation?.is_next_round && (
                              <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-300 dark:border-emerald-700">
                                Round 2
                              </span>
                            )}

                            {sub.evaluation?.status === 'rejected' && (
                              <span className="text-[10px] font-bold text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-950/60 px-1.5 py-0.5 rounded border border-rose-300 dark:border-rose-700 flex items-center gap-1">
                                <XCircle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                                Rejected
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            {sub.evaluation?.score !== null && sub.evaluation?.score !== undefined && (
                              <span className="text-2xs font-mono font-bold text-amber-700 dark:text-amber-300">
                                {sub.evaluation.score}/100 pts
                              </span>
                            )}
                            {sub.evaluation?.comments && sub.evaluation.comments.length > 0 && (
                              <span className="text-2xs text-slate-500 flex items-center gap-0.5">
                                <MessageSquare className="w-2.5 h-2.5 text-burgundy dark:text-[#E89BA5]" />
                                <span>{sub.evaluation.comments.length} notes</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Quick Download / View & Tick */}
                          <button
                            type="button"
                            onClick={() => handleQuickDownload(sub)}
                            disabled={actionInProgressId === sub.id}
                            className={`px-2.5 py-1.5 rounded-lg text-2xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                              sub.evaluation?.downloaded
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 hover:bg-emerald-100'
                                : 'bg-burgundy text-white hover:bg-burgundy/90 dark:bg-[#E89BA5] dark:text-[#100405]'
                            }`}
                            title="Download / Inspect and register verification"
                          >
                            {actionInProgressId === sub.id ? (
                              <RefreshCw className="w-3 h-3 animate-spin" />
                            ) : sub.evaluation?.downloaded ? (
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Download className="w-3 h-3" />
                            )}
                            <span>{sub.evaluation?.downloaded ? 'Inspected' : 'Download'}</span>
                          </button>

                          {/* Quick Toggle Next Round */}
                          <button
                            type="button"
                            onClick={() => handleQuickToggleNextRound(sub)}
                            disabled={actionInProgressId === sub.id}
                            className={`px-2.5 py-1.5 rounded-lg text-2xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                              sub.evaluation?.is_next_round
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                            }`}
                            title="Toggle Round 2 Shortlist"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            <span>{sub.evaluation?.is_next_round ? 'Shortlisted' : 'Shortlist'}</span>
                          </button>

                          {/* Quick Toggle Reject */}
                          <button
                            type="button"
                            onClick={() => handleQuickToggleReject(sub)}
                            disabled={actionInProgressId === sub.id}
                            className={`px-2.5 py-1.5 rounded-lg text-2xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                              sub.evaluation?.status === 'rejected'
                                ? 'bg-rose-600 hover:bg-rose-700 text-white border border-rose-500'
                                : 'bg-white hover:bg-rose-50 hover:text-rose-700 dark:bg-slate-800 text-slate-700 dark:text-slate-200 dark:hover:bg-rose-950/40 dark:hover:text-rose-300 border border-slate-200 dark:border-slate-700'
                            }`}
                            title={sub.evaluation?.status === 'rejected' ? 'Undo rejection (restore to review)' : 'Reject submission'}
                          >
                            <XCircle className="w-3 h-3" />
                            <span>{sub.evaluation?.status === 'rejected' ? 'Rejected' : 'Reject'}</span>
                          </button>

                          {/* Open Review Desk Drawer */}
                          <button
                            type="button"
                            onClick={() => openEvaluationDesk(sub)}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-900 dark:bg-[#250D11] hover:bg-slate-800 text-white text-2xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                            title="Open evaluation rubric and discussion notes"
                          >
                            <Sliders className="w-3 h-3" />
                            <span>Review Desk</span>
                          </button>

                          {/* Delete Button */}
                          <button
                            type="button"
                            onClick={() => handleDelete(sub)}
                            disabled={deletingId === sub.id}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 transition-colors cursor-pointer disabled:opacity-50"
                            title="Reset submission (allow resubmission)"
                          >
                            {deletingId === sub.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-600" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Evaluation Drawer Modal */}
      {selectedSubForEvaluation && (
        <EvaluationDrawer
          isOpen={isDrawerOpen}
          onClose={() => {
            setIsDrawerOpen(false);
            setSelectedSubForEvaluation(null);
          }}
          category={selectedSubForEvaluation.competition_type}
          targetId={selectedSubForEvaluation.id}
          targetTitle={`${selectedSubForEvaluation.fullName || selectedSubForEvaluation.email} (${selectedSubForEvaluation.competition_type.toUpperCase()})`}
          targetSubtitle={selectedSubForEvaluation.submission_title || selectedSubForEvaluation.notes || 'Creative Competition Entry'}
          targetUrl={selectedSubForEvaluation.submission_url}
          initialEvaluation={selectedSubForEvaluation.evaluation}
          onEvaluationUpdated={handleEvaluationUpdated}
        />
      )}
    </div>
  );
}
