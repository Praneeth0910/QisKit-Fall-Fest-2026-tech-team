'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  CheckCircle2,
  Clock,
  ArrowRight,
  MessageSquare,
  Award,
  AlertCircle,
  ExternalLink,
  Github,
  FileCode,
  FileText,
  Video,
  Send,
  Loader2,
  UserCheck,
  ShieldAlert,
  Sliders,
  RotateCcw,
  XCircle,
  Copy,
  Check,
} from 'lucide-react';
import {
  SubmissionEvaluation,
  EvaluationCategory,
  EvaluationStatus,
  EvaluationRubric,
} from '@/types/evaluations';

export interface RubricCriterionDef {
  key: string;
  label: string;
  description: string;
  max: number;
}

export const RUBRIC_CONFIGS: Record<EvaluationCategory, RubricCriterionDef[]> = {
  reels: [
    { key: 'rigor', label: '1. Scientific Accuracy', description: 'Accuracy of quantum concepts, clarity of technical terminology', max: 25 },
    { key: 'execution', label: '2. Storytelling & Narrative Flow', description: 'Video pacing, presentation hook, and accessibility for learners', max: 25 },
    { key: 'novelty', label: '3. Creative Visual Production', description: 'Visual creativity, audio/video editing, and aesthetic polish', max: 25 },
    { key: 'impact', label: '4. Engagement & Educational Value', description: 'Takeaway retention, curiosity spark, and outreach effectiveness', max: 25 },
  ],
  poster: [
    { key: 'rigor', label: '1. Scientific Rigor & Depth', description: 'Depth of quantum theoretical foundation and correctness', max: 25 },
    { key: 'execution', label: '2. Visual Design & Typography', description: 'Layout balance, typographic hierarchy, and visual readability', max: 25 },
    { key: 'novelty', label: '3. Infographic & Schematic Originality', description: 'Original diagrams, conceptual schematics, and novel analogies', max: 25 },
    { key: 'impact', label: '4. Clarity & Academic Synthesis', description: 'Effectiveness in synthesizing complex ideas concisely', max: 25 },
  ],
  essay: [
    { key: 'rigor', label: '1. Theoretical Rigor & Depth', description: 'Mastery of quantum computation concepts and nuances', max: 25 },
    { key: 'execution', label: '2. Structure, Flow & Prose Quality', description: 'Clear thesis, logical paragraph transitions, and academic prose', max: 25 },
    { key: 'novelty', label: '3. Critical Analysis & Original Thought', description: 'Unique perspective, comparative argumentation, and critical synthesis', max: 25 },
    { key: 'impact', label: '4. Citations & Future Outlook', description: 'Relevance of cited literature and forward-looking conclusions', max: 25 },
  ],
  hackathon: [
    { key: 'rigor', label: '1. Quantum Rigor & Algorithmic Depth', description: 'Depth of quantum mechanics usage and circuit/algorithmic depth', max: 25 },
    { key: 'execution', label: '2. Software Architecture & Execution', description: 'Clean codebase, test coverage, repository structure, and execution', max: 25 },
    { key: 'novelty', label: '3. Originality & Solution Novelty', description: 'Uniqueness of problem approach and innovation in design', max: 25 },
    { key: 'impact', label: '4. Practical Viability & Documentation', description: 'Real-world applicability, problem alignment, and documentation', max: 25 },
  ],
  coding: [
    { key: 'rigor', label: '1. Algorithmic Correctness', description: 'Adherence to problem specification and mathematical constraints', max: 25 },
    { key: 'execution', label: '2. Circuit & Runtime Efficiency', description: 'Gate count, circuit depth, runtime performance, and resource footprint', max: 25 },
    { key: 'novelty', label: '3. Code Architecture & Qiskit Idioms', description: 'Idiomatic Qiskit patterns, clean abstractions, and readability', max: 25 },
    { key: 'impact', label: '4. Edge Cases & Robustness', description: 'Handling boundary values, parameter scaling, and error prevention', max: 25 },
  ],
};

