'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  BookOpen,
  Users,
  ChevronRight,
  ChevronDown,
  Award,
  PlayCircle,
  LogOut,
  Shield,
  Menu,
  X,
  Calendar,
  Code2,
  Terminal,
  Lock,
  Trophy,
  CheckCircle2,
  ArrowLeft,
} from 'lucide-react';
import clsx from 'clsx';
import { supabase } from '@/lib/supabase';
import { CURRICULUM_SESSIONS } from '@/data/learning/curriculum';
import { DAILY_COMPETITIONS } from '@/data/learning/competitions';
import { useCurriculumSessions } from '@/hooks/use-curriculum-sessions';
import { useQuizzes } from '@/hooks/use-quizzes';
import { useCodingChallengeStatus } from '@/hooks/use-coding-challenge';
import { CertificateModal } from '@/components/learning/CertificateModal';
import { useLearningSidebar } from '@/components/learning/LearningShell';

const DAYS = [
  { id: 1, label: 'Day 1: Foundations' },
  { id: 2, label: 'Day 2: Architecture & Optics' },
  { id: 3, label: 'Day 3: QML & Cyber Security' },
];

export function LearningSidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const sidebarContext = useLearningSidebar();
  const handleToggleCollapse = React.useCallback(() => {
    if (sidebarContext?.toggleCollapse) {
      sidebarContext.toggleCollapse();
    } else if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('qff_toggle_sidebar'));
    }
  }, [sidebarContext]);
  const { sessions } = useCurriculumSessions();
  const { quizzes } = useQuizzes();
  const { isLocked: isChallengeLocked } = useCodingChallengeStatus();

  const isHackathon = pathname === '/learning/hackathon';
  const isCodingChallenge = pathname === '/learning/qiskit-challenge' || pathname?.startsWith('/learning/qiskit-challenge');
  const activeChallengeDay = searchParams?.get('challenge');

  // Detect active session from pathname (e.g. /learning/session/session-3 or /learning/session/session-3/quiz)
  const sessionPathMatch = pathname?.match(/^\/learning\/session\/([^/]+)/);
  const activeSessionId = sessionPathMatch?.[1] || null;
  const activeSessionObj = activeSessionId
    ? sessions.find((s) => s.id === activeSessionId) || CURRICULUM_SESSIONS.find((s) => s.id === activeSessionId)
    : null;

  // Determine which days are open in the accordion. Open Day 1, Day 2, and Day 3 by default.
  const activeDay = activeSessionObj?.day ?? null;
  const initialOpenDays = activeDay ? Array.from(new Set([1, 2, 3, activeDay])) : [1, 2, 3];

  const [openDays, setOpenDays] = useState<number[]>(initialOpenDays);
  const [isChallengesOpen, setIsChallengesOpen] = useState<boolean>(true);

  // Keep newly active day open without collapsing already opened days
  useEffect(() => {
    if (activeDay) {
      setOpenDays((prev) => (prev.includes(activeDay) ? prev : [...prev, activeDay]));
    }
  }, [activeDay]);

  // Keep challenges open when a challenge is active
  useEffect(() => {
    if (activeChallengeDay) {
      setIsChallengesOpen(true);
    }
  }, [activeChallengeDay]);

  const toggleDay = (dayId: number) => {
    setOpenDays((prev) =>
      prev.includes(dayId) ? prev.filter((id) => id !== dayId) : [...prev, dayId]
    );
  };
  const [session, setSession] = useState<any>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [progress, setProgress] = useState<Record<string, any>>({});
  const [competitions, setCompetitions] = useState<Record<string, any>>({});
  const [isCertModalOpen, setIsCertModalOpen] = useState(false);

  const fetchSidebarProgress = React.useCallback(async () => {
    try {
      const [progRes, compRes] = await Promise.all([
        fetch('/api/learning/progress', { cache: 'no-store' }),
        fetch('/api/learning/competition-submit', { cache: 'no-store' }),
      ]);
      if (progRes.ok) {
        const progData = await progRes.json();
        if (progData?.progress) {
          setProgress(progData.progress);
        }
      }
      if (compRes.ok) {
        const compData = await compRes.json();
        if (compData?.submissions) {
          setCompetitions(compData.submissions);
        }
      }
    } catch (err) {
      // Ignore unauthenticated or transient errors in sidebar
    }
  }, []);

  // Auto-close mobile drawer on route change and refresh completion badges
  useEffect(() => {
    setIsMobileMenuOpen(false);
    if (session) {
      fetchSidebarProgress();
    }
  }, [pathname, session, fetchSidebarProgress]);

  useEffect(() => {
    const handleProgressUpdate = () => {
      fetchSidebarProgress();
    };
    window.addEventListener('learning-progress-updated', handleProgressUpdate);
    return () => {
      window.removeEventListener('learning-progress-updated', handleProgressUpdate);
    };
  }, [fetchSidebarProgress]);

  useEffect(() => {
    const handleOpenCertModal = () => {
      setIsCertModalOpen(true);
    };
    window.addEventListener('open-certificate-modal', handleOpenCertModal);
    return () => {
      window.removeEventListener('open-certificate-modal', handleOpenCertModal);
    };
  }, []);

  const fetchSession = React.useCallback(async () => {
    try {
      const { getClientSession } = await import('@/lib/session-client');
      const data = await getClientSession();
      if (data.session) {
        setSession(data.session);
      } else {
        setSession(null);
      }
    } catch (err) {
      console.error('Error fetching session in sidebar:', err);
    }
  }, []);

  useEffect(() => {
    fetchSession();

    // Listen for custom auth events from AuthGate or anywhere in the app
    const handleAuthChange = (e: any) => {
      if (e?.detail) {
        setSession(e.detail);
      } else {
        fetchSession();
      }
    };

    window.addEventListener('qff_auth_change', handleAuthChange);

    // Also subscribe to Supabase auth events
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, sbSession) => {
      if (
        event === 'SIGNED_IN' ||
        event === 'INITIAL_SESSION' ||
        event === 'TOKEN_REFRESHED'
      ) {
        fetchSession();
      } else if (event === 'SIGNED_OUT') {
        setSession(null);
      }
    });

    return () => {
      window.removeEventListener('qff_auth_change', handleAuthChange);
      subscription.unsubscribe();
    };
  }, [fetchSession]);

  async function handleSignOut() {
    try {
      await fetch('/api/auth/session', { method: 'DELETE' });
      await supabase.auth.signOut();
      setSession(null);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('qff_auth_change', { detail: null }));
      }
      window.location.reload();
    } catch (err) {
      console.error('Error signing out:', err);
    }
  }

  // Active Label for mobile header
  let activeMobileTitle = 'Curriculum Hub';
  if (isCodingChallenge) {
    activeMobileTitle = 'Python Coding Challenge in Qiskit';
  } else if (isHackathon) {
    activeMobileTitle = 'Hackathon Workspace';
  } else if (activeSessionObj) {
    activeMobileTitle = `Day ${activeSessionObj.day} · Session ${activeSessionObj.sessionNumber}`;
  } else if (activeChallengeDay) {
    const comp = DAILY_COMPETITIONS[Number(activeChallengeDay)];
    activeMobileTitle = comp ? comp.title : `Day ${activeChallengeDay} Challenge`;
  }

  // Calculate overall sidebar completion stats & certificate eligibility
  const totalCurriculumSessions = sessions.length || CURRICULUM_SESSIONS.length || 5;
  const completedVideosCount = sessions.filter((s) => progress[s.id]?.videoCompleted).length;
  const passedQuizzesCount = sessions.filter((s) => progress[s.id]?.quizPassed).length;
  const isCertEligible =
    totalCurriculumSessions > 0 &&
    completedVideosCount === totalCurriculumSessions &&
    passedQuizzesCount === totalCurriculumSessions;

  const completedSessionsCount = sessions.filter(
    (s) => progress[s.id]?.videoCompleted && progress[s.id]?.quizPassed
  ).length;
  const submittedChallengesCount = Object.keys(competitions).length;
  const totalTasks = totalCurriculumSessions + 3;
  const completedTasks = completedSessionsCount + submittedChallengesCount;
  const overallProgressPercent = Math.min(100, Math.round((completedTasks / totalTasks) * 100));

  // Navigation Items Renderer
  const renderNavContent = () => (
    <>
      {/* Section 1: Learning Phase Header */}
      <div className="pt-1 pb-2 px-1">
        <div className="flex items-center gap-2 px-2">
          <span className="font-mono text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">
            Learning Phase
          </span>
          <div className="flex-1 h-px bg-slate-200/80 dark:bg-[#3D1418]" />
        </div>
      </div>

      <Link
        href="/learning"
        onClick={() => setIsMobileMenuOpen(false)}
        className={clsx(
          'w-full flex items-center justify-between px-3 py-2 mb-2 rounded-lg transition-colors text-xs sm:text-sm font-semibold group',
          pathname === '/learning' && !activeChallengeDay
            ? 'bg-burgundy/10 text-burgundy dark:bg-burgundy/20 dark:text-[#E89BA5] border border-burgundy/20 dark:border-burgundy/40'
            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1C0A0D] border border-transparent'
        )}
      >
        <div className="flex items-center gap-2">
          <Calendar
            className={clsx(
              'w-3.5 h-3.5 shrink-0',
              pathname === '/learning' && !activeChallengeDay
                ? 'text-burgundy dark:text-[#E89BA5]'
                : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200'
            )}
          />
          <span>Overview & Programme</span>
        </div>
        <ChevronRight
          className={clsx(
            'w-3.5 h-3.5 shrink-0',
            pathname === '/learning' && !activeChallengeDay
              ? 'text-burgundy dark:text-[#E89BA5]'
              : 'text-slate-300 dark:text-slate-600'
          )}
        />
      </Link>

      {DAYS.map((day) => {
        const isDayOpen = openDays.includes(day.id);
        const daySessions = sessions.filter((s) => s.day === day.id);
        const completedDaySessions = daySessions.filter(
          (s) => progress[s.id]?.videoCompleted && progress[s.id]?.quizPassed
        ).length;
        const isDayFullyDone =
          daySessions.length > 0 && completedDaySessions === daySessions.length;

        return (
          <div key={day.id} className="mb-2">
            <button
              onClick={() => toggleDay(day.id)}
              className={clsx(
                'w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors text-xs sm:text-sm font-semibold group cursor-pointer border',
                isDayOpen
                  ? 'bg-slate-100/90 dark:bg-[#1C0A0D] text-slate-900 dark:text-[#FAF6F3] border-slate-200/60 dark:border-[#3D1418]'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1C0A0D] border-transparent'
              )}
            >
              <div className="flex items-center gap-2 min-w-0 pr-2">
                {isDayFullyDone ? (
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <BookOpen
                    className={clsx(
                      'w-3.5 h-3.5 shrink-0',
                      isDayOpen
                        ? 'text-burgundy dark:text-[#E89BA5]'
                        : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200'
                    )}
                  />
                )}
                <span className="truncate">{day.label}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {daySessions.length > 0 && session && (
                  <span
                    className={clsx(
                      'font-mono text-[9px] px-1.5 py-0.5 rounded font-bold',
                      isDayFullyDone
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/60'
                        : 'text-slate-400 dark:text-slate-500'
                    )}
                  >
                    {completedDaySessions}/{daySessions.length}
                  </span>
                )}
                {isDayOpen ? (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 shrink-0" />
                )}
              </div>
            </button>

            {/* Expandable Sessions & Challenge */}
            {isDayOpen && (
              <div className="mt-1.5 ml-3 pl-3 border-l-2 border-slate-200/80 dark:border-[#3D1418] space-y-2.5 py-1">
                {daySessions.map((sessionItem) => {
                  const isJustSessionActive =
                    pathname === `/learning/session/${sessionItem.id}`;
                  const isQuizActive =
                    pathname === `/learning/session/${sessionItem.id}/quiz`;
                  const isQuizLocked = Boolean(quizzes[sessionItem.id]?.isLocked);
                  const sessionProg = progress[sessionItem.id];
                  const isVideoDone = Boolean(sessionProg?.videoCompleted);
                  const isQuizDone = Boolean(sessionProg?.quizPassed);

                  return (
                    <div
                      key={sessionItem.id}
                      className="flex flex-col group/session pb-2 border-b border-slate-200/50 dark:border-[#2D1014] last:border-b-0 last:pb-0"
                    >
                      {/* Session Item */}
                      <Link
                        href={`/learning/session/${sessionItem.id}`}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className={clsx(
                          'group flex items-start gap-2 px-2.5 py-1.5 rounded-lg text-xs sm:text-sm transition-colors',
                          isJustSessionActive
                            ? 'bg-burgundy/10 text-burgundy dark:bg-burgundy/25 dark:text-[#E89BA5] font-semibold'
                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1C0A0D] hover:text-slate-900 dark:hover:text-[#FAF6F3] font-medium'
                        )}
                      >
                        {isVideoDone && !isJustSessionActive ? (
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <PlayCircle
                            className={clsx(
                              'w-3.5 h-3.5 shrink-0 mt-0.5',
                              isJustSessionActive
                                ? 'text-burgundy dark:text-[#E89BA5]'
                                : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200'
                            )}
                          />
                        )}
                        <span className="leading-snug break-words flex-1 text-xs">
                          {sessionItem.title}
                        </span>
                        {sessionItem.isLive ? (
                          <span className="ml-auto shrink-0 px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-950/80 text-red-600 dark:text-red-400 font-mono text-[9px] font-bold uppercase tracking-wider animate-pulse">
                            LIVE
                          </span>
                        ) : isVideoDone && isJustSessionActive ? (
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
                        ) : null}
                      </Link>

                      {/* Concept Quiz Sub-item with connected branch line */}
                      <div className="relative pl-5 ml-2 mt-1 mb-0.5">
                        {/* L-shaped curved branch line */}
                        <div
                          aria-hidden="true"
                          className={clsx(
                            'absolute left-0 top-0 bottom-1/2 w-3.5 border-b-2 border-l-2 rounded-bl-[6px] transition-colors pointer-events-none',
                            isQuizActive
                              ? 'border-burgundy dark:border-[#E89BA5]'
                              : isQuizDone
                              ? 'border-emerald-400/70 dark:border-emerald-700/70'
                              : 'border-slate-300 dark:border-[#4A171E] group-hover/session:border-slate-400 dark:group-hover/session:border-[#6B222B]'
                          )}
                        />

                        <Link
                          href={`/learning/session/${sessionItem.id}/quiz`}
                          onClick={() => setIsMobileMenuOpen(false)}
                          className={clsx(
                            'group/quiz flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-all border shadow-2xs',
                            isQuizActive
                              ? 'bg-burgundy/10 text-burgundy dark:bg-burgundy/25 dark:text-[#E89BA5] border-burgundy/30 dark:border-burgundy/50 font-semibold ring-1 ring-burgundy/20'
                              : 'bg-white/90 dark:bg-[#18080B] text-slate-700 dark:text-slate-300 border-slate-200/90 dark:border-[#3D1418] hover:bg-slate-50 dark:hover:bg-[#220B0F] hover:border-slate-300 dark:hover:border-[#521C23]'
                          )}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {isQuizDone && !isQuizActive ? (
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                            ) : (
                              <Award
                                className={clsx(
                                  'w-3.5 h-3.5 shrink-0',
                                  isQuizActive
                                    ? 'text-burgundy dark:text-[#E89BA5]'
                                    : isQuizLocked
                                    ? 'text-amber-500'
                                    : 'text-amber-600 dark:text-amber-400'
                                )}
                              />
                            )}
                            <span className="font-semibold text-[11px] sm:text-xs truncate">
                              Concept Quiz
                            </span>
                          </div>

                          {isQuizLocked ? (
                            <span className="shrink-0 px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 font-mono text-[9px] font-semibold tracking-wide flex items-center gap-1">
                              <Lock className="w-2.5 h-2.5" />
                              Soon
                            </span>
                          ) : isQuizDone ? (
                            <span className="shrink-0 px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80 font-mono text-[9px] font-bold tracking-wide">
                              {sessionProg?.quizScore ?? 100}%
                            </span>
                          ) : (
                            <span
                              className={clsx(
                                'shrink-0 px-1.5 py-0.5 rounded font-mono text-[9px] font-bold uppercase tracking-wider',
                                isQuizActive
                                  ? 'bg-burgundy text-white'
                                  : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20'
                              )}
                            >
                              Quiz
                            </span>
                          )}
                        </Link>
                      </div>
                    </div>
                  );
                })}

              </div>
            )}
          </div>
        );
      })}

      {/* Section 2: Challenges Category */}
      <div className="pt-3 pb-1 px-1">
        <div className="flex items-center gap-2 px-2">
          <span className="font-mono text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">
            Challenges
          </span>
          <div className="flex-1 h-px bg-slate-200/80 dark:bg-[#3D1418]" />
        </div>
      </div>

      {/* Flagship: Python Coding Challenge in Qiskit */}
      <Link
        href="/learning/qiskit-challenge"
        onClick={() => setIsMobileMenuOpen(false)}
        className={clsx(
          'w-full flex items-center justify-between px-3 py-2 mb-2 rounded-lg transition-colors text-xs sm:text-sm font-semibold group',
          isCodingChallenge
            ? 'bg-burgundy/10 text-burgundy dark:bg-burgundy/20 dark:text-[#E89BA5] border border-burgundy/20 dark:border-burgundy/40 shadow-xs'
            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1C0A0D] border border-transparent'
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Terminal
            className={clsx(
              'w-3.5 h-3.5 shrink-0',
              isCodingChallenge
                ? 'text-burgundy dark:text-[#E89BA5]'
                : isChallengeLocked
                ? 'text-amber-500'
                : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200'
            )}
          />
          <div className="flex flex-col min-w-0">
            <span className="truncate">Python Coding Challenge in Qiskit</span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono font-normal">
              9 Problems · 100 pts
            </span>
          </div>
        </div>
        {isChallengeLocked ? (
          <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border border-amber-500/20 flex items-center gap-1">
            <Lock className="w-2.5 h-2.5" />
            Soon
          </span>
        ) : (
          <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            ACTIVE
          </span>
        )}
      </Link>

      <div className="mb-2">
        {/* Expandable Challenges Accordion Button */}
        <button
          type="button"
          onClick={() => setIsChallengesOpen((prev) => !prev)}
          className={clsx(
            'w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors text-xs sm:text-sm font-semibold group cursor-pointer border',
            isChallengesOpen
              ? 'bg-slate-100/90 dark:bg-[#1C0A0D] text-slate-900 dark:text-[#FAF6F3] border-slate-200/60 dark:border-[#3D1418]'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1C0A0D] border-transparent'
          )}
        >
          <div className="flex items-center gap-2 min-w-0 pr-2">
            {Object.keys(competitions).length === 3 ? (
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <Trophy
                className={clsx(
                  'w-3.5 h-3.5 shrink-0',
                  isChallengesOpen
                    ? 'text-burgundy dark:text-[#E89BA5]'
                    : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200'
                )}
              />
            )}
            <span className="truncate">Daily Competitions</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span
              className={clsx(
                'font-mono text-[9px] px-1.5 py-0.5 rounded font-bold border',
                Object.keys(competitions).length === 3
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/70'
                  : 'bg-burgundy/10 dark:bg-burgundy/25 text-burgundy dark:text-[#E89BA5] border-burgundy/20 dark:border-burgundy/40'
              )}
            >
              {session ? `${Object.keys(competitions).length}/3 Done` : '3 Tasks'}
            </span>
            {isChallengesOpen ? (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 shrink-0" />
            )}
          </div>
        </button>

        {/* Expandable Challenges Sub-items */}
        {isChallengesOpen && (
          <div className="mt-1.5 ml-3 pl-3 border-l-2 border-slate-200/80 dark:border-[#3D1418] space-y-1.5 py-1">
            {Object.values(DAILY_COMPETITIONS).map((comp) => {
              const isCompActive =
                pathname === '/learning' && activeChallengeDay === String(comp.day);
              const isCompSubmitted = Boolean(competitions[comp.type]);
              return (
                <Link
                  key={comp.day}
                  href={`/learning?challenge=${comp.day}`}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={clsx(
                    'group flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-xs transition-colors border shadow-2xs',
                    isCompActive
                      ? 'bg-burgundy/10 text-burgundy dark:bg-burgundy/25 dark:text-[#E89BA5] border-burgundy/30 dark:border-burgundy/50 font-semibold ring-1 ring-burgundy/20'
                      : 'bg-white/80 dark:bg-[#150709] text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-[#3D1418] hover:bg-slate-50 dark:hover:bg-[#1F0A0E] hover:border-slate-300 dark:hover:border-[#521C23]'
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {isCompSubmitted && !isCompActive ? (
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <Award
                        className={clsx(
                          'w-3.5 h-3.5 shrink-0',
                          isCompActive
                            ? 'text-burgundy dark:text-[#E89BA5]'
                            : 'text-burgundy/80 dark:text-[#E89BA5]/80 group-hover:text-burgundy'
                        )}
                      />
                    )}
                    <span className="truncate text-xs leading-snug font-semibold text-slate-800 dark:text-[#FAF6F3]">
                      {comp.title}
                    </span>
                  </div>
                  {isCompSubmitted ? (
                    <span className="shrink-0 px-1.5 py-0.5 rounded font-mono text-[9px] font-bold uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80">
                      Done
                    </span>
                  ) : (
                    <span
                      className={clsx(
                        'shrink-0 px-1.5 py-0.5 rounded font-mono text-[9px] font-bold uppercase tracking-wider',
                        isCompActive
                          ? 'bg-burgundy text-white'
                          : 'bg-burgundy/10 text-burgundy dark:bg-burgundy/20 dark:text-[#E89BA5] border border-burgundy/20 dark:border-burgundy/40'
                      )}
                    >
                      14 Oct
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Section 3: Certification */}
      <div className="pt-3 pb-1 px-1">
        <div className="flex items-center gap-2 px-2">
          <span className="font-mono text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">
            Certification
          </span>
          <div className="flex-1 h-px bg-slate-200/80 dark:bg-[#3D1418]" />
        </div>
      </div>

      <button
        type="button"
        onClick={() => {
          setIsCertModalOpen(true);
          setIsMobileMenuOpen(false);
        }}
        className={clsx(
          'w-full flex items-center justify-between px-3 py-2 mb-2 rounded-lg transition-colors text-xs sm:text-sm font-semibold group cursor-pointer border text-left',
          isCertEligible
            ? 'bg-burgundy/10 text-burgundy dark:bg-burgundy/20 dark:text-[#E89BA5] border-burgundy/20 dark:border-burgundy/40 shadow-xs'
            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1C0A0D] border-transparent'
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Award
            className={clsx(
              'w-3.5 h-3.5 shrink-0',
              isCertEligible
                ? 'text-burgundy dark:text-[#E89BA5]'
                : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200'
            )}
          />
          <div className="flex flex-col min-w-0">
            <span className="truncate">Masterclass Certificate</span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono font-normal">
              {isCertEligible
                ? 'Eligible · Payment & Verification'
                : `${completedVideosCount}/${totalCurriculumSessions} Videos · ${passedQuizzesCount}/${totalCurriculumSessions} Quizzes`}
            </span>
          </div>
        </div>
        {isCertEligible ? (
          <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/70">
            UNLOCKED
          </span>
        ) : (
          <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold bg-slate-100 dark:bg-[#250D11] text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-[#3D1418] flex items-center gap-1">
            <Lock className="w-2.5 h-2.5" />
            LOCKED
          </span>
        )}
      </button>

      {/* Section 4: Hackathon Phase Header */}
      <div className="pt-3 pb-2 px-1">
        <div className="flex items-center gap-2 px-2">
          <span className="font-mono text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">
            Hackathon Phase
          </span>
          <div className="flex-1 h-px bg-slate-200/80 dark:bg-[#3D1418]" />
        </div>
      </div>

      <Link
        href="/learning/hackathon"
        onClick={() => setIsMobileMenuOpen(false)}
        className={clsx(
          'w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors text-xs sm:text-sm font-semibold group',
          isHackathon
            ? 'bg-burgundy/10 text-burgundy dark:bg-burgundy/20 dark:text-[#E89BA5] border border-burgundy/20 dark:border-burgundy/40'
            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1C0A0D] border border-transparent'
        )}
      >
        <div className="flex items-center gap-2">
          <Users
            className={clsx(
              'w-3.5 h-3.5 shrink-0',
              isHackathon
                ? 'text-burgundy dark:text-[#E89BA5]'
                : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200'
            )}
          />
          <span>Hackathon Workspace</span>
        </div>
        <ChevronRight
          className={clsx(
            'w-3.5 h-3.5 shrink-0',
            isHackathon
              ? 'text-burgundy dark:text-[#E89BA5]'
              : 'text-slate-300 dark:text-slate-600'
          )}
        />
      </Link>
    </>
  );

  // User Profile Renderer
  const renderUserProfile = () => {
    if (!session) return null;
    return (
      <div className="p-3 border-t border-slate-100 dark:border-[#3D1418] bg-slate-50 dark:bg-[#1C0A0D] shrink-0 mt-auto">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-col min-w-0">
            <span
              title={session.fullName || session.email}
              className="font-semibold text-xs text-slate-800 dark:text-[#FAF6F3] truncate"
            >
              {session.fullName || session.email}
            </span>
            <span
              title={session.email}
              className="font-mono text-[10px] text-slate-500 dark:text-slate-400 truncate"
            >
              {session.email}
            </span>
          </div>

          <div className="flex items-center gap-1.5 pt-1.5 border-t border-slate-200/60 dark:border-[#3D1418]">
            {session.isAdmin && (
              <Link
                href="/learning/admin"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-md bg-burgundy/10 text-burgundy dark:bg-burgundy/20 dark:text-[#E89BA5] hover:bg-burgundy/20 transition-colors font-mono text-[10px] font-semibold uppercase tracking-wider"
              >
                <Shield className="w-3 h-3" />
                Admin
              </Link>
            )}
            <button
              onClick={handleSignOut}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-md border border-slate-200 dark:border-[#3D1418] text-slate-600 dark:text-slate-300 hover:bg-red-50 dark:hover:bg-rose-950/40 hover:text-red-700 dark:hover:text-rose-300 hover:border-red-200 transition-colors font-mono text-[10px] font-semibold uppercase tracking-wider cursor-pointer"
            >
              <LogOut className="w-3 h-3" />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* ─────────────────────────────────────────────────────────────
          1. MOBILE VIEW (< md): Sleek Sticky Header & Dropdown Drawer
         ───────────────────────────────────────────────────────────── */}
      <div className="md:hidden w-full border-b border-slate-200 dark:border-[#3D1418] bg-white dark:bg-[#150709] z-40 sticky top-[76px] sm:top-[82px]">
        <div className="px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-burgundy/10 text-burgundy dark:bg-burgundy/20 dark:text-[#E89BA5] uppercase tracking-wider shrink-0">
              Curriculum
            </span>
            <span className="text-xs font-semibold text-slate-800 dark:text-[#FAF6F3] truncate">
              {activeMobileTitle}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsMobileMenuOpen((prev) => !prev)}
            aria-expanded={isMobileMenuOpen}
            aria-label="Toggle Curriculum Menu"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-[#3D1418] bg-slate-50 dark:bg-[#1C0A0D] text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
          >
            {isMobileMenuOpen ? (
              <>
                <X className="w-3.5 h-3.5 text-burgundy dark:text-[#E89BA5]" />
                <span>Close</span>
              </>
            ) : (
              <>
                <Menu className="w-3.5 h-3.5 text-burgundy dark:text-[#E89BA5]" />
                <span>Menu</span>
              </>
            )}
          </button>
        </div>

        {/* Mobile Dropdown Drawer */}
        {isMobileMenuOpen && (
          <div className="border-t border-slate-200 dark:border-[#3D1418] bg-white dark:bg-[#150709] shadow-xl max-h-[75vh] flex flex-col overflow-hidden animate-in slide-in-from-top-2 duration-150">
            <div className="p-3 border-b border-slate-100 dark:border-[#3D1418] flex items-center justify-between">
              <Link
                href="/"
                onClick={() => setIsMobileMenuOpen(false)}
                className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:text-burgundy dark:hover:text-[#E89BA5] transition-colors"
              >
                <ArrowLeft className="w-3 h-3" />
                <span>Main Site</span>
              </Link>
              <Link
                href="/learning"
                onClick={() => setIsMobileMenuOpen(false)}
                className="text-xs font-mono font-semibold text-burgundy dark:text-[#E89BA5] hover:underline"
              >
                Overview
              </Link>
            </div>

            <nav className="flex-1 overflow-y-auto p-3 space-y-1">
              {renderNavContent()}
            </nav>

            {renderUserProfile()}
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. DESKTOP VIEW (>= md): Classic Smooth Sticky Left Sidebar
         ───────────────────────────────────────────────────────────── */}
      <div
        className="hidden md:flex md:flex-col h-full bg-white dark:bg-[#150709] overflow-hidden relative"
        data-lenis-prevent="true"
        style={{ overscrollBehavior: 'contain' }}
      >
        {/* Header section */}
        <div className="p-4 border-b border-slate-100 dark:border-[#3D1418] bg-white dark:bg-[#150709] shrink-0 z-10">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <button
                type="button"
                onClick={handleToggleCollapse}
                title="Collapse Curriculum Sidebar (Ctrl+B)"
                aria-label="Collapse Curriculum Sidebar"
                className="p-1 -ml-1 rounded-md text-slate-500 hover:text-burgundy dark:text-slate-400 dark:hover:text-[#E89BA5] hover:bg-slate-100 dark:hover:bg-[#1C0A0D] transition-colors cursor-pointer flex items-center justify-center shrink-0 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-burgundy/40"
              >
                <Menu className="w-4 h-4 group-hover:scale-110 transition-transform" />
              </button>
              <span className="font-mono px-2 py-0.5 rounded bg-burgundy/10 text-burgundy dark:bg-burgundy/20 dark:text-[#E89BA5] font-semibold text-[10px] uppercase tracking-[0.2em] truncate">
                Curriculum
              </span>
            </div>
            <Link
              href="/"
              className="inline-flex items-center gap-1 font-mono text-[10px] font-semibold text-slate-400 dark:text-slate-500 hover:text-burgundy dark:hover:text-[#E89BA5] transition-colors shrink-0"
              title="Return to Main Event Website"
            >
              <ArrowLeft className="w-3 h-3" />
              <span>Main Site</span>
            </Link>
          </div>
          <h2 className="font-serif text-lg font-bold text-slate-900 dark:text-[#FAF6F3] tracking-tight">
            Masterclass 2026
          </h2>

          {session && (
            <div className="mt-2.5 space-y-1">
              <div className="flex items-center justify-between font-mono text-[10px]">
                <span className="text-slate-500 dark:text-slate-400">
                  Progress ({completedTasks}/{totalTasks})
                </span>
                <span className="font-bold text-burgundy dark:text-[#E89BA5]">
                  {overallProgressPercent}%
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 dark:bg-[#250D11] rounded-full overflow-hidden">
                <div
                  className="h-full bg-burgundy dark:bg-[#E89BA5] rounded-full transition-all duration-500"
                  style={{ width: `${overallProgressPercent}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Nav items - strictly scrollable options container */}
        <nav
          data-lenis-prevent="true"
          onWheel={(e) => {
            e.stopPropagation();
          }}
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 space-y-1 focus:outline-none [scrollbar-width:thin] [scrollbar-color:#CBD5E1_transparent] dark:[scrollbar-color:#3D1418_transparent]"
          style={{ overscrollBehavior: 'contain' }}
        >
          {renderNavContent()}
        </nav>

        {/* User Profile & Sign Out at the bottom */}
        {renderUserProfile()}
      </div>

      <CertificateModal
        isOpen={isCertModalOpen}
        onClose={() => setIsCertModalOpen(false)}
        userEmail={session?.email || ''}
        userName={session?.fullName || session?.email || 'Candidate'}
      />
    </>
  );
}
