'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import {
  Terminal,
  Trophy,
  CheckCircle2,
  Clock,
  RefreshCw,
  Search,
  Filter,
  Users,
  Code2,
  AlertCircle,
  ExternalLink,
  Lock,
  Unlock,
  Loader2,
  Shield,
  X,
  PlayCircle,
  Sliders,
} from 'lucide-react';
import { EvaluationDrawer } from './EvaluationDrawer';

export function AdminCodingChallengeView() {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [filterProblem, setFilterProblem] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchUser, setSearchUser] = useState<string>('');

  // Evaluation drawer state
  const [selectedSubForEvaluation, setSelectedSubForEvaluation] = useState<any>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Lock status management
  const [isLocked, setIsLocked] = useState<boolean>(true);
  const [isTogglingLock, setIsTogglingLock] = useState<boolean>(false);
  const [lockMsg, setLockMsg] = useState<string>('');
  const [lockMsgIsError, setLockMsgIsError] = useState<boolean>(false);

  const fetchStats = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/admin/coding-challenge', { cache: 'no-store' });
      const json = await res.json();
      if (json.success) {
        setData(json);
        setIsLocked(Boolean(json.isLocked ?? json.config?.is_locked ?? true));
      }
    } catch (err) {
      console.error('Failed to load coding challenge stats:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleToggleLock = async () => {
    try {
      setIsTogglingLock(true);
      setLockMsg('');
      setLockMsgIsError(false);

      const nextLockedState = !isLocked;

      const res = await fetch('/api/admin/coding-challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_locked: nextLockedState }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setIsLocked(nextLockedState);
        setLockMsg(
          nextLockedState
            ? "Python Coding Challenge in Qiskit is now LOCKED! Regular participants see the 'Coming Soon' holding state. Admins retain full bypass access for testing."
            : "Python Coding Challenge in Qiskit is now UNLOCKED! Live and open to all registered participants."
        );
        setLockMsgIsError(false);
      } else {
        setLockMsg(json.error || 'Failed to toggle challenge lock state');
        setLockMsgIsError(true);
      }
    } catch (err: any) {
      console.error('Error toggling challenge lock:', err);
      setLockMsg(err?.message || 'Error communicating with server');
      setLockMsgIsError(true);
    } finally {
      setIsTogglingLock(false);
    }
  };

  const submissions = data?.recentSubmissions || [];
  const filteredSubmissions = submissions.filter((sub: any) => {
    if (filterProblem !== 'all' && sub.challenge_id !== filterProblem) return false;
    if (filterStatus !== 'all' && sub.status !== filterStatus) return false;
    if (searchUser && !(sub.user_email || '').toLowerCase().includes(searchUser.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6 font-sans">
      {/* Master Lock / Unlock Control Card */}
      <div className="bg-white dark:bg-[#150709] border border-slate-200 dark:border-[#3D1418] rounded-xl p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div
              className={clsx(
                'w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border transition-colors',
                isLocked
                  ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400'
                  : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400'
              )}
            >
              {isLocked ? <Lock className="w-6 h-6 animate-pulse" /> : <Unlock className="w-6 h-6" />}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span
                  className={clsx(
                    'text-xs font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full',
                    isLocked
                      ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                      : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                  )}
                >
                  {isLocked ? 'Challenge Locked (Coming Soon Mode)' : 'Challenge Live & Unlocked'}
                </span>
                <span className="text-[10px] font-mono text-slate-500 bg-slate-100 dark:bg-[#1C0A0D] px-2 py-0.5 rounded flex items-center gap-1">
                  <Shield className="w-3 h-3 text-burgundy dark:text-[#E89BA5]" />
                  Admin Testing Allowed
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xl">
                {isLocked
                  ? "When locked, regular participants see the 'Coming Soon' holding state and cannot view problems or submit code. Administrators have bypass access to test problems and run code."
                  : 'When unlocked, registered participants can view all 9 challenge problems, write Python/Qiskit code in the Monaco editor, and submit to the quantum evaluator.'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/learning/qiskit-challenge"
              target="_blank"
              className="px-3.5 py-2 rounded-lg text-xs font-semibold border border-slate-200 dark:border-[#3D1418] bg-slate-100 dark:bg-[#1C0A0D] text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#250D11] transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Test Challenge (Admin View)</span>
            </Link>

            <button
              type="button"
              onClick={handleToggleLock}
              disabled={isTogglingLock}
              className={clsx(
                'px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer border shadow-xs',
                isLocked
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600'
                  : 'bg-amber-500 hover:bg-amber-600 text-white border-amber-500'
              )}
            >
              {isTogglingLock ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : isLocked ? (
                <Unlock className="w-3.5 h-3.5" />
              ) : (
                <Lock className="w-3.5 h-3.5" />
              )}
              <span>{isLocked ? 'Unlock Challenge (Go Live)' : 'Lock Challenge (Coming Soon)'}</span>
            </button>
          </div>
        </div>

        {/* Lock message banner */}
        {lockMsg && (
          <div
            className={`mt-4 p-3.5 rounded-lg text-xs flex items-center justify-between gap-2 transition-all ${
              lockMsgIsError
                ? 'bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200'
                : 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {lockMsgIsError ? (
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              ) : (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              )}
              <span className="font-medium">{lockMsg}</span>
            </div>
            <button
              onClick={() => setLockMsg('')}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-white dark:bg-[#150709] border border-slate-200 dark:border-[#3D1418]">
        <div>
          <h2 className="font-serif text-lg font-bold text-slate-900 dark:text-[#FAF6F3]">
            Python Coding Challenge in Qiskit Analytics & Submissions
          </h2>
          <p className="text-xs text-slate-500">
            Real-time evaluation statistics, problem solve rates, and participant submission records.
          </p>
        </div>

        <button
          onClick={fetchStats}
          disabled={isLoading}
          className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-[#3D1418] hover:bg-slate-100 dark:hover:bg-[#1C0A0D] text-xs font-semibold flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className={clsx('w-3.5 h-3.5', isLoading && 'animate-spin')} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-white dark:bg-[#150709] border border-slate-200 dark:border-[#3D1418] shadow-xs">
          <span className="text-xs text-slate-500 font-semibold">Total Submissions</span>
          <div className="font-serif text-2xl font-bold mt-1 text-slate-900 dark:text-[#FAF6F3]">
            {data?.stats?.totalSubmissions || 0}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-[#150709] border border-slate-200 dark:border-[#3D1418] shadow-xs">
          <span className="text-xs text-slate-500 font-semibold">Active Participants</span>
          <div className="font-serif text-2xl font-bold mt-1 text-slate-900 dark:text-[#FAF6F3]">
            {data?.stats?.uniqueParticipants || 0}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-[#150709] border border-slate-200 dark:border-[#3D1418] shadow-xs">
          <span className="text-xs text-slate-500 font-semibold">Problems Configured</span>
          <div className="font-serif text-2xl font-bold mt-1 text-slate-900 dark:text-[#FAF6F3]">
            9 Problems (100 pts)
          </div>
        </div>
      </div>

      {/* Problem-wise Statistics Grid */}
      <div className="bg-white dark:bg-[#150709] border border-slate-200 dark:border-[#3D1418] rounded-xl p-5 shadow-xs space-y-3">
        <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-500">
          Problem-Wise Performance
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(data?.stats?.problems || []).map((prob: any) => (
            <div
              key={prob.id}
              className="p-3.5 rounded-lg border border-slate-100 dark:border-[#3D1418] bg-slate-50/50 dark:bg-[#1C0A0D] flex flex-col justify-between gap-2"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-xs text-burgundy dark:text-[#E89BA5]">
                    {prob.problemCode}
                  </span>
                  <span className="text-[10px] font-mono font-bold text-slate-400">
                    {prob.points} pts
                  </span>
                </div>
                <h4 className="font-semibold text-xs text-slate-800 dark:text-[#FAF6F3] mt-1 line-clamp-1">
                  {prob.title}
                </h4>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-200/60 dark:border-[#3D1418] pt-2 mt-1">
                <span>
                  Solvers: <strong className="text-slate-800 dark:text-[#FAF6F3]">{prob.uniqueSolvers}</strong>/{prob.uniqueParticipants}
                </span>
                <span className="font-mono text-emerald-600 font-semibold">
                  {prob.solveRate}% Rate
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Submissions Table with Filters */}
      <div className="bg-white dark:bg-[#150709] border border-slate-200 dark:border-[#3D1418] rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-[#3D1418] pb-4">
          <div className="flex items-center gap-2">
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-500">
              Live Submission Log ({filteredSubmissions.length})
            </h3>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Search email */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search email..."
                value={searchUser}
                onChange={(e) => setSearchUser(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-[#3D1418] bg-slate-50 dark:bg-[#1C0A0D] text-slate-900 dark:text-[#FAF6F3] focus:outline-none focus:ring-1 focus:ring-burgundy w-36 sm:w-44"
              />
            </div>

            {/* Filter by problem */}
            <select
              value={filterProblem}
              onChange={(e) => setFilterProblem(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-[#3D1418] bg-slate-50 dark:bg-[#1C0A0D] text-slate-900 dark:text-[#FAF6F3] focus:outline-none focus:ring-1 focus:ring-burgundy"
            >
              <option value="all">All Problems</option>
              {(data?.stats?.problems || []).map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.problemCode}
                </option>
              ))}
            </select>

            {/* Filter by status */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-[#3D1418] bg-slate-50 dark:bg-[#1C0A0D] text-slate-900 dark:text-[#FAF6F3] focus:outline-none focus:ring-1 focus:ring-burgundy"
            >
              <option value="all">All Statuses</option>
              <option value="accepted">Accepted (100%)</option>
              <option value="partial">Partial</option>
              <option value="wrong_answer">Wrong Answer</option>
              <option value="runtime_error">Runtime Error</option>
              <option value="compilation_error">Compilation Error</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-[#1C0A0D] text-slate-500 font-mono uppercase text-[10px]">
              <tr>
                <th className="px-3.5 py-2.5">User</th>
                <th className="px-3.5 py-2.5">Problem</th>
                <th className="px-3.5 py-2.5">Status</th>
                <th className="px-3.5 py-2.5">Score</th>
                <th className="px-3.5 py-2.5">Tests</th>
                <th className="px-3.5 py-2.5">Runtime</th>
                <th className="px-3.5 py-2.5">Timestamp</th>
                <th className="px-3.5 py-2.5 text-right">Review Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#3D1418]">
              {filteredSubmissions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3.5 py-8 text-center text-slate-400">
                    No submissions found matching the criteria.
                  </td>
                </tr>
              ) : (
                filteredSubmissions.map((sub: any) => {
                  const isAccepted = sub.status === 'accepted';
                  const isPartial = sub.status === 'partial';

                  return (
                    <tr
                      key={sub.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-[#1C0A0D]/50 transition-colors"
                    >
                      <td className="px-3.5 py-2.5 font-mono text-slate-700 dark:text-slate-300">
                        {sub.user_email}
                      </td>
                      <td className="px-3.5 py-2.5 font-mono font-bold text-burgundy dark:text-[#E89BA5]">
                        {sub.challenge_id}
                      </td>
                      <td className="px-3.5 py-2.5">
                        <div className="flex flex-col gap-1 items-start">
                          <span
                            className={clsx(
                              'px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider inline-flex items-center gap-1',
                              isAccepted &&
                                'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
                              isPartial &&
                                'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
                              !isAccepted &&
                                !isPartial &&
                                'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                            )}
                          >
                            {sub.status}
                          </span>
                          {sub.evaluation?.is_next_round && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                              Round 2
                            </span>
                          )}
                          {sub.evaluation?.status === 'rejected' && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-700">
                              Rejected
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3.5 py-2.5 font-mono font-bold text-slate-800 dark:text-[#FAF6F3]">
                        {sub.score} / {sub.max_score}
                      </td>
                      <td className="px-3.5 py-2.5 font-mono text-slate-500">
                        {sub.passed_tests} / {sub.total_tests}
                      </td>
                      <td className="px-3.5 py-2.5 font-mono text-slate-500">
                        {sub.execution_time_ms ? `${sub.execution_time_ms}ms` : '--'}
                      </td>
                      <td className="px-3.5 py-2.5 text-slate-400 font-mono text-[11px]">
                        {sub.submitted_at ? new Date(sub.submitted_at).toLocaleTimeString() : '--'}
                      </td>
                      <td className="px-3.5 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSubForEvaluation(sub);
                            setIsDrawerOpen(true);
                          }}
                          className="px-2.5 py-1 rounded bg-slate-900 dark:bg-[#250D11] hover:bg-slate-800 text-white font-mono text-[11px] inline-flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <Sliders className="w-3 h-3" />
                          <span>Review Desk</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Evaluation Drawer Modal */}
      {selectedSubForEvaluation && (
        <EvaluationDrawer
          isOpen={isDrawerOpen}
          onClose={() => {
            setIsDrawerOpen(false);
            setSelectedSubForEvaluation(null);
          }}
          category="coding"
          targetId={selectedSubForEvaluation.id}
          targetTitle={`${selectedSubForEvaluation.user_email} (Problem ${selectedSubForEvaluation.challenge_id})`}
          targetSubtitle={`Score: ${selectedSubForEvaluation.score}/${selectedSubForEvaluation.max_score} · Tests: ${selectedSubForEvaluation.passed_tests}/${selectedSubForEvaluation.total_tests} · Status: ${selectedSubForEvaluation.status}`}
          targetCode={selectedSubForEvaluation.source_code || null}
          initialEvaluation={selectedSubForEvaluation.evaluation || null}
          onEvaluationUpdated={(updatedEval) => {
            setData((prev: any) => {
              if (!prev) return prev;
              const nextSubs = (prev.recentSubmissions || []).map((s: any) =>
                s.id === updatedEval.target_id ? { ...s, evaluation: updatedEval } : s
              );
              return { ...prev, recentSubmissions: nextSubs };
            });
            fetchStats();
          }}
        />
      )}
    </div>
  );
}
