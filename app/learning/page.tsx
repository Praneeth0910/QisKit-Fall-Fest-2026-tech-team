'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import clsx from 'clsx';
import { AuthGate } from '@/components/learning/AuthGate';
import { supabase } from '@/lib/supabase';
import { CURRICULUM_SESSIONS, ONLINE_PROGRAMME_SCHEDULE } from '@/data/learning/curriculum';
import { SESSION_TRANSCRIPTS } from '@/data/learning/transcripts';
import { DAILY_COMPETITIONS } from '@/data/learning/competitions';
import { useCurriculumSessions } from '@/hooks/use-curriculum-sessions';
import { useQuizzes } from '@/hooks/use-quizzes';
import {
  Award,
  Send,
  CheckCircle2,
  ExternalLink,
  PlayCircle,
  Clock,
  BookOpen,
  ArrowRight,
  ArrowLeft,
  Calendar,
  ChevronRight,
  Coffee,
  Users,
  Terminal,
  Lock,
  Trophy,
  Upload,
  FileText,
  Link2,
  AlertCircle,
  Loader2,
  X,
  Download,
  Share2,
} from 'lucide-react';

const MAX_DOCUMENT_SIZE_MB = 15;
const MAX_DOCUMENT_SIZE_BYTES = MAX_DOCUMENT_SIZE_MB * 1024 * 1024;