interface EvaluationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  category: EvaluationCategory;
  targetId: string;
  targetTitle: string;
  targetSubtitle?: string;
  targetUrl?: string | null;
  targetCode?: string | null;
  initialEvaluation?: SubmissionEvaluation | null;
  onEvaluationUpdated?: (updated: SubmissionEvaluation) => void;
}

export function EvaluationDrawer({
  isOpen,
  onClose,
  category,
  targetId,
  targetTitle,
  targetSubtitle,
  targetUrl,
  targetCode,
  initialEvaluation,
  onEvaluationUpdated,
}: EvaluationDrawerProps) {
  const [evaluation, setEvaluation] = useState<SubmissionEvaluation | null>(
    initialEvaluation || null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Form states
  const [status, setStatus] = useState<EvaluationStatus>('pending');
  const [isNextRound, setIsNextRound] = useState<boolean>(false);
  const [rubric, setRubric] = useState<EvaluationRubric>({
    rigor: 20,
    execution: 20,
    novelty: 20,
    impact: 20,
  });
  const [totalScore, setTotalScore] = useState<number>(80);
  const [commentInput, setCommentInput] = useState('');
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; isError?: boolean } | null>(null);

  // Close with unsaved changes verification (Don Norman Error Prevention)
  const handleCloseWithCheck = () => {
    if (isDirty) {
      const confirmDiscard = window.confirm(
        'You have unsaved changes in this review desk. Do you want to discard them?'
      );
      if (!confirmDiscard) return;
    }
    setIsDirty(false);
    onClose();
  };

  // Keyboard accessibility: Escape key listener
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCloseWithCheck();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isDirty]);

  // Sync state when initialEvaluation or targetId changes
  useEffect(() => {
    if (!isOpen) return;

    setIsDirty(false);
    setFeedbackMsg(null);
    setCommentInput('');

    if (initialEvaluation) {
      setEvaluation(initialEvaluation);
      setStatus(initialEvaluation.status || 'pending');
      setIsNextRound(Boolean(initialEvaluation.is_next_round));
      const r = initialEvaluation.rubric_scores || {};
      const newRubric = {
        rigor: Number(r.rigor ?? 20),
        execution: Number(r.execution ?? 20),
        novelty: Number(r.novelty ?? 20),
        impact: Number(r.impact ?? 20),
      };
      setRubric(newRubric);
      setTotalScore(
        initialEvaluation.score !== null && initialEvaluation.score !== undefined
          ? initialEvaluation.score
          : (newRubric.rigor + newRubric.execution + newRubric.novelty + newRubric.impact)
      );
      setIsLoading(false);
    } else if (targetId) {
      // Clear previous target data immediately to avoid stale ghost leakage
      setEvaluation(null);
      setStatus('pending');
      setIsNextRound(false);
      setRubric({ rigor: 20, execution: 20, novelty: 20, impact: 20 });
      setTotalScore(80);
      setIsLoading(true);

      let isMounted = true;
      fetch(`/api/admin/evaluations?category=${category}&target_id=${encodeURIComponent(targetId)}`)
        .then((res) => res.json())
        .then((data) => {
          if (!isMounted) return;
          const found = data.evaluations?.[0];
          if (found) {
            setEvaluation(found);
            setStatus(found.status || 'pending');
            setIsNextRound(Boolean(found.is_next_round));
            const r = found.rubric_scores || {};
            const newRubric = {
              rigor: Number(r.rigor ?? 20),
              execution: Number(r.execution ?? 20),
              novelty: Number(r.novelty ?? 20),
              impact: Number(r.impact ?? 20),
            };
            setRubric(newRubric);
            setTotalScore(
              found.score !== null && found.score !== undefined
                ? found.score
                : (newRubric.rigor + newRubric.execution + newRubric.novelty + newRubric.impact)
            );
          } else {
            setEvaluation(null);
            setStatus('pending');
            setIsNextRound(false);
            setRubric({ rigor: 20, execution: 20, novelty: 20, impact: 20 });
            setTotalScore(80);
          }
        })
        .catch((err) => {
          console.error('Failed to load evaluation fallback:', err);
        })
        .finally(() => {
          if (isMounted) setIsLoading(false);
        });

      return () => {
        isMounted = false;
      };
    } else {
      setStatus('pending');
      setIsNextRound(false);
      setRubric({ rigor: 20, execution: 20, novelty: 20, impact: 20 });
      setTotalScore(80);
    }
  }, [initialEvaluation, isOpen, category, targetId]);

  const isGithub = Boolean(targetUrl?.includes('github.com'));
  const isDirectDownload = Boolean(
    targetUrl &&
      (/\.(pdf|docx|zip|tar\.gz)($|\?)/i.test(targetUrl) ||
        targetUrl.includes('/storage/v1/object/public/media/') ||
        isGithub)
  );

  // Recalculate score from rubric sliders
  const updateRubricField = (field: string, value: number) => {
    setIsDirty(true);
    const updated = { ...rubric, [field]: value };
    setRubric(updated);
    const sum = (updated.rigor || 0) + (updated.execution || 0) + (updated.novelty || 0) + (updated.impact || 0);
    setTotalScore(sum);
  };

  // Helper to trigger direct download or web inspection & mark verified in DB
  const handleDownloadAndTick = async () => {
    if (!targetUrl) return;

    try {
      setIsDownloading(true);

      if (isDirectDownload) {
        let downloadLink = targetUrl;
        if (isGithub) {
          const cleanRepo = targetUrl.replace(/\/+$/, '');
          downloadLink = `${cleanRepo}/archive/refs/heads/main.zip`;
        }

        const a = document.createElement('a');
        a.href = downloadLink;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        if (!isGithub) {
          a.download = '';
        }
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        // External link (e.g. video reel, Drive, YouTube, portfolio)
        window.open(targetUrl, '_blank', 'noopener,noreferrer');
      }

      // Call API to mark as downloaded / inspected
      const res = await fetch('/api/admin/evaluations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          target_id: targetId,
          action: 'mark_download',
        }),
      });

      const json = await res.json();
      if (json.success && json.evaluation) {
        setEvaluation(json.evaluation);
        setStatus(json.evaluation.status);
        if (onEvaluationUpdated) {
          onEvaluationUpdated(json.evaluation);
        }
        setFeedbackMsg({
          text: isDirectDownload
            ? 'Submission file downloaded and verified in audit record.'
            : 'Submission link inspected and verified in audit record.',
        });
      }
    } catch (err: any) {
      console.error('Error logging download/inspection:', err);
      setFeedbackMsg({ text: 'Action completed, but failed to log audit record.', isError: true });
    } finally {
      setIsDownloading(false);
      setTimeout(() => setFeedbackMsg(null), 4000);
    }
  };

  // Toggle Next Round Status
  const handleToggleNextRound = async () => {
    try {
      setIsSaving(true);
      const res = await fetch('/api/admin/evaluations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          target_id: targetId,
          action: 'toggle_next_round',
        }),
      });

      const json = await res.json();
      if (json.success && json.evaluation) {
        setEvaluation(json.evaluation);
        setIsNextRound(Boolean(json.evaluation.is_next_round));
        setStatus(json.evaluation.status);
        if (onEvaluationUpdated) {
          onEvaluationUpdated(json.evaluation);
        }
        setFeedbackMsg({
          text: json.evaluation.is_next_round
            ? 'Team advanced and marked for Round 2.'
            : 'Team removed from Round 2 shortlist.',
        });
      }
    } catch (err: any) {
      console.error('Error toggling next round:', err);
      setFeedbackMsg({ text: 'Failed to update round status.', isError: true });
    } finally {
      setIsSaving(false);
      setTimeout(() => setFeedbackMsg(null), 4000);
    }
  };

  // Toggle Reject Status
  const handleToggleReject = async () => {
    try {
      setIsSaving(true);
      const res = await fetch('/api/admin/evaluations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          target_id: targetId,
          action: 'toggle_reject',
        }),
      });

      const json = await res.json();
      if (json.success && json.evaluation) {
        setEvaluation(json.evaluation);
        setIsNextRound(Boolean(json.evaluation.is_next_round));
        setStatus(json.evaluation.status);
        if (onEvaluationUpdated) {
          onEvaluationUpdated(json.evaluation);
        }
        setFeedbackMsg({
          text: json.evaluation.status === 'rejected'
            ? 'Submission marked as rejected.'
            : 'Submission rejection undone (restored to review).',
        });
      }
    } catch (err: any) {
      console.error('Error toggling rejection:', err);
      setFeedbackMsg({ text: 'Failed to update rejection status.', isError: true });
    } finally {
      setIsSaving(false);
      setTimeout(() => setFeedbackMsg(null), 4000);
    }
  };

  // Save full rubric and score
  const handleSaveEvaluation = async () => {
    try {
      setIsSaving(true);
      const res = await fetch('/api/admin/evaluations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          target_id: targetId,
          action: 'update_evaluation',
          status,
          score: totalScore,
          rubric_scores: rubric,
          is_next_round: isNextRound,
        }),
      });

      const json = await res.json();
      if (json.success && json.evaluation) {
        setEvaluation(json.evaluation);
        setIsDirty(false);
        if (onEvaluationUpdated) {
          onEvaluationUpdated(json.evaluation);
        }
        setFeedbackMsg({ text: 'Evaluation score and rubric saved.' });
      } else {
        setFeedbackMsg({ text: json.error || 'Failed to save evaluation', isError: true });
      }
    } catch (err: any) {
      console.error('Error saving evaluation:', err);
      setFeedbackMsg({ text: 'Network error saving evaluation.', isError: true });
    } finally {
      setIsSaving(false);
      setTimeout(() => setFeedbackMsg(null), 4000);
    }
  };

  // Add a comment
  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentInput.trim()) return;

    try {
      setIsPostingComment(true);
      const res = await fetch('/api/admin/evaluations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          target_id: targetId,
          action: 'add_comment',
          comment_text: commentInput.trim(),
        }),
      });

      const json = await res.json();
      if (json.success && json.evaluation) {
        setEvaluation(json.evaluation);
        setCommentInput('');
        if (onEvaluationUpdated) {
          onEvaluationUpdated(json.evaluation);
        }
        setFeedbackMsg({ text: 'Evaluation note added.' });
      }
    } catch (err) {
      console.error('Error posting comment:', err);
      setFeedbackMsg({ text: 'Failed to post comment.', isError: true });
    } finally {
      setIsPostingComment(false);
      setTimeout(() => setFeedbackMsg(null), 4000);
    }
  };

  if (!isOpen) return null;

  const isDownloaded = Boolean(evaluation?.downloaded);
  const downloadedBy = evaluation?.downloaded_by || null;
  const downloadedAt = evaluation?.downloaded_at ? new Date(evaluation.downloaded_at).toLocaleString() : null;
  const comments = Array.isArray(evaluation?.comments) ? evaluation.comments : [];
  const downloads = Array.isArray(evaluation?.downloads) ? evaluation.downloads : [];

  const activeRubricConfig = RUBRIC_CONFIGS[category] || RUBRIC_CONFIGS.hackathon;
  const rubricSum = activeRubricConfig.reduce((acc, c) => acc + (rubric[c.key] ?? 20), 0);
  const hasScoreDiscrepancy = totalScore !== rubricSum;
  const downloadBtnLabel = isGithub
    ? 'Download Repository (.ZIP)'
    : isDirectDownload
    ? 'Download Submission Archive'
    : 'Open & Verify Submission Link';

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleCloseWithCheck();
        }
      }}
    >
      <div className="w-full max-w-2xl bg-white dark:bg-[#150709] h-full shadow-2xl border-l border-slate-200 dark:border-[#3D1418] flex flex-col overflow-hidden animate-in slide-in-from-right duration-300">
        {/* Drawer Header */}
        <div className="p-5 border-b border-slate-200 dark:border-[#3D1418] flex items-start justify-between bg-slate-50 dark:bg-[#1C0A0D]">
          <div className="space-y-1 pr-4">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-burgundy/10 text-burgundy dark:bg-burgundy/25 dark:text-[#E89BA5]">
                {category.toUpperCase()} REVIEW DESK
              </span>
              {isNextRound && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  Round 2 Shortlisted
                </span>
              )}
              {status === 'rejected' && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-700 flex items-center gap-1">
                  <XCircle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                  Rejected
                </span>
              )}
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-[#FAF6F3]">
              {targetTitle}
            </h3>
            {targetSubtitle && (
              <p className="text-xs text-slate-500 dark:text-slate-400">{targetSubtitle}</p>
            )}
          </div>

          <button
            type="button"
            onClick={handleCloseWithCheck}
            aria-label="Close review desk"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-[#250D11] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback alert */}
        {feedbackMsg && (
          <div
            className={`px-5 py-2.5 text-xs flex items-center gap-2 border-b ${
              feedbackMsg.isError
                ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-900'
                : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{feedbackMsg.text}</span>
          </div>
        )}

        {/* Drawer Body - Scrollable */}
        {isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-slate-400 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-burgundy dark:text-[#E89BA5]" />
            <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Loading evaluation records & rubric...
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            {/* SECTION 1: Submission Asset & Verification Audit */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-[#3D1418] bg-slate-50/50 dark:bg-[#1C0A0D]/50 space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                <span className="uppercase tracking-wider">Submission Asset & Verification</span>
                {isDownloaded ? (
                  <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-300 dark:border-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Downloaded & Verified
                  </span>
                ) : (
                  <span className="text-[11px] font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    Pending Verification
                  </span>
                )}
              </div>

              {/* Source code preview if provided */}
              {targetCode && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                      Submitted Source Code Solution
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(targetCode);
                        setCopiedCode(true);
                        setTimeout(() => setCopiedCode(false), 2000);
                      }}
                      className="px-2 py-1 text-[11px] font-medium rounded border border-slate-300 dark:border-[#3D1418] bg-white dark:bg-[#150709] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#250D11] flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      {copiedCode ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedCode ? 'Copied' : 'Copy Code'}</span>
                    </button>
                  </div>
                  <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200 dark:border-[#3D1418] bg-slate-900 text-slate-100 p-3 font-mono text-[11px] leading-relaxed select-text">
                    <pre className="whitespace-pre-wrap break-all">{targetCode}</pre>
                  </div>
                </div>
              )}

              {targetUrl ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-mono bg-white dark:bg-[#150709] border border-slate-200 dark:border-[#3D1418] p-2.5 rounded-lg truncate">
                    <span className="text-slate-400 shrink-0">URL:</span>
                    <a
                      href={targetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-burgundy dark:text-[#E89BA5] hover:underline truncate"
                    >
                      {targetUrl}
                    </a>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleDownloadAndTick}
                      disabled={isDownloading}
                      className="px-3.5 py-1.5 rounded-lg bg-burgundy hover:bg-burgundy-deep text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {isDownloading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : isDirectDownload ? (
                        <Download className="w-3.5 h-3.5" />
                      ) : (
                        <ExternalLink className="w-3.5 h-3.5" />
                      )}
                      <span>{downloadBtnLabel}</span>
                    </button>

                    <a
                      href={targetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-[#3D1418] bg-white dark:bg-[#150709] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#250D11] text-xs font-medium flex items-center gap-1.5 transition-colors"
                    >
                      <span>Open in New Tab</span>
                      <ExternalLink className="w-3 h-3 text-slate-400" />
                    </a>
                  </div>

                  {/* Audit details */}
                  {isDownloaded && downloadedBy && (
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                      First verified by <strong>{downloadedBy}</strong> on {downloadedAt}.
                      {downloads.length > 1 && (
                        <span className="block mt-0.5 text-slate-400">
                          Total inspections by evaluators: {downloads.length} times.
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ) : !targetCode ? (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>No submission file, repository, or code provided for this entry.</span>
                </div>
              ) : null}
            </div>

            {/* SECTION 2: Decision & Next Round / Reject Actions */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-[#3D1418] bg-white dark:bg-[#150709] space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-[#FAF6F3] uppercase tracking-wider">
                    Deliberation & Decision
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Advance this entry to Round 2, mark as rejected, or update evaluation stage.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleToggleReject}
                    disabled={isSaving}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer ${
                      status === 'rejected'
                        ? 'bg-rose-600 hover:bg-rose-700 text-white border border-rose-500'
                        : 'bg-white hover:bg-rose-50 hover:text-rose-700 dark:bg-[#200B0E] dark:hover:bg-rose-950/40 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-[#3D1418]'
                    }`}
                    title={status === 'rejected' ? 'Undo rejection (restore to review)' : 'Reject submission'}
                  >
                    <XCircle className={`w-3.5 h-3.5 ${status === 'rejected' ? 'text-white' : 'text-slate-400'}`} />
                    <span>{status === 'rejected' ? 'Rejected' : 'Reject'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleToggleNextRound}
                    disabled={isSaving}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer ${
                      isNextRound
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-500'
                        : 'bg-slate-100 hover:bg-slate-200 dark:bg-[#200B0E] dark:hover:bg-[#2A0E12] text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-[#3D1418]'
                    }`}
                    title="Toggle Round 2 Shortlist"
                  >
                    <CheckCircle2 className={`w-3.5 h-3.5 ${isNextRound ? 'text-white' : 'text-slate-400'}`} />
                    <span>{isNextRound ? 'Round 2 Shortlisted' : 'Mark Next Round'}</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Evaluation State
                  </label>
                  <select
                    value={status}
                    onChange={(e) => {
                      const nextStatus = e.target.value as EvaluationStatus;
                      setIsDirty(true);
                      setStatus(nextStatus);
                      if (nextStatus === 'rejected') {
                        setIsNextRound(false);
                      } else if (nextStatus === 'shortlisted') {
                        setIsNextRound(true);
                      }
                    }}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 dark:border-[#3D1418] bg-white dark:bg-[#1C0A0D] text-slate-900 dark:text-[#FAF6F3] rounded-lg focus:outline-none focus:ring-1 focus:ring-burgundy"
                  >
                    <option value="pending">Pending Review</option>
                    <option value="under_review">Under Review</option>
                    <option value="shortlisted">Shortlisted for Round 2</option>
                    <option value="needs_discussion">Needs Deliberation</option>
                    <option value="finalist">Finalist</option>
                    <option value="winner">Winner / Top Rank</option>
                    <option value="rejected">Rejected (Not Recommended)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Overall Score (0-100)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={totalScore}
                      onChange={(e) => {
                        setIsDirty(true);
                        setTotalScore(Number(e.target.value));
                      }}
                      className="w-full px-2.5 py-1.5 text-xs font-mono font-bold border border-slate-300 dark:border-[#3D1418] bg-white dark:bg-[#1C0A0D] text-slate-900 dark:text-[#FAF6F3] rounded-lg focus:outline-none focus:ring-1 focus:ring-burgundy"
                    />
                    <span className="text-xs text-slate-400">/100</span>
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 3: Detailed Rubric (Dynamic per Category) */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-[#3D1418] bg-white dark:bg-[#150709] space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#3D1418] pb-2">
                <div className="flex items-center gap-2">
                  <Sliders className="w-3.5 h-3.5 text-burgundy dark:text-[#E89BA5]" />
                  <span className="text-xs font-bold text-slate-900 dark:text-[#FAF6F3] uppercase tracking-wider">
                    Evaluation Rubric Breakdown
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {hasScoreDiscrepancy && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsDirty(true);
                        setTotalScore(rubricSum);
                      }}
                      className="px-2 py-0.5 text-[10px] font-bold rounded bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800 hover:bg-amber-200 transition-colors cursor-pointer"
                      title="Sync overall score with rubric breakdown sum"
                    >
                      Sync ({rubricSum} pts)
                    </button>
                  )}
                  <span className="text-xs font-mono font-bold text-burgundy dark:text-[#E89BA5]">
                    Rubric Sum: {rubricSum} pts
                  </span>
                </div>
              </div>

              {hasScoreDiscrepancy && (
                <div className="px-3 py-1.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-[11px] text-amber-800 dark:text-amber-300 flex items-center justify-between">
                  <span>
                    Overall Score ({totalScore}) differs from rubric sum ({rubricSum}). Click Sync or adjust sliders.
                  </span>
                </div>
              )}

              <div className="space-y-3">
                {activeRubricConfig.map((item) => {
                  const val = rubric[item.key] ?? 20;
                  return (
                    <div key={item.key} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <div>
                          <span className="font-medium text-slate-700 dark:text-slate-300">
                            {item.label}
                          </span>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400">
                            {item.description}
                          </p>
                        </div>
                        <span className="font-mono font-bold text-slate-900 dark:text-[#FAF6F3] ml-2 shrink-0">
                          {val}/{item.max}
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max={item.max}
                        value={val}
                        onChange={(e) => updateRubricField(item.key, Number(e.target.value))}
                        className="w-full accent-burgundy cursor-pointer"
                      />
                    </div>
                  );
                })}
              </div>

              <div className="pt-2 flex items-center justify-between">
                <div>
                  {isDirty ? (
                    <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse inline-block" />
                      Unsaved rubric modifications
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Check className="w-3 h-3 text-emerald-500" />
                      Rubric state saved
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleSaveEvaluation}
                  disabled={isSaving}
                  className="px-4 py-2 rounded-lg bg-burgundy hover:bg-burgundy-deep text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
                  <span>Save Evaluation & Score</span>
                </button>
              </div>
            </div>

            {/* SECTION 4: Multi-Admin Collaborative Notes & Discussion */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-[#3D1418] bg-slate-50/60 dark:bg-[#1C0A0D]/60 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-[#FAF6F3] uppercase tracking-wider">
                <MessageSquare className="w-3.5 h-3.5 text-burgundy dark:text-[#E89BA5]" />
                <span>Evaluator Notes & Observations ({comments.length})</span>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {comments.length === 0 ? (
                  <div className="text-center py-4 text-xs text-slate-400 italic">
                    No evaluation notes added yet. Evaluators can share comments below.
                  </div>
                ) : (
                  comments.map((c) => (
                    <div
                      key={c.id}
                      className="p-3 bg-white dark:bg-[#150709] rounded-lg border border-slate-200 dark:border-[#3D1418] space-y-1 text-xs"
                    >
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span className="font-bold text-slate-800 dark:text-slate-200">{c.evaluator_name}</span>
                        <span>{new Date(c.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{c.text}</p>
                    </div>
                  ))
                )}
              </div>

              {/* Comment Form */}
              <form onSubmit={handlePostComment} className="flex gap-2 pt-1">
                <input
                  type="text"
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                  placeholder="Add a judge observation or decision note..."
                  className="flex-1 px-3 py-2 text-xs border border-slate-300 dark:border-[#3D1418] bg-white dark:bg-[#150709] text-slate-900 dark:text-[#FAF6F3] rounded-lg focus:outline-none focus:ring-1 focus:ring-burgundy"
                />
                <button
                  type="submit"
                  disabled={isPostingComment || !commentInput.trim()}
                  className="px-3 py-2 bg-slate-900 dark:bg-[#250D11] hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isPostingComment ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>Post</span>
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Drawer Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-[#3D1418] bg-slate-50 dark:bg-[#1C0A0D] flex items-center justify-between text-xs text-slate-500">
          <span>Target ID: <span className="font-mono">{targetId.slice(0, 13)}...</span></span>
          <button
            type="button"
            onClick={handleCloseWithCheck}
            className="px-4 py-1.5 bg-slate-200 dark:bg-[#250D11] hover:bg-slate-300 dark:hover:bg-[#321217] text-slate-700 dark:text-slate-200 font-semibold rounded-lg transition-colors cursor-pointer"
          >
            Close Desk
          </button>
        </div>
      </div>
    </div>
  );
}
