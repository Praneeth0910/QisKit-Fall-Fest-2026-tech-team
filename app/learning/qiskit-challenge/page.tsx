'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { AuthGate } from '@/components/learning/AuthGate';
import { QiskitPlayground } from '@/components/learning/QiskitPlayground';
import { QISKIT_CHALLENGES, CodingChallenge } from '@/data/qiskit/challenges';
import {
  Clock,
  Trophy,
  CheckCircle2,
  Circle,
  Play,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  List,
  FileText,
  History,
  Tag,
  Code2,
  X,
  AlertCircle,
  ExternalLink,
  Award,
  ArrowLeft,
  Loader2,
  Info,
  Lock,
  PlayCircle,
  Shield,
  Maximize2,
  Minimize2,
  Menu,
} from 'lucide-react';
import { useLearningSidebar } from '@/components/learning/LearningShell';

interface LeaderboardEntry {
  rank: number;
  displayName: string;
  totalScore: number;
  maxPossibleScore: number;
  solvedCount: number;
  totalProblems: number;
  lastSubmissionTime: string | null;
}

interface UserSubmissionSummary {
  id: string;
  challengeId: string;
  status: string;
  score: number;
  maxScore: number;
  passedTests: number;
  totalTests: number;
  executionTimeMs: number;
  submittedAt: string;
  errorMessage?: string | null;
}