function isAllowedDocumentFile(file: File): boolean {
  const lowerName = file.name.toLowerCase();
  const validExt = lowerName.endsWith('.pdf') || lowerName.endsWith('.docx');
  const validMime =
    file.type === 'application/pdf' ||
    file.type ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    file.type === '';
  return validExt && validMime;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

function LearningDashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams?.get('session');
  const challengeDay = searchParams?.get('challenge');

  // If someone visits /learning?session=session-1, redirect directly to /learning/session/session-1
  useEffect(() => {
    if (sessionId) {
      router.replace(`/learning/session/${sessionId}`);
    }
  }, [sessionId, router]);

  const [competitions, setCompetitions] = useState<Record<string, any>>({});
  const [competitionUrls, setCompetitionUrls] = useState<Record<string, string>>({});
  const [submissionModes, setSubmissionModes] = useState<Record<string, 'file' | 'url'>>({
    poster: 'file',
    essay: 'file',
  });
  const [selectedFiles, setSelectedFiles] = useState<Record<string, File | null>>({});
  const [isSubmittingComp, setIsSubmittingComp] = useState<Record<string, boolean>>({});
  const [compSuccessMsg, setCompSuccessMsg] = useState<Record<string, string>>({});
  const [compErrorMsg, setCompErrorMsg] = useState<Record<string, string>>({});

  // Session progress state
  const [progress, setProgress] = useState<Record<string, any>>({});

  // Dynamic curriculum sessions from admin/Redis
  const { sessions } = useCurriculumSessions();
  const curriculumList = sessions && sessions.length > 0 ? sessions : CURRICULUM_SESSIONS;
  const { quizzes } = useQuizzes();

  // Schedule timetable tab state (default to Day 3)
  const [selectedScheduleDay, setSelectedScheduleDay] = useState<number>(3);
  const currentDayProgramme =
    ONLINE_PROGRAMME_SCHEDULE.find((d) => d.day === selectedScheduleDay) ||
    ONLINE_PROGRAMME_SCHEDULE[0];

  // Open Certificate Modal globally
  const openCertificateModal = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('open-certificate-modal'));
    }
  };
  const [sessionUser, setSessionUser] = useState<{ email: string; fullName: string } | null>(null);

  useEffect(() => {
    fetchCompetitions();
    fetchProgress();
    fetchSessionUser();
  }, []);

  async function fetchSessionUser() {
    try {
      const { getClientSession } = await import('@/lib/session-client');
      const data = await getClientSession();
      if (data?.session) {
        setSessionUser({
          email: data.session.email,
          fullName: data.session.fullName || data.session.email,
        });
      }
    } catch (e) {
      console.error('Error fetching session user:', e);
    }
  }

  async function fetchProgress() {
    try {
      const res = await fetch('/api/learning/progress', { cache: 'no-store' });
      const data = await res.json();
      if (data?.progress) {
        setProgress(data.progress);
      }
    } catch (e) {
      console.error('Error loading progress:', e);
    }
  }

  async function fetchCompetitions() {
    try {
      const res = await fetch('/api/learning/competition-submit', { cache: 'no-store' });
      const data = await res.json();
      if (data.submissions) {
        setCompetitions(data.submissions);
        const urls: Record<string, string> = {};
        const modes: Record<string, 'file' | 'url'> = {
          poster: 'file',
          essay: 'file',
        };
        Object.entries(data.submissions).forEach(([type, sub]: [string, any]) => {
          const recordedUrl = sub?.submission_url || '';
          const isUploadedDoc =
            sub?.notes === 'file_upload' ||
            recordedUrl.includes('/storage/v1/object/public/media/competition-submissions/');
          if (!isUploadedDoc) {
            urls[type] = recordedUrl;
          }
          if (type === 'poster' || type === 'essay') {
            modes[type] = isUploadedDoc ? 'file' : 'url';
          }
        });
        setCompetitionUrls(urls);
        setSubmissionModes((prev) => ({ ...prev, ...modes }));
      }
    } catch (e) {
      console.error('Error loading competitions:', e);
    }
  }

  function handleFileSelect(
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'poster' | 'essay'
  ) {
    setCompErrorMsg((prev) => ({ ...prev, [type]: '' }));
    setCompSuccessMsg((prev) => ({ ...prev, [type]: '' }));

    const file = e.target.files?.[0] || null;
    if (!file) {
      setSelectedFiles((prev) => ({ ...prev, [type]: null }));
      return;
    }

    if (!isAllowedDocumentFile(file)) {
      setCompErrorMsg((prev) => ({
        ...prev,
        [type]: 'Invalid file format. Please select a .pdf or .docx document.',
      }));
      e.target.value = '';
      setSelectedFiles((prev) => ({ ...prev, [type]: null }));
      return;
    }

    if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
      setCompErrorMsg((prev) => ({
        ...prev,
        [type]: `File exceeds the ${MAX_DOCUMENT_SIZE_MB} MB size limit (${formatFileSize(file.size)}). Please compress the file or submit a public cloud link.`,
      }));
      e.target.value = '';
      setSelectedFiles((prev) => ({ ...prev, [type]: null }));
      return;
    }

    setSelectedFiles((prev) => ({ ...prev, [type]: file }));
  }

  async function handleCompetitionSubmit(e: React.FormEvent, type: 'reels' | 'poster' | 'essay') {
    e.preventDefault();
    const supportsDocumentUpload = type === 'poster' || type === 'essay';
    const currentMode = supportsDocumentUpload ? submissionModes[type] || 'file' : 'url';

    setCompErrorMsg((prev) => ({ ...prev, [type]: '' }));
    setCompSuccessMsg((prev) => ({ ...prev, [type]: '' }));
    setIsSubmittingComp((prev) => ({ ...prev, [type]: true }));

    try {
      let finalSubmissionUrl = '';
      let finalSubmissionTitle: string | null = null;
      let finalNotes = 'external_url';

      if (supportsDocumentUpload && currentMode === 'file') {
        const file = selectedFiles[type];
        if (!file) {
          setCompErrorMsg((prev) => ({
            ...prev,
            [type]: 'Please choose a .pdf or .docx file to upload.',
          }));
          setIsSubmittingComp((prev) => ({ ...prev, [type]: false }));
          return;
        }

        if (!isAllowedDocumentFile(file)) {
          setCompErrorMsg((prev) => ({
            ...prev,
            [type]: 'Only .pdf and .docx files are supported.',
          }));
          setIsSubmittingComp((prev) => ({ ...prev, [type]: false }));
          return;
        }

        if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
          setCompErrorMsg((prev) => ({
            ...prev,
            [type]: `File size must be under ${MAX_DOCUMENT_SIZE_MB} MB.`,
          }));
          setIsSubmittingComp((prev) => ({ ...prev, [type]: false }));
          return;
        }

        const ext = file.name.toLowerCase().endsWith('.docx') ? 'docx' : 'pdf';
        const contentType =
          ext === 'docx'
            ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            : 'application/pdf';
        const emailSlug = (sessionUser?.email || 'participant')
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '_')
          .slice(0, 48);
        const baseName =
          file.name
            .replace(/\.[^/.]+$/, '')
            .replace(/[^a-zA-Z0-9_-]/g, '_')
            .slice(0, 60) || type;
        const storagePath = `competition-submissions/${type}/${emailSlug}_${Date.now()}_${baseName}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from('media')
          .upload(storagePath, file, {
            contentType,
            upsert: true,
            cacheControl: '3600',
          });

        if (uploadError) {
          throw new Error(
            uploadError.message ||
              'Could not upload document to storage. Please try again or use a public link.'
          );
        }

        const { data: publicUrlData } = supabase.storage
          .from('media')
          .getPublicUrl(storagePath);

        if (!publicUrlData?.publicUrl) {
          throw new Error('Could not resolve public URL for uploaded document.');
        }

        finalSubmissionUrl = publicUrlData.publicUrl;
        finalSubmissionTitle = file.name;
        finalNotes = 'file_upload';
      } else {
        const rawUrl = competitionUrls[type]?.trim() || '';
        if (!rawUrl) {
          setCompErrorMsg((prev) => ({
            ...prev,
            [type]: 'Please enter a valid public URL.',
          }));
          setIsSubmittingComp((prev) => ({ ...prev, [type]: false }));
          return;
        }

        if (/^file:\/\//i.test(rawUrl) || /^[a-zA-Z]:\\/.test(rawUrl)) {
          setCompErrorMsg((prev) => ({
            ...prev,
            [type]:
              'Local computer file paths (file://) cannot be opened by the jury. Please switch to "Upload Document (.pdf / .docx)" to upload your file directly.',
          }));
          setIsSubmittingComp((prev) => ({ ...prev, [type]: false }));
          return;
        }

        finalSubmissionUrl = rawUrl;
        finalSubmissionTitle = null;
        finalNotes = 'external_url';
      }

      const res = await fetch('/api/learning/competition-submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          competitionType: type,
          submissionUrl: finalSubmissionUrl,
          submissionTitle: finalSubmissionTitle,
          notes: finalNotes,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to save submission. Please check your input.');
      }

      setCompetitions((prev) => ({ ...prev, [type]: data.submission }));
      if (finalNotes === 'file_upload') {
        setSelectedFiles((prev) => ({ ...prev, [type]: null }));
        setCompSuccessMsg((prev) => ({
          ...prev,
          [type]: `Document "${finalSubmissionTitle}" uploaded and recorded.`,
        }));
      } else {
        setCompSuccessMsg((prev) => ({
          ...prev,
          [type]: 'Public link submitted and recorded.',
        }));
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('learning-progress-updated'));
      }
    } catch (err: any) {
      console.error('Error submitting competition:', err);
      setCompErrorMsg((prev) => ({
        ...prev,
        [type]: err?.message || 'An error occurred while saving your submission.',
      }));
    } finally {
      setIsSubmittingComp((prev) => ({ ...prev, [type]: false }));
    }
  }

  // Calculate metrics against active curriculumList
  const totalSessionsCount = curriculumList.length || 5;
  const completedSessionsCount = curriculumList.filter((s) => progress[s.id]?.videoCompleted).length;
  const passedQuizzesCount = curriculumList.filter((s) => progress[s.id]?.quizPassed).length;
  const submittedCompsCount = Object.keys(competitions).length;
  const isCertificateEligible =
    totalSessionsCount > 0 &&
    completedSessionsCount === totalSessionsCount &&
    passedQuizzesCount === totalSessionsCount;

  // Next session to study: prefer sessions where video is unwatched OR quiz is unlocked & unpassed
  const nextSession =
    curriculumList.find((s) => {
      const p = progress[s.id];
      const quizLocked = Boolean(quizzes[s.id]?.isLocked);
      return !p?.videoCompleted || (!p?.quizPassed && !quizLocked);
    }) ||
    curriculumList.find((s) => {
      const p = progress[s.id];
      return !p || !p.videoCompleted || !p.quizPassed;
    }) ||
    curriculumList[0];

  // 1. If viewing a challenge
  if (challengeDay) {
    const day = Number(challengeDay);
    const challenge = DAILY_COMPETITIONS[day];

    if (!challenge) {
      return (
        <div className="p-8 text-center font-mono text-xs text-slate-500">
          No challenge available for Day {day}.
        </div>
      );
    }

    const recordedSub = competitions[challenge.type];
    const isCurrentChallengeSubmitted = Boolean(recordedSub);
    const supportsDocUpload =
      challenge.submissionType === 'url_or_document' ||
      challenge.type === 'poster' ||
      challenge.type === 'essay';
    const activeMode = supportsDocUpload
      ? submissionModes[challenge.type] || 'file'
      : 'url';
    const currentSelectedFile = selectedFiles[challenge.type] || null;
    const isRecordedUploadedDoc =
      recordedSub &&
      (recordedSub.notes === 'file_upload' ||
        String(recordedSub.submission_url || '').includes(
          '/storage/v1/object/public/media/competition-submissions/'
        ));

    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 font-sans space-y-4">
        {/* Top Navigation & Challenge Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/learning"
            className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-burgundy dark:hover:text-[#E89BA5] transition-colors uppercase tracking-wider"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Learning Hub</span>
          </Link>

          <div className="flex items-center gap-1.5 p-1 bg-white dark:bg-[#150709] rounded-lg border border-slate-200 dark:border-[#3D1418]">
            {Object.values(DAILY_COMPETITIONS).map((c) => {
              const isDone = Boolean(competitions[c.type]);
              const isActive = c.day === day;
              return (
                <Link
                  key={c.day}
                  href={`/learning?challenge=${c.day}`}
                  className={clsx(
                    'px-2.5 py-1 rounded-md font-mono text-[11px] font-semibold flex items-center gap-1 transition-colors',
                    isActive
                      ? 'bg-burgundy text-white'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#1C0A0D]'
                  )}
                >
                  {isDone && (
                    <CheckCircle2
                      className={clsx(
                        'w-3 h-3 shrink-0',
                        isActive ? 'text-white' : 'text-emerald-600 dark:text-emerald-400'
                      )}
                    />
                  )}
                  <span>Day 0{c.day}</span>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="bg-white dark:bg-[#150709] border border-slate-200 dark:border-[#3D1418] rounded-xl shadow-xs p-5 sm:p-7 space-y-6">
          <div className="border-b border-slate-100 dark:border-[#3D1418] pb-4 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div>
              <span className="font-mono text-[10px] font-bold text-burgundy dark:text-[#E89BA5] uppercase tracking-wider block mb-1">
                Challenge · Day 0{day} · Deadline: 12 October 2026
              </span>
              <h1 className="font-serif text-xl sm:text-2xl font-bold text-[#181313] dark:text-[#FAF6F3] tracking-tight">
                {challenge.title}
              </h1>
              <p className="font-sans text-slate-600 dark:text-slate-300 text-xs sm:text-sm mt-1">
                {challenge.description}
              </p>
            </div>

            {isCurrentChallengeSubmitted ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-mono text-[11px] font-bold shrink-0 self-start">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Submitted</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-mono text-[11px] font-bold shrink-0 self-start">
                <Clock className="w-3.5 h-3.5" />
                <span>Pending</span>
              </span>
            )}
          </div>

          {/* Highlighted Prize Banner - Styled in Burgundy Shades */}
          <div className="relative overflow-hidden p-4 sm:p-5 rounded-2xl border-2 border-burgundy/30 dark:border-burgundy/60 bg-linear-to-r from-burgundy/10 via-burgundy/[0.04] to-transparent dark:from-[#260C11] dark:via-[#1A080C] dark:to-[#120507] shadow-sm flex items-center justify-between gap-4">
            <div className="absolute top-0 right-0 -mt-6 -mr-6 w-32 h-32 bg-burgundy/15 dark:bg-burgundy/25 rounded-full blur-2xl pointer-events-none" />

            <div className="relative z-10 flex items-center gap-3.5 sm:gap-4">
              <div className="w-12 h-12 rounded-xl bg-linear-to-br from-burgundy via-burgundy-deep to-[#3D0A12] text-white flex items-center justify-center shrink-0 shadow-md ring-2 ring-burgundy/20 dark:ring-burgundy/50">
                <Trophy className="w-6 h-6 text-white" />
              </div>
              <div>
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-burgundy dark:text-[#E89BA5] block">
                  Award & Cash Prize
                </span>
                <div className="flex flex-wrap items-baseline gap-2 mt-0.5">
                  <span className="font-serif text-2xl sm:text-3xl font-black text-burgundy dark:text-[#FAF6F3] tracking-tight">
                    {challenge.prize || 'Up to ₹5,000'}
                  </span>
                  <span className="text-xs font-semibold text-burgundy/80 dark:text-[#E89BA5]/80 font-mono">
                    (Top Performing Entries)
                  </span>
                </div>
              </div>
            </div>

            <div className="relative z-10 hidden sm:flex items-center px-3.5 py-1.5 rounded-full bg-burgundy/10 dark:bg-burgundy/25 border border-burgundy/25 dark:border-burgundy/50 text-burgundy dark:text-[#E89BA5] text-xs font-bold font-mono shadow-2xs">
              <span>Prize Award</span>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-[#1C0A0D] rounded-lg p-4 border border-slate-200/80 dark:border-[#3D1418] space-y-3">
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-burgundy dark:text-[#E89BA5] block">
              Guidelines
            </span>
            <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
              {(challenge.guidelines || []).map((g, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-burgundy dark:bg-[#E89BA5] mt-1.5 shrink-0" />
                  <span>{g}</span>
                </li>
              ))}
            </ul>
            <div className="pt-2 border-t border-slate-200/60 dark:border-[#3D1418] flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400">Deadline:</span>
              <span className="font-mono font-semibold text-slate-800 dark:text-[#FAF6F3]">
                {challenge.submissionDeadline}
              </span>
            </div>
          </div>

          <div className="space-y-4">
            {/* Mode Switcher for Digital Poster (Day 2) & Essay (Day 3) */}
            {supportsDocUpload && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Submission Method
                  </span>
                  <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400">
                    Accepts .pdf or .docx (max {MAX_DOCUMENT_SIZE_MB} MB) or public URL
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-[#1C0A0D] rounded-xl border border-slate-200 dark:border-[#3D1418]">
                  <button
                    type="button"
                    onClick={() => {
                      setSubmissionModes((prev) => ({ ...prev, [challenge.type]: 'file' }));
                      setCompErrorMsg((prev) => ({ ...prev, [challenge.type]: '' }));
                    }}
                    className={clsx(
                      'py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer',
                      activeMode === 'file'
                        ? 'bg-white dark:bg-burgundy text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    )}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Document (.pdf / .docx)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSubmissionModes((prev) => ({ ...prev, [challenge.type]: 'url' }));
                      setCompErrorMsg((prev) => ({ ...prev, [challenge.type]: '' }));
                    }}
                    className={clsx(
                      'py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer',
                      activeMode === 'url'
                        ? 'bg-white dark:bg-burgundy text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    )}
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    <span>Public Link (URL)</span>
                  </button>
                </div>
              </div>
            )}

            {/* Tech Reels Dedicated Brand Kit & Social Tagging Instructions */}
            {challenge.type === 'reels' && (
              <div className="space-y-4">
                {/* Existing Drive link warning banner if participant already submitted a Google Drive link */}
                {Boolean(
                  recordedSub?.submission_url &&
                    (recordedSub.submission_url.includes('drive.google.com') ||
                      recordedSub.submission_url.includes('drive.google'))
                ) && (
                  <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs space-y-1.5 shadow-2xs">
                    <div className="flex items-center gap-2 font-bold text-amber-900 dark:text-amber-200">
                      <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                      <span>Action Required: Update Your Submission to a Live Social Link</span>
                    </div>
                    <p className="text-amber-800 dark:text-amber-300 leading-relaxed pl-6">
                      Your current recorded submission is a Google Drive link. Drive links do not generate public reach or community engagement and will not qualify for engagement points. Please post your video as an Instagram Reel or LinkedIn Video using the official logos below, then update your submission with the public post link.
                    </p>
                  </div>
                )}

                {/* Mandatory Brand Kit Download Card */}
                <div className="p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-[#3D1418] bg-slate-50/70 dark:bg-[#1A090C] space-y-3.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 dark:border-[#3D1418] pb-3">
                    <div>
                      <h3 className="font-sans text-xs sm:text-sm font-bold text-slate-900 dark:text-[#FAF6F3]">
                        Official Brand Assets & Logos (Mandatory)
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Download both high-resolution logos and feature them in your reel (intro card, corner watermark, or outro).
                      </p>
                    </div>
                    <span className="font-mono text-[10px] font-semibold text-burgundy dark:text-[#E89BA5] px-2.5 py-1 rounded bg-burgundy/10 dark:bg-burgundy/20 border border-burgundy/20 dark:border-burgundy/40 shrink-0 self-start sm:self-auto">
                      Required for Evaluation
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-0.5">
                    {/* Logo 1: Qiskit Fall Fest 2026 SRM AP Badge */}
                    <div className="p-3 rounded-lg border border-slate-200 dark:border-[#3D1418] bg-white dark:bg-[#150709] flex items-center justify-between gap-3 shadow-2xs">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-[#280C10] p-1 flex items-center justify-center shrink-0 border border-slate-200/80 dark:border-[#3D1418]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src="/brand/qiskit-fall-fest-2026-badge.png"
                            alt="Qiskit Fall Fest 2026 SRM AP Badge"
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                            Qiskit Fall Fest Badge
                          </p>
                          <p className="font-mono text-[10px] text-slate-500 dark:text-slate-400">
                            PNG · High-Res 1080p
                          </p>
                        </div>
                      </div>
                      <a
                        href="/brand/qiskit-fall-fest-2026-badge.png"
                        download="Qiskit-Fall-Fest-2026-SRMAP-Badge.png"
                        className="px-2.5 py-1.5 rounded-md bg-slate-100 dark:bg-[#2A0F13] hover:bg-burgundy hover:text-white dark:hover:bg-burgundy text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download</span>
                      </a>
                    </div>

                    {/* Logo 2: SRM University-AP Official Logo */}
                    <div className="p-3 rounded-lg border border-slate-200 dark:border-[#3D1418] bg-white dark:bg-[#150709] flex items-center justify-between gap-3 shadow-2xs">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-[#280C10] p-1 flex items-center justify-center shrink-0 border border-slate-200/80 dark:border-[#3D1418]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src="/brand/srm-ap-logo.png"
                            alt="SRM University-AP Logo"
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                            SRM University-AP Logo
                          </p>
                          <p className="font-mono text-[10px] text-slate-500 dark:text-slate-400">
                            PNG · Transparent
                          </p>
                        </div>
                      </div>
                      <a
                        href="/brand/srm-ap-logo.png"
                        download="SRM-University-AP-Official-Logo.png"
                        className="px-2.5 py-1.5 rounded-md bg-slate-100 dark:bg-[#2A0F13] hover:bg-burgundy hover:text-white dark:hover:bg-burgundy text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download</span>
                      </a>
                    </div>
                  </div>

                  {/* Social Tagging Quick Reference */}
                  <div className="p-3 rounded-lg bg-slate-100/70 dark:bg-[#200A0E] border border-slate-200/70 dark:border-[#3D1418] text-xs space-y-1.5">
                    <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
                      <Share2 className="w-3.5 h-3.5 text-burgundy dark:text-[#E89BA5]" />
                      <span>Social Posting & Tagging Instructions:</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1 font-mono text-[11px]">
                      <div className="p-2.5 rounded bg-white dark:bg-[#150709] border border-slate-200/60 dark:border-[#3D1418] space-y-0.5">
                        <p className="font-bold text-slate-800 dark:text-slate-200 font-sans text-xs">Instagram Reel</p>
                        <p className="text-slate-600 dark:text-slate-300">
                          Tag: <span className="text-burgundy dark:text-[#E89BA5] font-bold">@qiskitfallfest</span> & <span className="text-burgundy dark:text-[#E89BA5] font-bold">@srmuap</span>
                        </p>
                        <p className="text-slate-500 dark:text-slate-400 text-[10px]">
                          #QiskitFallFest2026 #QiskitFallFestSRMAP #SRMUniversityAP
                        </p>
                      </div>
                      <div className="p-2.5 rounded bg-white dark:bg-[#150709] border border-slate-200/60 dark:border-[#3D1418] space-y-0.5">
                        <p className="font-bold text-slate-800 dark:text-slate-200 font-sans text-xs">LinkedIn Video Post</p>
                        <p className="text-slate-600 dark:text-slate-300">
                          Mention: <span className="text-burgundy dark:text-[#E89BA5] font-bold">SRM University-AP</span> & <span className="text-burgundy dark:text-[#E89BA5] font-bold">Qiskit</span>
                        </p>
                        <p className="text-slate-500 dark:text-slate-400 text-[10px]">
                          #QiskitFallFest2026 #QiskitFallFestSRMAP #SRMUniversityAP
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={(e) => handleCompetitionSubmit(e, challenge.type)} className="space-y-3">
              {supportsDocUpload && activeMode === 'file' ? (
                <div className="space-y-3">
                  <div className="rounded-xl border-2 border-dashed border-slate-300 dark:border-[#4A181E] bg-slate-50/70 dark:bg-[#1C0A0D]/70 p-4 sm:p-5 transition-colors hover:border-burgundy/50 dark:hover:border-[#E89BA5]/50">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-burgundy/10 dark:bg-burgundy/20 text-burgundy dark:text-[#E89BA5] flex items-center justify-center shrink-0">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-900 dark:text-[#FAF6F3] truncate">
                            {currentSelectedFile
                              ? currentSelectedFile.name
                              : `Select your ${challenge.type === 'poster' ? 'poster' : 'essay'} file (.pdf or .docx)`}
                          </p>
                          <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            {currentSelectedFile
                              ? `${formatFileSize(currentSelectedFile.size)} · Ready to upload`
                              : `Supported formats: PDF (.pdf) or Word (.docx) · Max ${MAX_DOCUMENT_SIZE_MB} MB`}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {currentSelectedFile && (
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedFiles((prev) => ({ ...prev, [challenge.type]: null }))
                            }
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-[#3D1418] text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-white dark:hover:bg-[#150709] transition-colors cursor-pointer"
                            title="Remove selected file"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <label className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-[#4A181E] bg-white dark:bg-[#150709] hover:bg-slate-50 dark:hover:bg-[#240C10] text-slate-800 dark:text-[#FAF6F3] text-xs font-semibold cursor-pointer transition-colors inline-flex items-center gap-1.5">
                          <Upload className="w-3.5 h-3.5 text-burgundy dark:text-[#E89BA5]" />
                          <span>{currentSelectedFile ? 'Change File' : 'Choose File'}</span>
                          <input
                            type="file"
                            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                            onChange={(e) =>
                              handleFileSelect(e, challenge.type as 'poster' | 'essay')
                            }
                            className="sr-only"
                          />
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={isSubmittingComp[challenge.type] || !currentSelectedFile}
                      className="w-full sm:w-auto px-5 py-2.5 bg-burgundy hover:bg-burgundy-deep text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {isSubmittingComp[challenge.type] ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Uploading Document...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          <span>
                            {recordedSub ? 'Upload & Replace Submission' : 'Upload & Submit Document'}
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200">
                      {challenge.type === 'reels'
                        ? 'Instagram Reel or LinkedIn Video URL (Public)'
                        : 'Work URL (Public Link)'}
                    </label>
                    {challenge.type === 'reels' && (
                      <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400">
                        Instagram Reel or LinkedIn Post preferred
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="url"
                      value={competitionUrls[challenge.type] || ''}
                      onChange={(e) => {
                        setCompErrorMsg((prev) => ({ ...prev, [challenge.type]: '' }));
                        setCompetitionUrls((prev) => ({
                          ...prev,
                          [challenge.type]: e.target.value,
                        }));
                      }}
                      placeholder={challenge.urlPlaceholder}
                      required
                      className="flex-1 px-3 py-2 text-xs font-mono border border-slate-300 dark:border-[#3D1418] rounded-lg bg-white dark:bg-[#1C0A0D] text-slate-900 dark:text-[#FAF6F3] focus:outline-none focus:ring-1 focus:ring-burgundy"
                    />
                    <button
                      type="submit"
                      disabled={isSubmittingComp[challenge.type]}
                      className="px-4 py-2 bg-burgundy hover:bg-burgundy-deep text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
                    >
                      {isSubmittingComp[challenge.type] ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          <span>
                            {challenge.type === 'reels' &&
                            recordedSub?.submission_url &&
                            (recordedSub.submission_url.includes('drive.google.com') ||
                              recordedSub.submission_url.includes('drive.google'))
                              ? 'Update with Social Link'
                              : recordedSub
                              ? 'Update Link'
                              : 'Submit Link'}
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                  {challenge.type === 'reels' && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Accepted: Live Instagram Reel or LinkedIn Video link. Ensure your post is set to Public for evaluation.
                    </p>
                  )}
                </div>
              )}

              {compErrorMsg[challenge.type] && (
                <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-start gap-2 text-rose-800 dark:text-rose-200 text-xs font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
                  <span>{compErrorMsg[challenge.type]}</span>
                </div>
              )}

              {compSuccessMsg[challenge.type] && (
                <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center gap-2 text-emerald-800 dark:text-emerald-300 text-xs font-medium">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{compSuccessMsg[challenge.type]}</span>
                </div>
              )}

              {recordedSub && (
                <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-[#1C0A0D] border border-slate-200 dark:border-[#3D1418] text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start sm:items-center gap-2.5 min-w-0">
                    {isRecordedUploadedDoc ? (
                      <FileText className="w-4 h-4 text-burgundy dark:text-[#E89BA5] shrink-0 mt-0.5 sm:mt-0" />
                    ) : (
                      <Link2 className="w-4 h-4 text-burgundy dark:text-[#E89BA5] shrink-0 mt-0.5 sm:mt-0" />
                    )}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          Recorded Submission ({isRecordedUploadedDoc ? 'Uploaded Document' : 'Public Link'}):
                        </span>
                        {challenge.type === 'reels' &&
                          recordedSub.submission_url &&
                          (recordedSub.submission_url.includes('drive.google.com') ||
                            recordedSub.submission_url.includes('drive.google')) && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                              Google Drive (Needs Social Post URL)
                            </span>
                          )}
                      </div>
                      <span className="font-mono text-xs font-semibold text-slate-900 dark:text-[#FAF6F3] truncate block mt-0.5">
                        {recordedSub.submission_title || recordedSub.submission_url}
                      </span>
                    </div>
                  </div>
                  <a
                    href={recordedSub.submission_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-md bg-white dark:bg-[#150709] border border-slate-200 dark:border-[#3D1418] font-mono text-xs text-burgundy dark:text-[#E89BA5] font-semibold hover:underline inline-flex items-center gap-1.5 shrink-0 self-start sm:self-auto"
                  >
                    <span>{isRecordedUploadedDoc ? 'Open Document' : 'Open Link'}</span>
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                </div>
              )}
            </form>
          </div>
        </div>
      </div>
    );
  }

  // 2. Default state: Clean, high-density dashboard
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 font-sans space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-[#3D1418]">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-slate-900 dark:text-[#FAF6F3] tracking-tight">
            Learning Hub
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {sessionUser?.fullName ? `Welcome back, ${(sessionUser.fullName || '').split(' ')[0]}.` : 'Complete sessions sequentially.'}
          </p>
        </div>

        <button
          onClick={openCertificateModal}
          className={clsx(
            'px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 self-start sm:self-auto cursor-pointer border',
            isCertificateEligible
              ? 'bg-burgundy text-white hover:bg-burgundy-deep border-burgundy shadow-xs'
              : 'bg-slate-100 dark:bg-[#1C0A0D] text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#250D11] border-slate-200 dark:border-[#3D1418]'
          )}
        >
          {isCertificateEligible ? (
            <>
              <Award className="w-4 h-4 text-emerald-400" />
              <span>Certificate (Unlocked)</span>
            </>
          ) : (
            <>
              <Lock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
              <span>Certificate (Locked · {completedSessionsCount}/{totalSessionsCount} Videos, {passedQuizzesCount}/{totalSessionsCount} Quizzes)</span>
            </>
          )}
        </button>
      </div>

      {/* 3 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 bg-white dark:bg-[#150709] border border-slate-200 dark:border-[#3D1418] rounded-xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Lectures</span>
            <BookOpen className="w-4 h-4 text-burgundy dark:text-[#E89BA5]" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="font-serif text-2xl font-bold text-slate-900 dark:text-[#FAF6F3]">
              {completedSessionsCount}
            </span>
            <span className="text-xs text-slate-400">/ {totalSessionsCount}</span>
          </div>
          <div className="mt-2.5 w-full h-1 bg-slate-100 dark:bg-[#250D11] rounded-full overflow-hidden">
            <div
              className="h-full bg-burgundy dark:bg-[#E89BA5] rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, Math.round((completedSessionsCount / totalSessionsCount) * 100))}%` }}
            />
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-[#150709] border border-slate-200 dark:border-[#3D1418] rounded-xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Quizzes</span>
            <Award className="w-4 h-4 text-burgundy dark:text-[#E89BA5]" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="font-serif text-2xl font-bold text-slate-900 dark:text-[#FAF6F3]">
              {passedQuizzesCount}
            </span>
            <span className="text-xs text-slate-400">/ {totalSessionsCount}</span>
          </div>
          <div className="mt-2.5 w-full h-1 bg-slate-100 dark:bg-[#250D11] rounded-full overflow-hidden">
            <div
              className="h-full bg-burgundy dark:bg-[#E89BA5] rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, Math.round((passedQuizzesCount / totalSessionsCount) * 100))}%` }}
            />
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-[#150709] border border-slate-200 dark:border-[#3D1418] rounded-xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Challenges</span>
            <CheckCircle2 className="w-4 h-4 text-burgundy dark:text-[#E89BA5]" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="font-serif text-2xl font-bold text-slate-900 dark:text-[#FAF6F3]">
              {submittedCompsCount}
            </span>
            <span className="text-xs text-slate-400">/ 3</span>
          </div>
          <div className="mt-2.5 w-full h-1 bg-slate-100 dark:bg-[#250D11] rounded-full overflow-hidden">
            <div
              className="h-full bg-burgundy dark:bg-[#E89BA5] rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, Math.round((submittedCompsCount / 3) * 100))}%` }}
            />
          </div>
        </div>
      </div>

      {/* Python Coding Challenge in Qiskit Feature Card */}
      <div className="p-5 bg-gradient-to-r from-burgundy/10 via-burgundy/5 to-transparent dark:from-burgundy/25 dark:via-burgundy/10 dark:to-transparent border border-burgundy/30 dark:border-burgundy/40 rounded-xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] font-bold text-burgundy dark:text-[#E89BA5] uppercase tracking-wider px-2 py-0.5 rounded bg-burgundy/10 dark:bg-burgundy/20">
              Official Evaluation
            </span>
            <span className="font-mono text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
              9 Problems · 100 Points Total
            </span>
          </div>
          <h2 className="font-serif text-base sm:text-lg font-bold text-slate-900 dark:text-[#FAF6F3]">
            Python Coding Challenge in Qiskit
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-300 font-sans max-w-xl">
            Solve quantum programming problems using Python and Qiskit. Run your code against public tests, pass hidden tests, and earn points on the live leaderboard.
          </p>
        </div>

        <Link
          href="/learning/qiskit-challenge"
          className="px-4 py-2.5 bg-burgundy text-white hover:bg-burgundy-deep text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 shrink-0 shadow-sm"
        >
          <Terminal className="w-4 h-4" />
          <span>Enter Challenge</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Masterclass Certificate Status Card */}
      {isCertificateEligible ? (
        <div className="p-5 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/80 rounded-xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/40">
                Academic Requirements Met
              </span>
              <span className="font-mono text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                Payment Details Updating Soon
              </span>
            </div>
            <h2 className="font-serif text-base sm:text-lg font-bold text-slate-900 dark:text-[#FAF6F3]">
              Masterclass Certificate Unlocked
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-300 font-sans max-w-xl">
              You have completed all {totalSessionsCount} video lectures and passed every concept check quiz. Official UPI payment QR and bank transfer details are being updated by the organizing team.
            </p>
          </div>

          <button
            onClick={openCertificateModal}
            className="px-4 py-2.5 bg-burgundy text-white hover:bg-burgundy-deep text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 shrink-0 shadow-xs cursor-pointer"
          >
            <Award className="w-4 h-4" />
            <span>Claim Certificate</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div className="p-4 sm:p-5 bg-white dark:bg-[#150709] border border-slate-200 dark:border-[#3D1418] rounded-xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 dark:bg-[#1C0A0D]">
                Official Certificate
              </span>
              <span className="font-mono text-[10px] font-bold text-burgundy dark:text-[#E89BA5]">
                {completedSessionsCount + passedQuizzesCount} / {totalSessionsCount * 2} Tasks Complete
              </span>
            </div>
            <h2 className="font-serif text-base sm:text-lg font-bold text-slate-900 dark:text-[#FAF6F3]">
              IBM Quantum Masterclass Certificate
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 font-sans max-w-xl">
              Watch all {totalSessionsCount} video lectures ({completedSessionsCount}/{totalSessionsCount}) and pass all {totalSessionsCount} concept check quizzes ({passedQuizzesCount}/{totalSessionsCount}) to unlock your official co-certified digital certificate.
            </p>
          </div>

          <button
            onClick={openCertificateModal}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-[#1C0A0D] dark:hover:bg-[#250D11] text-slate-800 dark:text-[#FAF6F3] border border-slate-200 dark:border-[#3D1418] text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5 text-slate-400" />
            <span>Check Requirements</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Quick Resume Card */}
      {nextSession && (
        <div className="p-5 bg-white dark:bg-[#150709] border border-slate-200 dark:border-[#3D1418] rounded-xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="font-mono text-[10px] font-bold text-burgundy dark:text-[#E89BA5] uppercase tracking-wider block">
              Up Next · Day {nextSession.day}
            </span>
            <h2 className="font-serif text-base sm:text-lg font-bold text-slate-900 dark:text-[#FAF6F3]">
              Session {nextSession.sessionNumber}: {nextSession.title}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-sans">
              {nextSession.duration} · {nextSession.speaker?.name} ({nextSession.speaker?.institution})
            </p>
          </div>

          <Link
            href={`/learning/session/${nextSession.id}`}
            className="px-4 py-2.5 bg-slate-900 dark:bg-burgundy text-white hover:bg-slate-800 dark:hover:bg-burgundy-deep text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 shrink-0"
          >
            <PlayCircle className="w-4 h-4" />
            <span>Open Session</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* Curriculum Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Curriculum Sessions ({totalSessionsCount})
          </h3>
          <span className="font-mono text-[11px] text-slate-400 dark:text-slate-500">
            {completedSessionsCount} Watched · {passedQuizzesCount} Quizzes Passed
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {curriculumList.map((s) => {
            const p = progress[s.id];
            const isVideoDone = Boolean(p?.videoCompleted);
            const isQuizDone = Boolean(p?.quizPassed);
            const isDone = isVideoDone && isQuizDone;
            const isQuizLocked = Boolean(quizzes?.[s.id]?.isLocked);
            const hasTranscript = Boolean(SESSION_TRANSCRIPTS[s.id]);
            const qCount = quizzes?.[s.id]?.questions?.length || 0;

            return (
              <div
                key={s.id}
                className="p-3.5 bg-white dark:bg-[#150709] border border-slate-200 dark:border-[#3D1418] rounded-xl hover:border-burgundy/40 dark:hover:border-[#E89BA5]/40 transition-colors flex flex-col justify-between gap-3 group"
              >
                <Link href={`/learning/session/${s.id}`} className="flex items-start justify-between gap-2 min-w-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[10px] font-bold text-burgundy dark:text-[#E89BA5] uppercase">
                        Day {s.day} · Session {s.sessionNumber}
                      </span>
                      {hasTranscript && (
                        <span className="font-mono text-[9px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/70">
                          Transcript & Study Guide
                        </span>
                      )}
                    </div>
                    <h4 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-[#FAF6F3] group-hover:text-burgundy dark:group-hover:text-[#E89BA5] transition-colors line-clamp-2 mt-1">
                      {s.title}
                    </h4>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-1 truncate">
                      {s.duration} · {s.speaker?.name}
                    </span>
                  </div>
                  {isDone ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <Clock className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0 mt-0.5" />
                  )}
                </Link>

                <div className="pt-2.5 border-t border-slate-100 dark:border-[#250D11] flex items-center justify-between gap-2 text-[11px] font-mono">
                  <div className="flex items-center gap-2">
                    {isVideoDone ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span>Watched</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400">
                        <Clock className="w-3.5 h-3.5 shrink-0" />
                        <span>Unwatched</span>
                      </span>
                    )}
                    <span className="text-slate-300 dark:text-slate-700">·</span>
                    <Link
                      href={`/learning/session/${s.id}`}
                      className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-400 hover:text-burgundy dark:hover:text-[#E89BA5] transition-colors underline-offset-2 hover:underline font-semibold"
                    >
                      <PlayCircle className="w-3 h-3 shrink-0" />
                      <span>{isVideoDone ? 'Review' : 'Watch'}</span>
                    </Link>
                  </div>

                  <Link
                    href={`/learning/session/${s.id}/quiz`}
                    className={clsx(
                      'inline-flex items-center gap-1 px-2 py-0.5 rounded font-semibold transition-colors border',
                      isQuizDone
                        ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/80'
                        : isQuizLocked
                        ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60'
                        : 'bg-burgundy/10 dark:bg-burgundy/20 text-burgundy dark:text-[#E89BA5] border-burgundy/20 dark:border-burgundy/40 hover:bg-burgundy hover:text-white'
                    )}
                  >
                    {isQuizDone ? (
                      <>
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Quiz {p?.quizScore ?? 100}%</span>
                      </>
                    ) : isQuizLocked ? (
                      <>
                        <Lock className="w-2.5 h-2.5" />
                        <span>Quiz Soon</span>
                      </>
                    ) : (
                      <>
                        <Award className="w-3 h-3" />
                        <span>Take Quiz{qCount > 0 ? ` (${qCount} Qs)` : ''}</span>
                      </>
                    )}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Daily Creative Challenges Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Daily Creative Challenges (3)
          </h3>
          <span className="font-mono text-[11px] text-slate-400 dark:text-slate-500">
            {submittedCompsCount} / 3 Submitted
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {Object.values(DAILY_COMPETITIONS).map((comp) => {
            const sub = competitions[comp.type];
            const isSubmitted = Boolean(sub);
            const supportsDoc =
              comp.submissionType === 'url_or_document' ||
              comp.type === 'poster' ||
              comp.type === 'essay';
            return (
              <Link
                key={comp.day}
                href={`/learning?challenge=${comp.day}`}
                className="p-3.5 bg-white dark:bg-[#150709] border border-slate-200 dark:border-[#3D1418] rounded-xl hover:border-burgundy/40 dark:hover:border-[#E89BA5]/40 transition-colors flex flex-col justify-between gap-2.5 group"
              >
                <div>
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="font-mono text-[10px] font-bold text-burgundy dark:text-[#E89BA5] uppercase">
                      Day 0{comp.day} · {comp.prize}
                    </span>
                    {isSubmitted ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    ) : (
                      <Trophy className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    )}
                  </div>
                  <h4 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-[#FAF6F3] group-hover:text-burgundy dark:group-hover:text-[#E89BA5] transition-colors mt-1 line-clamp-1">
                    {comp.title}
                  </h4>
                  <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5 truncate">
                    {isSubmitted && sub?.submission_title
                      ? `File: ${sub.submission_title}`
                      : supportsDoc
                      ? 'Accepts .pdf, .docx, or URL'
                      : 'Accepts Public Video URL'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] font-mono pt-2 border-t border-slate-100 dark:border-[#250D11]">
                  <span
                    className={clsx(
                      'font-semibold',
                      isSubmitted
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-burgundy dark:text-[#E89BA5]'
                    )}
                  >
                    {isSubmitted ? 'Submitted' : 'Submit Entry'}
                  </span>
                  <ArrowRight className="w-3 h-3 text-slate-400 group-hover:text-burgundy dark:group-hover:text-[#E89BA5] transition-colors" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Official 3-Day Programme Schedule (8–10 October 2026) */}
      <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-[#3D1418]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-burgundy dark:text-[#E89BA5]" />
              <h3 className="font-serif text-lg font-bold text-slate-900 dark:text-[#FAF6F3]">
                Official 3-Day Programme Schedule
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              SRM AP Partner Plus · Qiskit Fall Fest 2026 Online Phase (8–10 October 2026)
            </p>
          </div>

          {/* Day Fast Switcher Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-[#1C0A0D] rounded-lg border border-slate-200 dark:border-[#3D1418] self-start sm:self-auto">
            {ONLINE_PROGRAMME_SCHEDULE.map((prog) => (
              <button
                key={prog.day}
                type="button"
                onClick={() => setSelectedScheduleDay(prog.day)}
                className={clsx(
                  'px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer',
                  selectedScheduleDay === prog.day
                    ? 'bg-white dark:bg-burgundy text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                )}
              >
                Day {prog.day} ({prog.weekday.slice(0, 3)})
              </button>
            ))}
          </div>
        </div>

        {/* Selected Day Programme Timetable */}
        {currentDayProgramme && (
          <div className="bg-white dark:bg-[#150709] border border-slate-200 dark:border-[#3D1418] rounded-xl overflow-hidden shadow-xs">
            <div className="px-4 py-3 bg-slate-50/80 dark:bg-[#1C0A0D]/80 border-b border-slate-200 dark:border-[#3D1418] flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="font-mono text-[10px] font-bold text-burgundy dark:text-[#E89BA5] uppercase tracking-wider block">
                  {currentDayProgramme.theme}
                </span>
                <span className="text-xs font-semibold text-slate-800 dark:text-[#FAF6F3]">
                  {currentDayProgramme.dateStr}
                </span>
              </div>
              <span className="font-mono text-xs font-medium text-slate-500 dark:text-slate-400 px-2.5 py-0.5 rounded-full bg-slate-200/60 dark:bg-[#2A0E12]">
                {currentDayProgramme.timeRange}
              </span>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-[#220B0F]">
              {currentDayProgramme.items.map((item, idx) => {
                const isSession = item.type === 'session';
                const isQuiz = item.type === 'quiz';
                const isCompetition = item.type === 'competition';
                const isBreak = item.type === 'break';
                const isInauguration = item.type === 'inauguration';
                const isCeremony = item.type === 'ceremony';

                return (
                  <div
                    key={idx}
                    className={clsx(
                      'p-3.5 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 transition-colors',
                      isBreak
                        ? 'bg-emerald-50/40 dark:bg-emerald-950/20'
                        : isSession
                        ? 'hover:bg-slate-50/80 dark:hover:bg-[#1C0A0D]/60'
                        : 'hover:bg-slate-50/50 dark:hover:bg-[#1C0A0D]/40'
                    )}
                  >
                    {/* Time & Duration */}
                    <div className="flex md:flex-col items-center md:items-start justify-between md:justify-center gap-1 shrink-0 md:w-36">
                      <span className="font-mono text-xs font-bold text-slate-900 dark:text-[#FAF6F3]">
                        {item.time}
                      </span>
                      <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                        {item.duration}
                      </span>
                    </div>

                    {/* Details & Speaker Info */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {isInauguration && (
                          <span className="px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-mono text-[9px] font-bold uppercase tracking-wider border border-indigo-200/60 dark:border-indigo-900/60">
                            Inaugural Address
                          </span>
                        )}
                        {isSession && (
                          <span className="px-2 py-0.5 rounded bg-burgundy/10 text-burgundy dark:bg-burgundy/25 dark:text-[#E89BA5] font-mono text-[9px] font-bold uppercase tracking-wider border border-burgundy/20 dark:border-burgundy/40">
                            Lecture Session
                          </span>
                        )}
                        {isBreak && (
                          <span className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-mono text-[9px] font-bold uppercase tracking-wider border border-emerald-200 dark:border-emerald-900">
                            Midday Break
                          </span>
                        )}
                        {isQuiz && (
                          <span className="px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-mono text-[9px] font-bold uppercase tracking-wider border border-amber-200 dark:border-amber-900">
                            LMS Assessment
                          </span>
                        )}
                        {isCompetition && (
                          <span className="px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 font-mono text-[9px] font-bold uppercase tracking-wider border border-purple-200 dark:border-purple-900">
                            Daily Online Game
                          </span>
                        )}
                        {isCeremony && (
                          <span className="px-2 py-0.5 rounded bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 font-mono text-[9px] font-bold uppercase tracking-wider border border-sky-200 dark:border-sky-900">
                            Ceremony & Release
                          </span>
                        )}
                        <h4 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-[#FAF6F3]">
                          {item.title}
                        </h4>
                      </div>

                      {item.speaker && item.speaker !== '—' && (
                        <div className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {item.speaker}
                          </span>
                          {item.speakerRole && (
                            <>
                              <span className="text-slate-400">·</span>
                              <span className="text-slate-500 dark:text-slate-400">
                                {item.speakerRole}
                              </span>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Action Quick Link */}
                    <div className="shrink-0 flex flex-wrap items-center gap-2 pt-1 md:pt-0">
                      {item.sessionId && !isQuiz && (
                        <>
                          <Link
                            href={`/learning/session/${item.sessionId}`}
                            className="px-3 py-1.5 rounded-lg bg-burgundy/10 text-burgundy dark:bg-burgundy/25 dark:text-[#E89BA5] hover:bg-burgundy hover:text-white dark:hover:bg-burgundy-deep text-xs font-semibold transition-colors flex items-center gap-1"
                          >
                            <span>Session Video</span>
                            <ArrowRight className="w-3 h-3" />
                          </Link>
                          <Link
                            href={`/learning/session/${item.sessionId}/quiz`}
                            className="px-2.5 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 hover:bg-amber-600 hover:text-white text-xs font-semibold transition-colors flex items-center gap-1 border border-amber-200 dark:border-amber-900"
                          >
                            {quizzes[item.sessionId]?.isLocked ? (
                              <Lock className="w-3 h-3" />
                            ) : (
                              <Award className="w-3 h-3" />
                            )}
                            <span>Quiz</span>
                          </Link>
                        </>
                      )}
                      {isQuiz && (
                        <Link
                          href={`/learning/session/${item.sessionId || 'session-1'}/quiz`}
                          className="px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 hover:bg-amber-600 hover:text-white text-xs font-semibold transition-colors flex items-center gap-1 border border-amber-200 dark:border-amber-900"
                        >
                          <Award className="w-3 h-3" />
                          <span>Concept Quiz</span>
                        </Link>
                      )}
                      {isCompetition && (
                        <Link
                          href={`/learning?challenge=${currentDayProgramme.day}`}
                          className="px-3 py-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/50 text-purple-800 dark:text-purple-300 hover:bg-purple-600 hover:text-white text-xs font-semibold transition-colors flex items-center gap-1 border border-purple-200 dark:border-purple-900"
                        >
                          <Send className="w-3 h-3" />
                          <span>Submit Work</span>
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function LearningDashboardPage() {
  return (
    <AuthGate>
      <Suspense fallback={<div className="p-8 text-center text-xs text-slate-500">Loading...</div>}>
        <LearningDashboardContent />
      </Suspense>
    </AuthGate>
  );
}
