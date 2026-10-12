'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { AuthGate } from '@/components/learning/AuthGate';
import { CURRICULUM_SESSIONS } from '@/data/learning/curriculum';
import { SESSION_TRANSCRIPTS } from '@/data/learning/transcripts';
import { useCurriculumSession } from '@/hooks/use-curriculum-sessions';
import { useQuiz } from '@/hooks/use-quizzes';
import { trackLectureView } from '@/lib/analytics';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Award,
  Video,
  ChevronRight,
  ChevronDown,
  Lock,
  Play,
  BookOpen,
  Search,
  Copy,
  Check,
  Code2,
  ListVideo,
  RotateCcw,
  Download,
} from 'lucide-react';
import clsx from 'clsx';

export default function SessionPlayerPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  const { session: dynamicSession } = useCurriculumSession(sessionId);
  const baseSession = CURRICULUM_SESSIONS.find((s) => s.id === sessionId);
  const session = dynamicSession || baseSession;
  const { quiz, isLocked } = useQuiz(sessionId);
  const transcriptData = SESSION_TRANSCRIPTS[sessionId];
  const hasReferenceMaterial = Boolean(session?.lectureNotesUrl?.trim() || session?.slidesUrl?.trim());

  const videoContainerRef = useRef<HTMLDivElement>(null);
  const transcriptSectionRef = useRef<HTMLDivElement>(null);

  const [videoCompleted, setVideoCompleted] = useState(false);
  const [quizPassed, setQuizPassed] = useState(false);
  const [quizScore, setQuizScore] = useState(0);
  const [isLoadingProgress, setIsLoadingProgress] = useState(true);
  const [isMarkingVideo, setIsMarkingVideo] = useState(false);

  // Video timestamp & chapter jumper state
  const defaultStart = session?.defaultStartSeconds ?? baseSession?.defaultStartSeconds ?? 0;
  const [activeStartSeconds, setActiveStartSeconds] = useState<number>(defaultStart);
  const [shouldAutoplay, setShouldAutoplay] = useState<boolean>(false);

  // Transcript interactive state
  const [transcriptSearch, setTranscriptSearch] = useState<string>('');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [copiedSnippetId, setCopiedSnippetId] = useState<string | null>(null);

  useEffect(() => {
    const startSec = session?.defaultStartSeconds ?? baseSession?.defaultStartSeconds ?? 0;
    setActiveStartSeconds(startSec);
    setShouldAutoplay(false);
    setTranscriptSearch('');
    if (SESSION_TRANSCRIPTS[sessionId]?.sections) {
      const initialExpanded: Record<string, boolean> = {};
      SESSION_TRANSCRIPTS[sessionId].sections.forEach((sec) => {
        // Start collapsed for session-6 to avoid visual clutter since the PDF contains the primary mathematical material
        initialExpanded[sec.id] = sessionId !== 'session-6';
      });
      setExpandedSections(initialExpanded);
    }
  }, [sessionId, session?.defaultStartSeconds, baseSession?.defaultStartSeconds]);

  const fetchSessionProgress = React.useCallback(async () => {
    try {
      setIsLoadingProgress(true);
      const res = await fetch('/api/learning/progress', { cache: 'no-store' });
      const data = await res.json();
      if (data?.progress?.[sessionId]) {
        const s = data.progress[sessionId];
        setVideoCompleted(s.videoCompleted);
        setQuizPassed(s.quizPassed);
        setQuizScore(s.quizScore);
      }
    } catch (e) {
      console.error('Error fetching session progress:', e);
    } finally {
      setIsLoadingProgress(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (sessionId === 'session-2') {
      router.replace('/learning/session/session-1');
    }
  }, [sessionId, router]);

  useEffect(() => {
    fetchSessionProgress();
    if (session) {
      trackLectureView(sessionId, session.title);
    }
  }, [fetchSessionProgress, session, sessionId]);

  async function handleToggleVideoCompletion(targetCompleted: boolean) {
    if (isMarkingVideo) return;
    try {
      setIsMarkingVideo(true);
      const res = await fetch('/api/learning/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          action: targetCompleted ? 'mark_video' : 'unmark_video',
          completed: targetCompleted,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setVideoCompleted(targetCompleted);
        fetchSessionProgress();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('learning-progress-updated'));
        }
      }
    } catch (err) {
      console.error('Error updating video progress:', err);
    } finally {
      setIsMarkingVideo(false);
    }
  }

  function handleJumpToTimestamp(seconds: number) {
    setActiveStartSeconds(seconds);
    setShouldAutoplay(true);
    if (videoContainerRef.current) {
      videoContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  function toggleSection(secId: string) {
    setExpandedSections((prev) => ({
      ...prev,
      [secId]: !prev[secId],
    }));
  }

  function handleExpandAll(expand: boolean) {
    if (!transcriptData) return;
    const next: Record<string, boolean> = {};
    transcriptData.sections.forEach((s) => {
      next[s.id] = expand;
    });
    setExpandedSections(next);
  }

  async function handleCopyCode(secId: string, code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedSnippetId(secId);
      setTimeout(() => {
        setCopiedSnippetId((prev) => (prev === secId ? null : prev));
      }, 2000);
    } catch (_) {}
  }

  if (!session) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center p-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-[#FAF6F3]">Session not found</h2>
        <Link href="/learning" className="mt-2 text-xs text-burgundy dark:text-[#E89BA5] font-semibold hover:underline">
          Return to Learning Hub
        </Link>
      </div>
    );
  }

  // Find previous and next session in curriculum
  const currentIndex = CURRICULUM_SESSIONS.findIndex((s) => s.id === sessionId);
  const prevSession =
    currentIndex > 0 ? CURRICULUM_SESSIONS[currentIndex - 1] : null;
  const nextSession =
    currentIndex !== -1 && currentIndex < CURRICULUM_SESSIONS.length - 1
      ? CURRICULUM_SESSIONS[currentIndex + 1]
      : null;

  const isSessionFullyDone = videoCompleted && quizPassed;
  const quizQuestionCount = quiz?.questions?.length || 0;

  // Build YouTube Embed URL with start time & autoplay support
  const embedParams = new URLSearchParams({
    rel: '0',
    modestbranding: '1',
  });
  if (activeStartSeconds > 0) {
    embedParams.set('start', String(activeStartSeconds));
  }
  if (shouldAutoplay) {
    embedParams.set('autoplay', '1');
  }
  const youtubeEmbedSrc = `https://www.youtube.com/embed/${session.youtubeId}?${embedParams.toString()}`;

  // Filter transcript sections by search query
  const filteredTranscriptSections = transcriptData
    ? transcriptData.sections.filter((sec) => {
        if (!transcriptSearch.trim()) return true;
        const q = transcriptSearch.toLowerCase();
        return (
          (sec.title || '').toLowerCase().includes(q) ||
          (sec.speaker || '').toLowerCase().includes(q) ||
          (sec.paragraphs || []).some((p) => (p || '').toLowerCase().includes(q)) ||
          (sec.keyTakeaways || []).some((k) => (k || '').toLowerCase().includes(q)) ||
          (sec.equations &&
            sec.equations.some(
              (eq) =>
                (eq.label || '').toLowerCase().includes(q) ||
                (eq.formula || '').toLowerCase().includes(q)
            )) ||
          (sec.codeSnippet && (sec.codeSnippet.code || '').toLowerCase().includes(q))
        );
      })
    : [];

  return (
    <AuthGate>
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
              <span className="text-slate-500 dark:text-slate-400">Day 0{session.day}</span>
              <span className="text-slate-300 dark:text-slate-600">/</span>
              <span className="font-bold text-slate-900 dark:text-[#FAF6F3]">Session {session.sessionNumber}</span>
            </div>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6">
          <div className="space-y-6">
            {/* Live Session Alert Banner if active */}
            {session.isLive && (
              <div className="bg-red-500/10 dark:bg-red-950/40 border border-red-500/30 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping shrink-0" />
                  <div>
                    <span className="font-mono text-[10px] font-bold text-red-600 dark:text-red-400 uppercase tracking-widest block">
                      Live Broadcast
                    </span>
                    <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                      {session.liveNotice || 'Live lecture stream is in progress.'}
                    </p>
                  </div>
                </div>

                {session.liveMeetingUrl && (
                  <a
                    href={session.liveMeetingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors shrink-0"
                  >
                    <Video className="w-3.5 h-3.5" />
                    Join Stream
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            )}

            {/* Video Player */}
            <div
              ref={videoContainerRef}
              className="bg-black rounded-xl sm:rounded-2xl overflow-hidden shadow-sm aspect-video relative border border-slate-200 dark:border-[#3D1418]"
            >
              <iframe
                key={`${session.youtubeId}-${activeStartSeconds}-${shouldAutoplay}`}
                className="w-full h-full"
                src={youtubeEmbedSrc}
                title={session.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>

            {/* Interactive Video Chapters & Timestamp Jump Bar */}
            {transcriptData && transcriptData.chapters.length > 0 && (
              <div className="bg-white dark:bg-[#150709] border border-slate-200 dark:border-[#3D1418] rounded-xl p-4 sm:p-5 shadow-xs space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ListVideo className="w-4 h-4 text-burgundy dark:text-[#E89BA5]" />
                    <span className="font-mono text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-[#FAF6F3]">
                      Interactive Lecture Chapters ({transcriptData.chapters.length})
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                      Click any chapter to jump video player
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        transcriptSectionRef.current?.scrollIntoView({
                          behavior: 'smooth',
                          block: 'start',
                        })
                      }
                      className="font-mono text-[11px] font-semibold text-burgundy dark:text-[#E89BA5] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>Read Full Transcript</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  {transcriptData.chapters.map((ch, idx) => {
                    const nextCh = transcriptData.chapters[idx + 1];
                    const isActiveChapter =
                      activeStartSeconds >= ch.startSeconds &&
                      (!nextCh || activeStartSeconds < nextCh.startSeconds);

                    return (
                      <button
                        key={ch.id}
                        type="button"
                        onClick={() => handleJumpToTimestamp(ch.startSeconds)}
                        className={clsx(
                          'text-left p-2.5 rounded-lg border transition-all flex flex-col justify-between gap-1.5 cursor-pointer group',
                          isActiveChapter
                            ? 'bg-burgundy/10 dark:bg-burgundy/25 border-burgundy/40 dark:border-[#E89BA5]/50 ring-1 ring-burgundy/20'
                            : 'bg-slate-50/70 dark:bg-[#1C0A0D]/70 border-slate-200/80 dark:border-[#3D1418] hover:bg-slate-100 dark:hover:bg-[#250D11] hover:border-burgundy/30'
                        )}
                      >
                        <div className="flex items-center justify-between gap-1.5 w-full">
                          <span
                            className={clsx(
                              'font-mono text-[10px] font-bold px-1.5 py-0.5 rounded inline-flex items-center gap-1',
                              isActiveChapter
                                ? 'bg-burgundy text-white'
                                : 'bg-white dark:bg-[#150709] text-burgundy dark:text-[#E89BA5] border border-slate-200 dark:border-[#3D1418]'
                            )}
                          >
                            <Play className="w-2.5 h-2.5 fill-current" />
                            {ch.timestamp}
                          </span>
                          {ch.speaker && (
                            <span className="font-mono text-[9px] text-slate-400 dark:text-slate-500 truncate">
                              {ch.speaker.split(' ').slice(0, 2).join(' ')}
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-semibold text-slate-800 dark:text-[#FAF6F3] group-hover:text-burgundy dark:group-hover:text-[#E89BA5] line-clamp-1">
                          {ch.title}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-snug">
                          {ch.summary}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Title & Metadata Strip */}
            <div className="bg-white dark:bg-[#150709] border border-slate-200 dark:border-[#3D1418] rounded-xl p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono px-2 py-0.5 rounded bg-burgundy/10 text-burgundy dark:bg-burgundy/20 dark:text-[#E89BA5] font-semibold text-[11px] uppercase tracking-wider">
                    Session {session.sessionNumber}
                  </span>
                  <span className="font-mono text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {session.duration}
                  </span>
                  {transcriptData && (
                    <span className="font-mono text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/70">
                      Transcript & Study Notes Ready
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {videoCompleted ? (
                    <span className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      Lecture Watched
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleToggleVideoCompletion(true)}
                      disabled={isMarkingVideo}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-slate-300 dark:border-[#3D1418] hover:border-burgundy/40 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-burgundy dark:hover:text-[#E89BA5] bg-white dark:bg-[#1C0A0D] transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Mark Watched</span>
                    </button>
                  )}

                  {isSessionFullyDone ? (
                    <span className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      Session Complete ({quizScore}%)
                    </span>
                  ) : isLocked ? (
                    <Link
                      href={`/learning/session/${session.id}/quiz`}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-300/80 dark:border-amber-700/60 text-xs font-semibold transition-colors"
                    >
                      <Lock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      Quiz Coming Soon
                    </Link>
                  ) : (
                    <Link
                      href={`/learning/session/${session.id}/quiz`}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-burgundy text-white hover:bg-burgundy-deep text-xs font-semibold transition-colors shadow-xs"
                    >
                      <Award className="w-3.5 h-3.5" />
                      {quizPassed
                        ? `Quiz Passed (${quizScore}%) · Review`
                        : `Take Concept Quiz${quizQuestionCount > 0 ? ` (${quizQuestionCount} Qs)` : ''}`}
                    </Link>
                  )}
                </div>
              </div>

              <h1 className="font-serif text-xl sm:text-2xl md:text-3xl font-bold text-slate-900 dark:text-[#FAF6F3] tracking-tight">
                {session.title}
              </h1>

              <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-sans">
                {session.description}
              </p>

              {/* Primary Presentation Deck & Materials - Don Norman High-Affordance Design */}
              {session.slidesUrl && (
                <div className="p-4 rounded-xl border border-burgundy/25 dark:border-[#5C1E26] bg-slate-50/70 dark:bg-[#1C0A0D]/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-burgundy/10 dark:bg-burgundy/25 border border-burgundy/20 dark:border-[#5C1E26] flex items-center justify-center shrink-0 text-burgundy dark:text-[#E89BA5]">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-burgundy dark:text-[#E89BA5]">
                          Official Lecture Slides & Talk Deck
                        </span>
                        {session.slidesUrl.toLowerCase().includes('.pdf') && (
                          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-[#2A0E13] text-slate-700 dark:text-slate-300 font-semibold">
                            PDF Document
                          </span>
                        )}
                      </div>
                      <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-[#FAF6F3] truncate">
                        {session.speaker.name} — Presentation Slides & Lecture Notes
                      </h3>
                      <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-400">
                        {sessionId === 'session-6'
                          ? 'Complete mathematical proofs, RSA calculations, and quantum cryptography slide material.'
                          : 'Official slides and companion learning materials for this session.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <a
                      href={session.slidesUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-burgundy text-white hover:bg-burgundy-deep text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Open Talk PDF</span>
                      <ExternalLink className="w-3 h-3 opacity-75" />
                    </a>
                  </div>
                </div>
              )}

              {/* Key Learning Points */}
              <div className="pt-3 border-t border-slate-100 dark:border-[#3D1418]">
                <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-burgundy dark:text-[#E89BA5] block mb-2">
                  Learning Objectives
                </span>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(session.learnPoints || []).map((point, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-burgundy dark:bg-[#E89BA5] mt-1.5 shrink-0" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Attendance confirmation */}
              <div className="pt-3 border-t border-slate-100 dark:border-[#3D1418] flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
                    Session Attendance Record
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                    Track your video lecture progress for certificate eligibility. You can update this status at any time.
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {videoCompleted ? (
                    <>
                      <span className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>Watched</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleToggleVideoCompletion(false)}
                        disabled={isMarkingVideo}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-[#3D1418] bg-slate-50 dark:bg-[#1C0A0D] hover:bg-slate-100 dark:hover:bg-[#250D11] transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        title="Mark lecture as unwatched"
                      >
                        <RotateCcw className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                        <span>Mark Unwatched</span>
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleToggleVideoCompletion(true)}
                      disabled={isMarkingVideo}
                      className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 dark:bg-burgundy text-white hover:bg-slate-800 dark:hover:bg-burgundy-deep transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Confirm Video Watched</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Extracted Lecture Transcript & Comprehensive Technical Study Guide */}
            {transcriptData && (
              <div
                ref={transcriptSectionRef}
                className="bg-white dark:bg-[#150709] border border-slate-200 dark:border-[#3D1418] rounded-xl p-5 sm:p-6 shadow-xs space-y-5"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-[#3D1418]">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-burgundy/10 text-burgundy dark:bg-burgundy/25 dark:text-[#E89BA5]">
                        Verified Audio Transcript & Study Guide
                      </span>
                      <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                        Stream Window: {transcriptData.totalBroadcastDuration}
                      </span>
                    </div>
                    <h2 className="font-serif text-lg sm:text-xl font-bold text-slate-900 dark:text-[#FAF6F3]">
                      Extracted Lecture Breakdown & Quiz Preparation Notes
                    </h2>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      {transcriptData.overview}
                    </p>
                    {sessionId === 'session-6' && (
                      <div className="p-3 rounded-lg bg-burgundy/5 dark:bg-burgundy/15 border border-burgundy/15 text-[11px] text-slate-700 dark:text-slate-300">
                        <strong className="font-semibold text-slate-900 dark:text-[#FAF6F3]">Recommended:</strong> Complete mathematical definitions, modular arithmetic proofs, and quantum algorithm slides are detailed in Dr. Biswas&apos;s presentation deck above. The transcript sections below are collapsed by default as an optional lecture reference.
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-start md:self-center">
                    <button
                      type="button"
                      onClick={() => handleExpandAll(true)}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-[#3D1418] bg-slate-50 dark:bg-[#1C0A0D] hover:bg-slate-100 dark:hover:bg-[#250D11] text-[11px] font-mono font-semibold text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                    >
                      Expand All
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExpandAll(false)}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-[#3D1418] bg-slate-50 dark:bg-[#1C0A0D] hover:bg-slate-100 dark:hover:bg-[#250D11] text-[11px] font-mono font-semibold text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                    >
                      Collapse All
                    </button>
                  </div>
                </div>

                {/* Search Filter Bar */}
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={transcriptSearch}
                    onChange={(e) => setTranscriptSearch(e.target.value)}
                    placeholder="Search lecture transcript, physics concepts, formulas, hardware platforms, or Qiskit code..."
                    className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 dark:bg-[#1C0A0D] border border-slate-200 dark:border-[#3D1418] rounded-lg text-slate-900 dark:text-[#FAF6F3] placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-burgundy"
                  />
                </div>

                {/* Transcript Sections Accordion List */}
                <div className="space-y-3.5">
                  {filteredTranscriptSections.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400 font-mono">
                      No transcript sections matched &ldquo;{transcriptSearch}&rdquo;.
                    </div>
                  ) : (
                    filteredTranscriptSections.map((sec, idx) => {
                      const isExpanded = expandedSections[sec.id] !== false;
                      const matchingChapter = transcriptData.chapters[idx];

                      return (
                        <div
                          key={sec.id}
                          className="rounded-xl border border-slate-200 dark:border-[#3D1418] bg-slate-50/40 dark:bg-[#1C0A0D]/40 overflow-hidden transition-all"
                        >
                          {/* Section Header */}
                          <div className="px-4 py-3 bg-white dark:bg-[#150709] border-b border-slate-200/70 dark:border-[#3D1418] flex flex-wrap items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => toggleSection(sec.id)}
                              className="flex items-center gap-2.5 text-left flex-1 min-w-0 cursor-pointer"
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-burgundy dark:text-[#E89BA5] shrink-0" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                              )}
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono text-[10px] font-bold text-burgundy dark:text-[#E89BA5] uppercase">
                                    Part {idx + 1} · {sec.speaker}
                                  </span>
                                  <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500">
                                    ({sec.timestampRange})
                                  </span>
                                </div>
                                <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-[#FAF6F3] mt-0.5">
                                  {sec.title}
                                </h3>
                              </div>
                            </button>

                            {matchingChapter && (
                              <button
                                type="button"
                                onClick={() => handleJumpToTimestamp(matchingChapter.startSeconds)}
                                className="px-2.5 py-1 rounded-md bg-burgundy/10 dark:bg-burgundy/25 text-burgundy dark:text-[#E89BA5] hover:bg-burgundy hover:text-white font-mono text-[10px] font-bold inline-flex items-center gap-1 transition-colors shrink-0 cursor-pointer"
                                title="Jump video player to this section"
                              >
                                <Play className="w-2.5 h-2.5 fill-current" />
                                <span>Jump {matchingChapter.timestamp}</span>
                              </button>
                            )}
                          </div>

                          {/* Section Body */}
                          {isExpanded && (
                            <div className="p-4 sm:p-5 space-y-4">
                              {/* Detailed Narrative Paragraphs */}
                              <div className="space-y-2.5">
                                {(sec.paragraphs || []).map((para, pIdx) => (
                                  <p
                                    key={pIdx}
                                    className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed"
                                  >
                                    {para}
                                  </p>
                                ))}
                              </div>

                              {/* Key Takeaways Box */}
                              {sec.keyTakeaways && sec.keyTakeaways.length > 0 && (
                                <div className="p-3.5 rounded-lg bg-white dark:bg-[#150709] border border-slate-200 dark:border-[#3D1418] space-y-2">
                                  <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-burgundy dark:text-[#E89BA5] block">
                                    Key Concepts & Quiz Takeaways
                                  </span>
                                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {sec.keyTakeaways.map((kt, kIdx) => (
                                      <li
                                        key={kIdx}
                                        className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300"
                                      >
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                                        <span>{kt}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {/* Equations / Mathematical Relations */}
                              {sec.equations && sec.equations.length > 0 && (
                                <div className="p-3.5 rounded-lg bg-slate-900 dark:bg-[#0D0304] border border-slate-800 dark:border-[#3D1418] space-y-1.5">
                                  <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#E89BA5] block">
                                    Formulas & Physical Relations
                                  </span>
                                  <div className="space-y-1">
                                    {sec.equations.map((eq, eIdx) => (
                                      <div
                                        key={eIdx}
                                        className="font-mono text-xs text-slate-100 bg-slate-800/70 dark:bg-[#180709] px-3 py-1.5 rounded border border-slate-700/70 dark:border-[#2D1014] overflow-x-auto flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2"
                                      >
                                        {eq.label && (
                                          <span className="text-[#E89BA5] font-semibold shrink-0">
                                            {eq.label}:
                                          </span>
                                        )}
                                        <span>{eq.formula}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Live Code Snippet */}
                              {sec.codeSnippet && (
                                <div className="rounded-lg overflow-hidden border border-slate-800 dark:border-[#3D1418] bg-slate-950">
                                  <div className="px-3.5 py-2 bg-slate-900 dark:bg-[#1C0A0D] border-b border-slate-800 dark:border-[#3D1418] flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                      <Code2 className="w-3.5 h-3.5 text-[#E89BA5]" />
                                      <span className="font-mono text-[11px] font-semibold text-slate-200">
                                        {sec.codeSnippet.title}
                                      </span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleCopyCode(sec.id, sec.codeSnippet!.code)
                                      }
                                      className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-[10px] flex items-center gap-1 transition-colors cursor-pointer"
                                    >
                                      {copiedSnippetId === sec.id ? (
                                        <>
                                          <Check className="w-3 h-3 text-emerald-400" />
                                          <span>Copied</span>
                                        </>
                                      ) : (
                                        <>
                                          <Copy className="w-3 h-3" />
                                          <span>Copy Code</span>
                                        </>
                                      )}
                                    </button>
                                  </div>
                                  <pre className="p-3.5 text-xs font-mono text-slate-200 overflow-x-auto leading-relaxed">
                                    <code>{sec.codeSnippet.code}</code>
                                  </pre>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Bottom Quiz Call-to-Action inside Transcript Card */}
                {!isLocked && (
                  <div className="pt-3 border-t border-slate-200 dark:border-[#3D1418] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="text-xs text-slate-600 dark:text-slate-300">
                      <span className="font-semibold text-slate-900 dark:text-[#FAF6F3]">
                        Ready to test your understanding?
                      </span>{' '}
                      All {quizQuestionCount || 20} quiz questions are directly grounded in the lecture transcript above.
                    </div>
                    <Link
                      href={`/learning/session/${session.id}/quiz`}
                      className="px-4 py-2 rounded-lg bg-burgundy hover:bg-burgundy-deep text-white text-xs font-semibold transition-colors inline-flex items-center justify-center gap-1.5 shrink-0"
                    >
                      <Award className="w-3.5 h-3.5" />
                      <span>
                        {quizPassed
                          ? `Review Quiz (${quizScore}%)`
                          : `Start Session ${session.sessionNumber} Quiz (${quizQuestionCount || 20} Qs)`}
                      </span>
                    </Link>
                  </div>
                )}
              </div>
            )}

            {/* Resources and Lecturer Profile Grid */}
            <div
              className={clsx(
                'grid gap-5',
                hasReferenceMaterial ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'
              )}
            >
              {/* Lecturer Profile Card */}
              <div className="p-5 bg-white dark:bg-[#150709] border border-slate-200 dark:border-[#3D1418] rounded-xl shadow-xs space-y-4">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-burgundy dark:text-[#E89BA5] block">
                  {session.coSpeakers && session.coSpeakers.length > 0 ? 'Lecturers & Speakers' : 'Session Lecturer'}
                </span>

                <div className="space-y-3.5">
                  <div className="space-y-1">
                    <h3 className="font-serif text-base font-bold text-slate-900 dark:text-[#FAF6F3]">{session.speaker.name}</h3>
                    <p className="font-mono text-[11px] font-semibold text-burgundy dark:text-[#E89BA5] uppercase tracking-wide">{session.speaker.role}</p>
                    <p className="font-sans text-xs text-slate-500 dark:text-slate-400">{session.speaker.institution}</p>
                    <p className="font-sans text-xs text-slate-600 dark:text-slate-300 leading-relaxed pt-1">
                      {session.speaker.bio}
                    </p>
                  </div>

                  {session.coSpeakers?.map((co, cIdx) => (
                    <div key={cIdx} className="space-y-1 pt-3 border-t border-slate-100 dark:border-[#3D1418]">
                      <h3 className="font-serif text-base font-bold text-slate-900 dark:text-[#FAF6F3]">{co.name}</h3>
                      <p className="font-mono text-[11px] font-semibold text-burgundy dark:text-[#E89BA5] uppercase tracking-wide">{co.role}</p>
                      <p className="font-sans text-xs text-slate-500 dark:text-slate-400">{co.institution}</p>
                      <p className="font-sans text-xs text-slate-600 dark:text-slate-300 leading-relaxed pt-1">
                        {co.bio}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Lecture Notes & Resources - ONLY rendered if actual URLs are provided */}
              {hasReferenceMaterial && (
                <div className="p-5 bg-white dark:bg-[#150709] border border-slate-200 dark:border-[#3D1418] rounded-xl shadow-xs space-y-3">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-burgundy dark:text-[#E89BA5] block">
                    Reference Material
                  </span>

                  <div className="space-y-2 text-xs">
                    {session.lectureNotesUrl?.trim() && (
                      <a
                        href={session.lectureNotesUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2.5 rounded-lg border border-slate-200 dark:border-[#3D1418] bg-slate-50 dark:bg-[#1C0A0D] hover:bg-slate-100 dark:hover:bg-[#250D11] flex items-center justify-between text-slate-800 dark:text-[#FAF6F3] font-medium transition-colors"
                      >
                        <span className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-burgundy dark:text-[#E89BA5]" />
                          Official Documentation & Guides
                        </span>
                        <ExternalLink className="w-3 h-3 text-slate-400" />
                      </a>
                    )}

                    {session.slidesUrl?.trim() && (
                      <a
                        href={session.slidesUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2.5 rounded-lg border border-slate-200 dark:border-[#3D1418] bg-slate-50 dark:bg-[#1C0A0D] hover:bg-slate-100 dark:hover:bg-[#250D11] flex items-center justify-between text-slate-800 dark:text-[#FAF6F3] font-medium transition-colors"
                      >
                        <span className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-burgundy dark:text-[#E89BA5]" />
                          {session.slidesUrl.toLowerCase().includes('.pdf')
                            ? 'Presentation Slides & Talk Notes (.pdf)'
                            : 'Tutorial Code & Notebooks'}
                        </span>
                        <ExternalLink className="w-3 h-3 text-slate-400" />
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Session Navigation Footer */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              {prevSession ? (
                <Link
                  href={`/learning/session/${prevSession.id}`}
                  className="p-4 rounded-xl bg-white dark:bg-[#150709] border border-slate-200 dark:border-[#3D1418] hover:border-burgundy/40 dark:hover:border-[#E89BA5]/40 transition-all flex items-center gap-3 group shadow-xs"
                >
                  <ArrowLeft className="w-4 h-4 text-slate-400 group-hover:text-burgundy dark:group-hover:text-[#E89BA5] shrink-0" />
                  <div className="min-w-0">
                    <span className="font-mono text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block">
                      Previous · Session {prevSession.sessionNumber}
                    </span>
                    <span className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-[#FAF6F3] group-hover:text-burgundy dark:group-hover:text-[#E89BA5] truncate block mt-0.5">
                      {prevSession.title}
                    </span>
                  </div>
                </Link>
              ) : (
                <div className="hidden sm:block" />
              )}

              {!quizPassed && !isLocked ? (
                <Link
                  href={`/learning/session/${session.id}/quiz`}
                  className="p-4 rounded-xl bg-burgundy/5 dark:bg-[#1C0A0D] border border-burgundy/30 dark:border-burgundy/50 hover:border-burgundy transition-all flex items-center justify-between gap-3 group shadow-xs"
                >
                  <div className="min-w-0">
                    <span className="font-mono text-[10px] uppercase font-bold text-burgundy dark:text-[#E89BA5] block">
                      Required Next Step
                    </span>
                    <span className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-[#FAF6F3] group-hover:text-burgundy dark:group-hover:text-[#E89BA5] truncate block mt-0.5">
                      Take Session {session.sessionNumber} Concept Quiz
                    </span>
                  </div>
                  <Award className="w-4 h-4 text-burgundy dark:text-[#E89BA5] shrink-0" />
                </Link>
              ) : nextSession ? (
                <Link
                  href={`/learning/session/${nextSession.id}`}
                  className="p-4 rounded-xl bg-white dark:bg-[#150709] border border-slate-200 dark:border-[#3D1418] hover:border-burgundy/40 dark:hover:border-[#E89BA5]/40 transition-all flex items-center justify-between gap-3 group shadow-xs"
                >
                  <div className="min-w-0">
                    <span className="font-mono text-[10px] uppercase font-bold text-burgundy dark:text-[#E89BA5] block">
                      Up Next · Session {nextSession.sessionNumber}
                    </span>
                    <span className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-[#FAF6F3] group-hover:text-burgundy dark:group-hover:text-[#E89BA5] truncate block mt-0.5">
                      {nextSession.title}
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-burgundy dark:group-hover:text-[#E89BA5] shrink-0" />
                </Link>
              ) : (
                <Link
                  href={`/learning?challenge=${session.day}`}
                  className="p-4 rounded-xl bg-white dark:bg-[#150709] border border-slate-200 dark:border-[#3D1418] hover:border-burgundy/40 dark:hover:border-[#E89BA5]/40 transition-all flex items-center justify-between gap-3 group shadow-xs"
                >
                  <div className="min-w-0">
                    <span className="font-mono text-[10px] uppercase font-bold text-burgundy dark:text-[#E89BA5] block">
                      Up Next · Daily Challenge
                    </span>
                    <span className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-[#FAF6F3] group-hover:text-burgundy dark:group-hover:text-[#E89BA5] truncate block mt-0.5">
                      Submit Day 0{session.day} Creative Entry
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-burgundy dark:group-hover:text-[#E89BA5] shrink-0" />
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </AuthGate>
  );
}