function renderInlineFormatted(text: string): React.ReactNode {
  if (!text) return null;

  // Split by inline code `...`, bold **...**, and inline math $...$
  const regex = /(`[^`]+`|\*\*[^*]+\*\*|\$[^$]+\$)/g;
  const parts = text.split(regex);

  return parts.map((part, idx) => {
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return (
        <code
          key={idx}
          className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-[#250D11] text-burgundy dark:text-[#E89BA5] font-mono text-xs font-semibold border border-slate-200/60 dark:border-[#3D1418]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      return (
        <strong key={idx} className="font-semibold text-slate-900 dark:text-[#FAF6F3]">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('$') && part.endsWith('$') && part.length >= 2) {
      return (
        <code
          key={idx}
          className="px-1 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 font-mono text-xs font-medium border border-amber-500/20"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <span key={idx}>{part}</span>;
  });
}

function FormattedProblemDescription({ description }: { description: string }) {
  if (!description) return null;

  const lines = description.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    // 1. Formula Block: $$ ... $$
    if (trimmed.startsWith('$$')) {
      let formula = '';
      if (trimmed.endsWith('$$') && trimmed.length > 2) {
        formula = trimmed.slice(2, -2).trim();
        i++;
      } else {
        formula = trimmed.slice(2);
        i++;
        while (i < lines.length && !lines[i].trim().endsWith('$$')) {
          formula += '\n' + lines[i];
          i++;
        }
        if (i < lines.length) {
          formula += '\n' + lines[i].trim().replace(/\$\$$/, '');
          i++;
        }
        formula = formula.trim();
      }

      elements.push(
        <div
          key={`formula-${i}`}
          className="my-3 py-3 px-4 rounded-xl bg-slate-900 text-amber-300 dark:bg-[#1A0A0D] dark:text-[#E89BA5] border border-slate-800 dark:border-[#3D1418] shadow-inner text-center font-mono text-sm sm:text-base font-semibold tracking-wide overflow-x-auto"
        >
          {formula}
        </div>
      );
      continue;
    }

    // 2. Callout / Alert Block: lines starting with >
    if (trimmed.startsWith('>')) {
      const calloutLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        calloutLines.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      elements.push(
        <div
          key={`callout-${i}`}
          className="my-3 p-3.5 rounded-xl border border-amber-500/25 bg-amber-500/5 dark:bg-[#201108] dark:border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs sm:text-sm flex items-start gap-2.5"
        >
          <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <div className="space-y-1.5 flex-1">
            {calloutLines.map((cLine, cIdx) => (
              <p key={cIdx} className="leading-relaxed">
                {renderInlineFormatted(cLine)}
              </p>
            ))}
          </div>
        </div>
      );
      continue;
    }

    // 3. Bullet list item: lines starting with - or *
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const indent = rawLine.search(/\S/);
      const isNested = indent >= 2;
      const content = trimmed.replace(/^[-*]\s+/, '');

      elements.push(
        <div
          key={`bullet-${i}`}
          className={clsx(
            'flex items-start gap-2 text-xs sm:text-sm my-1',
            isNested ? 'ml-5 text-slate-600 dark:text-slate-400' : 'text-slate-700 dark:text-slate-300'
          )}
        >
          <span
            className={clsx(
              'shrink-0 rounded-full mt-2',
              isNested
                ? 'w-1 h-1 bg-slate-400 dark:bg-slate-500'
                : 'w-1.5 h-1.5 bg-burgundy dark:bg-[#E89BA5]'
            )}
          />
          <span className="flex-1 leading-relaxed">{renderInlineFormatted(content)}</span>
        </div>
      );
      i++;
      continue;
    }

    // 4. Ordered list item: 1. , 2. , etc.
    const olMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (olMatch) {
      const num = olMatch[1];
      const content = olMatch[2];
      const indent = rawLine.search(/\S/);
      const isNested = indent >= 2;

      elements.push(
        <div
          key={`ol-${i}`}
          className={clsx(
            'flex items-start gap-2.5 text-xs sm:text-sm my-1.5',
            isNested && 'ml-5'
          )}
        >
          <span className="shrink-0 w-5 h-5 rounded-full bg-slate-100 dark:bg-[#250D11] border border-slate-200 dark:border-[#3D1418] text-[11px] font-mono font-bold flex items-center justify-center text-burgundy dark:text-[#E89BA5] mt-0.5">
            {num}
          </span>
          <span className="flex-1 leading-relaxed text-slate-700 dark:text-slate-300">
            {renderInlineFormatted(content)}
          </span>
        </div>
      );
      i++;
      continue;
    }

    // 5. Standard paragraph
    elements.push(
      <p key={`p-${i}`} className="leading-relaxed text-slate-700 dark:text-slate-300 text-xs sm:text-sm my-1.5">
        {renderInlineFormatted(trimmed)}
      </p>
    );
    i++;
  }

  return <div className="space-y-1">{elements}</div>;
}

export default function QiskitChallengePage() {
  return (
    <AuthGate>
      <QiskitChallengeWorkspace />
    </AuthGate>
  );
}

function QiskitChallengeWorkspace() {
  const sidebarContext = useLearningSidebar();
  const [selectedProblemId, setSelectedProblemId] = useState<string>('P1');
  const [challenges, setChallenges] = useState<any[]>(QISKIT_CHALLENGES);
  const [sessionUser, setSessionUser] = useState<{ email: string; fullName: string; isAdmin?: boolean } | null>(null);
  const [competitionConfig, setCompetitionConfig] = useState<any>(null);
  const [timeRemaining, setTimeRemaining] = useState<string>('--:--:--');
  const [isLocked, setIsLocked] = useState<boolean>(true);
  const [isAdminUser, setIsAdminUser] = useState<boolean>(false);
  const [isLoadingStatus, setIsLoadingStatus] = useState<boolean>(true);
  
  // UI Tabs & Modals
  const [leftTab, setLeftTab] = useState<'description' | 'submissions'>('description');
  const [isProblemListOpen, setIsProblemListOpen] = useState<boolean>(false);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState<boolean>(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState<boolean>(false);

  // Submissions for current problem
  const [problemSubmissions, setProblemSubmissions] = useState<UserSubmissionSummary[]>([]);
  const [isLoadingSubmissions, setIsLoadingSubmissions] = useState<boolean>(false);

  // 1. Fetch current user session
  useEffect(() => {
    document.title = 'Python Coding Challenge in Qiskit | Qiskit Fall Fest 2026';
  }, []);

  useEffect(() => {
    async function loadUser() {
      try {
        const res = await fetch('/api/auth/session');
        const data = await res.json();
        if (data?.session) {
          setSessionUser({
            email: data.session.email,
            fullName: data.session.fullName || data.session.email,
            isAdmin: Boolean(data.session.isAdmin),
          });
          if (data.session.isAdmin) {
            setIsAdminUser(true);
          }
        }
      } catch (e) {
        console.error('Failed to load session:', e);
      }
    }
    loadUser();
  }, []);

  // 2. Fetch challenge state & server-authoritative config
  const refreshChallenges = useCallback(async () => {
    try {
      const res = await fetch('/api/qiskit/challenges', { cache: 'no-store' });
      const data = await res.json();
      if (data?.success) {
        setChallenges(data.challenges || []);
        setCompetitionConfig(data.config);
        setIsLocked(Boolean(data.isLocked ?? data.config?.is_locked ?? true));
        if (data.isAdmin !== undefined) {
          setIsAdminUser(Boolean(data.isAdmin));
        }
      }
    } catch (e) {
      console.warn('Failed to load challenge metadata:', e);
    } finally {
      setIsLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    refreshChallenges();
  }, [refreshChallenges]);

  // 3. Fetch submissions for selected problem
  const loadSubmissions = useCallback(async (pId: string) => {
    setIsLoadingSubmissions(true);
    try {
      const res = await fetch(`/api/qiskit/submissions?problemId=${pId}`, { cache: 'no-store' });
      const data = await res.json();
      if (data?.success && Array.isArray(data.submissions)) {
        setProblemSubmissions(data.submissions);
      }
    } catch (e) {
      console.error('Failed to load problem submissions:', e);
    } finally {
      setIsLoadingSubmissions(false);
    }
  }, []);

  useEffect(() => {
    loadSubmissions(selectedProblemId);
  }, [selectedProblemId, loadSubmissions]);



  // 5. Server-authoritative timer countdown
  useEffect(() => {
    if (!competitionConfig?.end_time) return;

    const target = new Date(competitionConfig.end_time).getTime();

    const interval = setInterval(() => {
      const now = Date.now();
      const diff = target - now;

      if (diff <= 0) {
        setTimeRemaining('COMPLETED');
        clearInterval(interval);
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);

      const pad = (n: number) => n.toString().padStart(2, '0');
      setTimeRemaining(`${pad(hours)}h ${pad(mins)}m ${pad(secs)}s`);
    }, 1000);

    return () => clearInterval(interval);
  }, [competitionConfig]);

  // 6. Fetch Leaderboard
  const fetchLeaderboard = async () => {
    setIsLoadingLeaderboard(true);
    try {
      const res = await fetch('/api/qiskit/leaderboard', { cache: 'no-store' });
      const data = await res.json();
      if (data.success && data.leaderboard) {
        setLeaderboard(data.leaderboard);
      }
    } catch (e) {
      console.error('Failed to load leaderboard:', e);
    } finally {
      setIsLoadingLeaderboard(false);
    }
  };

  const selectedChallenge: CodingChallenge =
    challenges.find((c) => c.id === selectedProblemId) || challenges[0] || QISKIT_CHALLENGES[0];

  const currentIndex = challenges.findIndex((c) => c.id === selectedProblemId);
  const prevProblem = currentIndex > 0 ? challenges[currentIndex - 1] : null;
  const nextProblem = currentIndex < challenges.length - 1 ? challenges[currentIndex + 1] : null;

  const totalEarnedPoints = challenges.reduce(
    (acc, curr) => acc + (curr.userBestScore || 0),
    0
  );
  const solvedCount = challenges.filter((c) => c.userState === 'solved').length;

  // Fullscreen management
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const challengeContainerRef = useRef<HTMLDivElement>(null);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      if (challengeContainerRef.current?.requestFullscreen) {
        challengeContainerRef.current.requestFullscreen().catch(() => {
          setIsFullscreen(true);
        });
      } else {
        setIsFullscreen((prev) => !prev);
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {
          setIsFullscreen(false);
        });
      } else {
        setIsFullscreen(false);
      }
    }
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    const handleCustomToggle = () => {
      toggleFullscreen();
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    window.addEventListener('qiskit:toggle-fullscreen', handleCustomToggle);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('qiskit:toggle-fullscreen', handleCustomToggle);
    };
  }, [toggleFullscreen]);

  // Split pane adjuster state (in percentage, default 50%)
  const [splitRatio, setSplitRatio] = useState<number>(50);
  const [isResizing, setIsResizing] = useState<boolean>(false);
  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [isDesktop, setIsDesktop] = useState<boolean>(false);
  const splitContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMounted(true);
    const checkDesktop = () => setIsDesktop(window.innerWidth >= 768);
    checkDesktop();
    window.addEventListener('resize', checkDesktop);

    try {
      const saved = localStorage.getItem('qff_challenge_split_ratio');
      if (saved) {
        const parsed = parseFloat(saved);
        if (!isNaN(parsed) && parsed >= 20 && parsed <= 80) {
          setSplitRatio(parsed);
        }
      }
    } catch {}

    return () => window.removeEventListener('resize', checkDesktop);
  }, []);

  // Handle Drag Resizing between Problem Statement & Editor
  const handleSplitMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!splitContainerRef.current) return;
      const rect = splitContainerRef.current.getBoundingClientRect();
      const newRatio = ((moveEvent.clientX - rect.left) / rect.width) * 100;
      // Clamp between 20% and 80%
      const clamped = Math.min(Math.max(newRatio, 20), 80);
      setSplitRatio(clamped);
    };

    const onMouseUp = () => {
      setIsResizing(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);

      setSplitRatio((finalRatio) => {
        try {
          localStorage.setItem('qff_challenge_split_ratio', finalRatio.toFixed(1));
        } catch {}
        return finalRatio;
      });

      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 50);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, []);

  // Reset to 50/50 on double click
  const handleSplitDoubleClick = useCallback(() => {
    setSplitRatio(50);
    try {
      localStorage.setItem('qff_challenge_split_ratio', '50');
    } catch {}
  }, []);

  // Sync cursor & user-select styles while dragging
  useEffect(() => {
    if (isResizing) {
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  // If Challenge is locked and user is NOT an admin: Render Coming Soon Screen
  if (!isLoadingStatus && isLocked && !isAdminUser) {
    return (
      <div className="min-h-screen bg-slate-50/60 dark:bg-[#100405] pb-16 font-sans">
        {/* Navigation Breadcrumb Bar */}
        <div className="bg-white dark:bg-[#150709] border-b border-slate-200 dark:border-[#3D1418]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex flex-wrap items-center justify-between gap-2">
            <Link
              href="/learning"
              className="font-mono text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-burgundy dark:hover:text-[#E89BA5] flex items-center gap-1.5 transition-colors uppercase tracking-wider"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Learning Hub
            </Link>

            <div className="flex items-center gap-2 font-mono text-xs">
              <span className="text-slate-500 dark:text-slate-400">Competitive Arena</span>
              <span className="text-slate-300 dark:text-slate-600">/</span>
              <span className="font-bold text-amber-600 dark:text-amber-400">Challenge Locked</span>
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-6 sm:pt-12 font-sans">
          <div className="bg-white dark:bg-[#150709] rounded-2xl shadow-sm border border-slate-200 dark:border-[#3D1418] overflow-hidden text-center p-6 sm:p-10 space-y-6">
            {/* Lock Icon */}
            <div className="relative mx-auto w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-amber-500/10 dark:bg-amber-500/20 animate-ping opacity-60" />
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/80 flex items-center justify-center text-amber-600 dark:text-amber-400 shadow-sm relative z-10">
                <Lock className="w-8 h-8 sm:w-10 sm:h-10" />
              </div>
            </div>

            {/* Title & Badge */}
            <div className="space-y-2.5">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950/70 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 font-mono text-xs font-semibold uppercase tracking-wider">
                <Clock className="w-3.5 h-3.5" />
                Coming Soon · Arena Locked
              </div>
              <h1 className="font-serif text-2xl sm:text-3xl font-bold text-slate-900 dark:text-[#FAF6F3] tracking-tight">
                Python Coding Challenge in Qiskit
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-sans max-w-lg mx-auto">
                The Python Coding Challenge in Qiskit arena is currently locked by the organizers.
                Problem statements, the Monaco code editor, and the quantum test-suite judge will unlock at the scheduled launch time.
              </p>
            </div>

            {/* Arena Highlights */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left max-w-lg mx-auto">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#1C0A0D] border border-slate-200 dark:border-[#3D1418] space-y-1">
                <span className="font-mono text-[10px] uppercase font-bold text-burgundy dark:text-[#E89BA5]">
                  9 Quantum Problems
                </span>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  State prep, Bernstein-Vazirani, ZNE noise mitigation, QAOA & V2 Primitives.
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#1C0A0D] border border-slate-200 dark:border-[#3D1418] space-y-1">
                <span className="font-mono text-[10px] uppercase font-bold text-burgundy dark:text-[#E89BA5]">
                  Real-Time Quantum Judge
                </span>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Built-in basis gate transpilation, unit testing, and instant score evaluation.
                </p>
              </div>
            </div>

            {/* Preparation Guidance */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#1C0A0D] border border-slate-200 dark:border-[#3D1418] max-w-lg mx-auto text-left space-y-2 text-xs text-slate-600 dark:text-slate-300">
              <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200 font-sans">
                <Info className="w-4 h-4 text-burgundy dark:text-[#E89BA5]" />
                How to prepare while waiting:
              </div>
              <ul className="list-disc list-inside space-y-1.5 pl-1 leading-relaxed">
                <li>Review the 6 Online Masterclass lectures and concept quizzes</li>
                <li>Familiarize yourself with Qiskit 1.2+ syntax and QuantumCircuit methods</li>
                <li>Practice state vector calculations, Pauli expectation values, and Bell states</li>
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <Link
                href="/learning"
                className="w-full sm:w-auto px-5 py-2.5 bg-burgundy hover:bg-burgundy-deep text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <PlayCircle className="w-4 h-4" />
                Go to Curriculum Masterclasses
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={challengeContainerRef}
      data-lenis-prevent="true"
      className={clsx(
        'bg-slate-100 dark:bg-[#0D0406] text-slate-900 dark:text-[#FAF6F3] font-sans flex flex-col native-cursor',
        isFullscreen
          ? 'fixed inset-0 z-50 h-screen w-screen overflow-hidden'
          : 'h-full min-h-0 overflow-hidden flex-1'
      )}
    >
      {/* Admin Testing Mode Notice Banner */}
      {isLocked && isAdminUser && (
        <div className="bg-amber-500/15 border-b border-amber-500/40 px-3 sm:px-6 py-2 flex items-center justify-between text-xs text-amber-900 dark:text-amber-200 font-sans z-50 shrink-0">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 animate-pulse" />
            <span>
              <strong>Admin Testing Mode:</strong> Python Coding Challenge in Qiskit is currently <strong>LOCKED</strong> for participants (students see Coming Soon). You have administrator bypass access to test problems, run Python/TypeScript code, and verify submissions.
            </span>
          </div>
          <Link
            href="/learning/admin"
            className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-950 dark:text-amber-100 font-semibold transition-colors shrink-0 ml-3 text-[11px] flex items-center gap-1"
          >
            <span>Admin Console</span>
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          1. LEETCODE TOP NAVIGATION BAR
         ───────────────────────────────────────────────────────────── */}
      <header className="shrink-0 z-40 bg-white dark:bg-[#160608] border-b border-slate-200 dark:border-[#3D1418] px-3 sm:px-5 py-2 flex items-center justify-between gap-2.5 sm:gap-3 shadow-xs">
        {/* Left: Hub Link, Problem List Modal Button, Prev/Next Navigation, Active Problem */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          {sidebarContext?.isCollapsed && (
            <button
              type="button"
              onClick={sidebarContext.toggleCollapse}
              title="Expand Curriculum Sidebar (Ctrl+B)"
              aria-label="Expand Curriculum Sidebar"
              className="hidden md:inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border border-slate-200 dark:border-[#3D1418] bg-slate-50 dark:bg-[#1C0A0D] text-slate-700 dark:text-slate-200 hover:text-burgundy dark:hover:text-[#E89BA5] transition-colors text-xs font-semibold shrink-0 cursor-pointer"
            >
              <Menu className="w-3.5 h-3.5 text-burgundy dark:text-[#E89BA5]" />
              <span>Curriculum</span>
            </button>
          )}

          <Link
            href="/learning"
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-burgundy dark:hover:text-[#E89BA5] transition-colors shrink-0"
            title="Return to Curriculum Hub"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden md:inline">Learning Hub</span>
          </Link>

          <span className="text-slate-300 dark:text-slate-700 hidden sm:inline shrink-0">•</span>

          {/* Problem List Drawer Button */}
          <button
            onClick={() => setIsProblemListOpen(true)}
            type="button"
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-[#3D1418] bg-slate-50 dark:bg-[#1C0A0D] hover:bg-slate-100 dark:hover:bg-[#250D11] text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
            title="Open Problem Set Catalog"
          >
            <List className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Problems</span>
            <span className="font-mono text-[10px] text-slate-400">({currentIndex + 1}/9)</span>
          </button>

          {/* Prev / Next Problem Switchers */}
          <div className="flex items-center bg-slate-100 dark:bg-[#1C0A0D] border border-slate-200 dark:border-[#3D1418] rounded-lg p-0.5 shrink-0">
            <button
              onClick={() => prevProblem && setSelectedProblemId(prevProblem.id)}
              disabled={!prevProblem}
              type="button"
              title={prevProblem ? `Previous: ${prevProblem.title}` : 'First problem'}
              className="p-1 rounded text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-[#250D11] disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => nextProblem && setSelectedProblemId(nextProblem.id)}
              disabled={!nextProblem}
              type="button"
              title={nextProblem ? `Next: ${nextProblem.title}` : 'Last problem'}
              className="p-1 rounded text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-[#250D11] disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Active Problem Title */}
          <div
            className="flex items-center gap-1.5 min-w-0 truncate"
            title={`${selectedChallenge.problemCode}. ${selectedChallenge.title}`}
          >
            <span className="font-mono font-bold text-xs text-burgundy dark:text-[#E89BA5] shrink-0">
              {selectedChallenge.problemCode}.
            </span>
            <span className="font-semibold text-xs text-slate-800 dark:text-slate-100 truncate">
              {selectedChallenge.title}
            </span>
          </div>
        </div>

        {/* Right: Score, Leaderboard Toggle, and Fullscreen */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 ml-auto">
          {/* User Score Pill */}
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-burgundy/10 dark:bg-burgundy/25 border border-burgundy/30 shrink-0">
            <Award className="w-3.5 h-3.5 text-burgundy dark:text-[#E89BA5]" />
            <span className="font-mono text-xs font-bold text-burgundy dark:text-[#FAF6F3]">
              {totalEarnedPoints}/100 pts ({solvedCount}/9)
            </span>
          </div>

          {/* Leaderboard Button */}
          <button
            onClick={() => {
              setIsLeaderboardOpen(true);
              fetchLeaderboard();
            }}
            type="button"
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-[#3D1418] hover:bg-slate-50 dark:hover:bg-[#1C0A0D] text-slate-700 dark:text-slate-300 font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs shrink-0"
            title="View Live Leaderboard"
          >
            <Trophy className="w-3.5 h-3.5 text-amber-500" />
            <span className="hidden sm:inline">Leaderboard</span>
          </button>

          {/* Full Screen Toggle Button */}
          <button
            onClick={toggleFullscreen}
            type="button"
            title={isFullscreen ? 'Exit Full Screen (Esc)' : 'Enter Full Screen'}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-[#3D1418] hover:bg-slate-50 dark:hover:bg-[#1C0A0D] text-slate-700 dark:text-slate-300 font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs shrink-0"
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="w-3.5 h-3.5 text-burgundy dark:text-[#E89BA5]" />
                <span className="hidden sm:inline">Exit Full Screen</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5 text-burgundy dark:text-[#E89BA5]" />
                <span className="hidden sm:inline">Full Screen</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* ─────────────────────────────────────────────────────────────
          2. MAIN LEETCODE DUAL-PANE SPLIT WORKSPACE
         ───────────────────────────────────────────────────────────── */}
      <div
        ref={splitContainerRef}
        className={clsx(
          'flex-1 min-h-0 p-2 sm:p-2.5 pb-2.5 sm:pb-3 flex flex-col md:flex-row items-stretch gap-0 max-w-[1920px] mx-auto w-full overflow-hidden relative',
          isResizing && 'select-none pointer-events-auto'
        )}
      >
        {/* Full-screen transparent drag overlay when resizing */}
        {isResizing && (
          <div
            className="fixed inset-0 z-50 cursor-col-resize select-none bg-transparent"
            style={{ cursor: 'col-resize' }}
          />
        )}

        {/* ───────────────────────────────────────────────────────────
            LEFT PANE: PROBLEM STATEMENT & SUBMISSIONS TABS
           ─────────────────────────────────────────────────────────── */}
        <div
          data-lenis-prevent="true"
          style={{
            width: isMounted && isDesktop ? `calc(${splitRatio}% - 8px)` : undefined,
          }}
          className={clsx(
            'flex flex-col h-full min-h-0 bg-white dark:bg-[#150709] border border-slate-200 dark:border-[#3D1418] rounded-xl overflow-hidden shadow-xs shrink-0 w-full md:w-auto',
            isResizing && 'pointer-events-none select-none'
          )}
        >
          {/* Left Pane Navigation Tabs */}
          <div className="shrink-0 flex items-center px-4 bg-slate-50 dark:bg-[#1C0A0D] border-b border-slate-200 dark:border-[#3D1418]">
            <button
              onClick={() => setLeftTab('description')}
              type="button"
              className={clsx(
                'py-2.5 px-3 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer',
                leftTab === 'description'
                  ? 'border-burgundy dark:border-[#E89BA5] text-burgundy dark:text-[#FAF6F3] font-semibold'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              )}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Description</span>
            </button>

            <button
              onClick={() => {
                setLeftTab('submissions');
                loadSubmissions(selectedProblemId);
              }}
              type="button"
              className={clsx(
                'py-2.5 px-3 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer',
                leftTab === 'submissions'
                  ? 'border-burgundy dark:border-[#E89BA5] text-burgundy dark:text-[#FAF6F3] font-semibold'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              )}
            >
              <History className="w-3.5 h-3.5" />
              <span>Submissions</span>
              {problemSubmissions.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-slate-200 dark:bg-[#2A0E12] text-slate-700 dark:text-slate-300">
                  {problemSubmissions.length}
                </span>
              )}
            </button>
          </div>

          {/* Left Pane Content Body */}
          <div data-lenis-prevent="true" className="flex-1 min-h-0 p-5 sm:p-6 pb-32 sm:pb-36 overflow-y-auto space-y-6 overscroll-contain">
            {leftTab === 'description' ? (
              <div className="space-y-6">
                {/* Title & Metadata Badges */}
                <div className="space-y-3 pb-4 border-b border-slate-100 dark:border-[#3D1418]">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-burgundy/10 text-burgundy dark:bg-burgundy/25 dark:text-[#E89BA5]">
                      {selectedChallenge.problemCode}
                    </span>
                    <h1 className="font-serif text-xl sm:text-2xl font-bold text-slate-900 dark:text-[#FAF6F3] tracking-tight">
                      {selectedChallenge.title}
                    </h1>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Difficulty Badge */}
                    <span
                      className={clsx(
                        'px-2.5 py-0.5 rounded-full text-xs font-semibold border',
                        selectedChallenge.difficulty === 'Easy'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                          : selectedChallenge.difficulty === 'Medium'
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                          : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30'
                      )}
                    >
                      {selectedChallenge.difficulty}
                    </span>

                    {/* Points Badge */}
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-slate-100 dark:bg-[#1C0A0D] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#3D1418]">
                      {selectedChallenge.points} Points
                    </span>

                    {/* Level Label */}
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-[#18080B]">
                      Level {selectedChallenge.level} · {selectedChallenge.levelLabel}
                    </span>
                  </div>

                  {/* Topic Tags */}
                  {selectedChallenge.tags && selectedChallenge.tags.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <Tag className="w-3 h-3 text-slate-400 shrink-0" />
                      {selectedChallenge.tags.map((t, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-100 dark:bg-[#1C0A0D] text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-[#3D1418]"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Problem Description Statement */}
                <FormattedProblemDescription description={selectedChallenge.description} />

                {/* Structured LeetCode Examples */}
                {selectedChallenge.examples && selectedChallenge.examples.length > 0 && (
                  <div className="space-y-4 pt-2">
                    <span className="font-mono text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                      Examples
                    </span>

                    <div className="space-y-3">
                      {selectedChallenge.examples.map((ex) => (
                        <div
                          key={ex.id}
                          className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#1C0A0D] border border-slate-200 dark:border-[#3D1418] text-xs font-mono space-y-1.5"
                        >
                          <div className="font-bold text-slate-800 dark:text-slate-200 font-sans text-xs">
                            Example {ex.id}:
                          </div>
                          <div className="space-y-1 bg-white dark:bg-[#150709] p-2.5 rounded-lg border border-slate-200/70 dark:border-[#3D1418]">
                            <div>
                              <span className="font-semibold text-slate-500">Input: </span>
                              <code className="text-burgundy dark:text-[#E89BA5] font-bold">
                                {ex.input}
                              </code>
                            </div>
                            <div>
                              <span className="font-semibold text-slate-500">Output: </span>
                              <code className="text-emerald-600 dark:text-emerald-400 font-bold">
                                {ex.output}
                              </code>
                            </div>
                            {ex.explanation && (
                              <div className="pt-1 text-[11px] text-slate-600 dark:text-slate-400 font-sans leading-relaxed border-t border-slate-100 dark:border-[#250D11] mt-1">
                                <span className="font-semibold text-slate-500">Explanation: </span>
                                {ex.explanation}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Constraints Section */}
                {selectedChallenge.constraints && selectedChallenge.constraints.length > 0 && (
                  <div className="space-y-3 pt-2">
                    <span className="font-mono text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                      Constraints & Requirements
                    </span>
                    <ul className="list-disc list-inside space-y-1.5 text-xs text-slate-700 dark:text-slate-300 font-mono bg-slate-50 dark:bg-[#1C0A0D] p-3.5 rounded-xl border border-slate-200 dark:border-[#3D1418]">
                      {selectedChallenge.constraints.map((c, i) => (
                        <li key={i} className="leading-relaxed">
                          <span className="text-slate-800 dark:text-slate-200">{renderInlineFormatted(c)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Function Signature Callout */}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#1C0A0D] border border-slate-200 dark:border-[#3D1418] space-y-1.5">
                  <div className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300 text-xs">
                    <Code2 className="w-3.5 h-3.5 text-burgundy dark:text-[#E89BA5]" />
                    <span>Evaluation Protocol</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                    The automated judge tests your required function signature: <code className="font-mono text-burgundy dark:text-[#E89BA5] font-bold">{selectedChallenge.functionName}</code>. Do not rename the function. Return circuits or values matching the specification.
                  </p>
                </div>
              </div>
            ) : (
              /* Submissions History Tab */
              <div className="space-y-4 pb-28 sm:pb-32">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-[#3D1418]">
                  <span className="font-mono text-xs font-bold uppercase tracking-wider text-slate-500">
                    Your Submission Records ({problemSubmissions.length})
                  </span>
                  <button
                    onClick={() => loadSubmissions(selectedProblemId)}
                    type="button"
                    className="text-xs text-burgundy dark:text-[#E89BA5] hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Refresh</span>
                  </button>
                </div>

                {isLoadingSubmissions ? (
                  <div className="py-12 text-center text-slate-400 text-xs font-mono">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-burgundy" />
                    Loading submission history...
                  </div>
                ) : problemSubmissions.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-xs font-mono space-y-2">
                    <p>No submissions recorded for this problem yet.</p>
                    <p className="text-[11px] text-slate-500">
                      Write your code in the editor, click <strong>Run Code</strong> to test against public cases, and click <strong>Submit</strong> to earn official points.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {problemSubmissions.map((sub) => {
                      const isFullScore = sub.score === selectedChallenge.points;
                      const isPartial = sub.score > 0 && !isFullScore;

                      return (
                        <div
                          key={sub.id}
                          className="p-3.5 rounded-xl border border-slate-200 dark:border-[#3D1418] bg-slate-50 dark:bg-[#1C0A0D] text-xs font-mono space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span
                                className={clsx(
                                  'font-bold text-xs px-2 py-0.5 rounded',
                                  isFullScore
                                    ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                                    : isPartial
                                    ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400'
                                    : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400'
                                )}
                              >
                                {isFullScore ? 'Accepted' : isPartial ? 'Partial Score' : 'Wrong Answer'}
                              </span>
                              <span className="text-slate-400 text-[11px]">
                                {sub.executionTimeMs} ms
                              </span>
                            </div>

                            <span className="font-bold text-slate-900 dark:text-[#FAF6F3]">
                              {sub.score} / {sub.maxScore} pts
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200/60 dark:border-[#2A0E12]">
                            <span>
                              Passed {sub.passedTests} of {sub.totalTests} tests
                            </span>
                            <span>{new Date(sub.submittedAt).toLocaleTimeString()}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ───────────────────────────────────────────────────────────
            LEETCODE VERTICAL SPLIT ADJUSTER / RESIZER HANDLE
           ─────────────────────────────────────────────────────────── */}
        <div
          onMouseDown={handleSplitMouseDown}
          onDoubleClick={handleSplitDoubleClick}
          role="separator"
          aria-orientation="vertical"
          aria-valuenow={splitRatio}
          aria-valuemin={20}
          aria-valuemax={80}
          title="Drag to resize problem and editor · Double-click to reset (50%)"
          className="hidden md:flex flex-col items-center justify-center w-4 h-full cursor-col-resize z-30 group select-none shrink-0 relative transition-colors -mx-1 px-1"
        >
          {/* Subtle background line on hover or drag */}
          <div
            className={clsx(
              'w-1 h-full rounded-full transition-colors',
              isResizing
                ? 'bg-burgundy dark:bg-[#E89BA5]'
                : 'bg-transparent group-hover:bg-burgundy/30 dark:group-hover:bg-[#E89BA5]/30'
            )}
          />
          {/* Centered visual grip handle */}
          <div
            className={clsx(
              'absolute top-1/2 -translate-y-1/2 w-1.5 h-10 rounded-full transition-all duration-150 flex flex-col items-center justify-center gap-1 shadow-xs',
              isResizing
                ? 'bg-burgundy dark:bg-[#E89BA5] scale-y-125 shadow-md'
                : 'bg-slate-300 dark:bg-[#3D1418] group-hover:bg-burgundy dark:group-hover:bg-[#E89BA5]'
            )}
          >
            <div className="w-0.5 h-0.5 rounded-full bg-white dark:bg-black/60" />
            <div className="w-0.5 h-0.5 rounded-full bg-white dark:bg-black/60" />
            <div className="w-0.5 h-0.5 rounded-full bg-white dark:bg-black/60" />
          </div>
        </div>

        {/* ───────────────────────────────────────────────────────────
            RIGHT PANE: MONACO CODE EDITOR & CONSOLE DRAWER
           ─────────────────────────────────────────────────────────── */}
        <div
          data-lenis-prevent="true"
          style={{
            width: isMounted && isDesktop ? `calc(${100 - splitRatio}% - 8px)` : undefined,
          }}
          className={clsx(
            'flex flex-col h-full min-h-0 overflow-hidden flex-1 min-w-0 w-full md:w-auto',
            isResizing && 'pointer-events-none select-none'
          )}
        >
          <QiskitPlayground
            challenge={selectedChallenge}
            userEmail={sessionUser?.email || ''}
            isFullscreen={isFullscreen}
            onToggleFullscreen={toggleFullscreen}
            onSubmissionSuccess={() => {
              refreshChallenges();
              loadSubmissions(selectedProblemId);
            }}
          />
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. PROBLEM LIST CATALOG MODAL
         ───────────────────────────────────────────────────────────── */}
      {isProblemListOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#150709] border border-slate-200 dark:border-[#3D1418] rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-[#3D1418] flex items-center justify-between bg-slate-50 dark:bg-[#1C0A0D]">
              <div className="flex items-center gap-2.5">
                <List className="w-5 h-5 text-burgundy dark:text-[#E89BA5]" />
                <div>
                  <h3 className="font-serif text-lg font-bold text-slate-900 dark:text-[#FAF6F3]">
                    Qiskit Problem Set (9 Problems)
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    Score: {totalEarnedPoints}/100 pts ({solvedCount}/9 Solved)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsProblemListOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#2A0E12] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 font-sans space-y-2">
              {challenges.map((prob) => {
                const isSelected = prob.id === selectedProblemId;
                const isSolved = prob.userState === 'solved';
                const isAttempted = prob.userState === 'attempted';

                return (
                  <button
                    key={prob.id}
                    onClick={() => {
                      setSelectedProblemId(prob.id);
                      setIsProblemListOpen(false);
                    }}
                    type="button"
                    className={clsx(
                      'w-full text-left p-3.5 rounded-xl border transition-all flex items-center justify-between group cursor-pointer',
                      isSelected
                        ? 'bg-burgundy/10 dark:bg-burgundy/25 border-burgundy/50 shadow-xs'
                        : 'bg-white dark:bg-[#1C0A0D] border-slate-200 dark:border-[#3D1418] hover:bg-slate-50 dark:hover:bg-[#250D11]'
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {isSolved ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      ) : isAttempted ? (
                        <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                      ) : (
                        <Circle className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0" />
                      )}

                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs text-slate-900 dark:text-[#FAF6F3]">
                            {prob.problemCode}
                          </span>
                          <span className="text-slate-300 dark:text-slate-700">•</span>
                          <span className="font-semibold text-xs text-slate-800 dark:text-slate-200 truncate">
                            {prob.title}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">
                          Level {prob.level} · {prob.difficulty}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span
                        className={clsx(
                          'px-2 py-0.5 rounded text-[10px] font-mono font-bold',
                          isSolved
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                            : 'bg-slate-100 dark:bg-[#250D11] text-slate-600 dark:text-slate-400'
                        )}
                      >
                        {prob.userBestScore ? `${prob.userBestScore}/${prob.points}` : `${prob.points} pts`}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          4. LEADERBOARD MODAL
         ───────────────────────────────────────────────────────────── */}
      {isLeaderboardOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#150709] border border-slate-200 dark:border-[#3D1418] rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-[#3D1418] flex items-center justify-between bg-slate-50 dark:bg-[#1C0A0D]">
              <div className="flex items-center gap-2.5">
                <Trophy className="w-5 h-5 text-amber-500" />
                <h3 className="font-serif text-lg font-bold text-slate-900 dark:text-[#FAF6F3]">
                  Python Coding Challenge in Qiskit Leaderboard
                </h3>
              </div>
              <button
                onClick={() => setIsLeaderboardOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#2A0E12] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto flex-1 font-sans">
              {isLoadingLeaderboard ? (
                <div className="py-12 text-center text-slate-400 text-xs font-mono">
                  Loading live participant rankings...
                </div>
              ) : leaderboard.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs font-mono">
                  No completed submissions recorded yet. Be the first to solve a problem!
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-12 px-3 py-1.5 font-mono text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-[#3D1418]">
                    <div className="col-span-2">Rank</div>
                    <div className="col-span-6">Participant</div>
                    <div className="col-span-2 text-center">Solved</div>
                    <div className="col-span-2 text-right">Score</div>
                  </div>

                  {leaderboard.map((entry) => (
                    <div
                      key={entry.rank}
                      className={clsx(
                        'grid grid-cols-12 items-center px-3 py-2.5 rounded-lg text-xs font-mono transition-colors',
                        entry.rank === 1
                          ? 'bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50'
                          : entry.rank <= 3
                          ? 'bg-slate-50 dark:bg-[#1C0A0D]'
                          : 'hover:bg-slate-50 dark:hover:bg-[#1C0A0D]'
                      )}
                    >
                      <div className="col-span-2 flex items-center gap-1.5 font-bold">
                        {entry.rank === 1 ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                            #1
                          </span>
                        ) : entry.rank === 2 ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-300/30 text-slate-600 dark:text-slate-300 border border-slate-400/30">
                            #2
                          </span>
                        ) : entry.rank === 3 ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-800/20 text-amber-700 dark:text-amber-400 border border-amber-700/30">
                            #3
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono text-xs">#{entry.rank}</span>
                        )}
                      </div>

                      <div className="col-span-6 font-semibold text-slate-800 dark:text-slate-200 truncate pr-2">
                        {entry.displayName}
                      </div>

                      <div className="col-span-2 text-center text-slate-500">
                        {entry.solvedCount}/9
                      </div>

                      <div className="col-span-2 text-right font-bold text-burgundy dark:text-[#E89BA5]">
                        {entry.totalScore} pts
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-slate-200 dark:border-[#3D1418] bg-slate-50 dark:bg-[#1C0A0D] flex items-center justify-between text-[11px] text-slate-400 font-mono">
              <span>Ranked by Score DESC, then earliest submission time.</span>
              <button
                onClick={fetchLeaderboard}
                className="text-burgundy dark:text-[#E89BA5] hover:underline cursor-pointer"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
