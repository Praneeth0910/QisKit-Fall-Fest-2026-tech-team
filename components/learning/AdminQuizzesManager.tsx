'use client';

import React, { useState, useEffect } from 'react';
import { useQuizzes } from '@/hooks/use-quizzes';
import { CURRICULUM_SESSIONS } from '@/data/learning/curriculum';
import { SessionQuiz, QuizQuestion } from '@/data/learning/types';
import {
  Award,
  Lock,
  Unlock,
  Plus,
  Trash2,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Clock,
  Eye,
  ArrowUp,
  ArrowDown,
  Sliders,
  Check,
  X,
  Loader2,
  FileQuestion,
} from 'lucide-react';
import clsx from 'clsx';

export function AdminQuizzesManager() {
  // Use admin query to fetch all quizzes with questions even when locked
  const { quizzes, overrides, mutate } = useQuizzes({ admin: true });

  const [selectedSessionId, setSelectedSessionId] = useState<string>('session-1');

  // Form state for currently edited quiz
  const [formData, setFormData] = useState<{
    title: string;
    passingScore: number;
    isLocked: boolean;
    questions: QuizQuestion[];
  }>({
    title: '',
    passingScore: 75,
    isLocked: false,
    questions: [],
  });

  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isTogglingLock, setIsTogglingLock] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [statusIsError, setStatusIsError] = useState(false);
  const [showStudentPreview, setShowStudentPreview] = useState(false);

  // Sync form when selected session or quizzes change
  useEffect(() => {
    const currentQuiz = quizzes[selectedSessionId];

    if (currentQuiz) {
      setFormData({
        title: currentQuiz.title || `Session ${selectedSessionId} Concept Check`,
        passingScore: currentQuiz.passingScore || 75,
        isLocked: Boolean(currentQuiz.isLocked),
        questions: currentQuiz.questions ? JSON.parse(JSON.stringify(currentQuiz.questions)) : [],
      });
      setStatusMsg('');
    }
  }, [selectedSessionId, quizzes]);

  const currentSessionMeta = CURRICULUM_SESSIONS.find((s) => s.id === selectedSessionId);
  const currentOverride = overrides[selectedSessionId] || null;
  const isCustomized = Boolean(currentOverride);

  // Quick Lock/Unlock Toggle
  async function handleQuickToggleLock() {
    try {
      setIsTogglingLock(true);
      setStatusMsg('');
      setStatusIsError(false);

      const nextLockState = !formData.isLocked;

      const res = await fetch('/api/learning/quizzes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: selectedSessionId,
          toggleLock: true,
          isLocked: nextLockState,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setFormData((prev) => ({ ...prev, isLocked: nextLockState }));
        setStatusMsg(
          nextLockState
            ? `Locked quiz for ${selectedSessionId}! Students now see 'Coming Soon'.`
            : `Unlocked quiz for ${selectedSessionId}! It is now LIVE for students.`
        );
        setStatusIsError(false);
        await mutate();
      } else {
        setStatusMsg(data.error || 'Failed to toggle lock status');
        setStatusIsError(true);
      }
    } catch (err: any) {
      console.error('Error toggling quiz lock:', err);
      setStatusMsg(err?.message || 'Error communicating with server');
      setStatusIsError(true);
    } finally {
      setIsTogglingLock(false);
    }
  }

  // Save changes
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();

    // Client-side validations
    if (!formData.title.trim()) {
      setStatusMsg('Quiz title cannot be empty.');
      setStatusIsError(true);
      return;
    }

    if (formData.questions.length === 0) {
      setStatusMsg('A quiz must have at least one question.');
      setStatusIsError(true);
      return;
    }

    for (let i = 0; i < formData.questions.length; i++) {
      const q = formData.questions[i];
      if (!q.question.trim()) {
        setStatusMsg(`Question #${i + 1} text is empty.`);
        setStatusIsError(true);
        return;
      }
      if (q.options.length < 2) {
        setStatusMsg(`Question #${i + 1} must have at least 2 options.`);
        setStatusIsError(true);
        return;
      }
      if (q.options.some((opt) => !opt.trim())) {
        setStatusMsg(`Question #${i + 1} has blank option choices.`);
        setStatusIsError(true);
        return;
      }
      if (
        typeof q.correctIndex !== 'number' ||
        q.correctIndex < 0 ||
        q.correctIndex >= q.options.length
      ) {
        setStatusMsg(`Question #${i + 1} does not have a valid correct answer choice.`);
        setStatusIsError(true);
        return;
      }
    }

    try {
      setIsSaving(true);
      setStatusMsg('');
      setStatusIsError(false);

      const updates: Partial<SessionQuiz> = {
        title: formData.title.trim(),
        passingScore: Number(formData.passingScore) || 75,
        isLocked: formData.isLocked,
        questions: formData.questions,
      };

      const res = await fetch('/api/learning/quizzes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: selectedSessionId,
          updates,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setStatusMsg(`Successfully saved quiz updates for ${selectedSessionId}! Changes synced to Redis & DB.`);
        setStatusIsError(false);
        await mutate();
      } else {
        setStatusMsg(data.error || 'Failed to update quiz');
        setStatusIsError(true);
      }
    } catch (err: any) {
      console.error('Error saving quiz updates:', err);
      setStatusMsg(err?.message || 'Error communicating with server');
      setStatusIsError(true);
    } finally {
      setIsSaving(false);
    }
  }

  // Revert / Reset to Default Static Quiz
  async function handleReset() {
    if (!window.confirm(`Are you sure you want to revert ${selectedSessionId} quiz to default static curriculum questions? All custom edits for this quiz will be deleted.`)) {
      return;
    }

    try {
      setIsResetting(true);
      setStatusMsg('');
      setStatusIsError(false);

      const res = await fetch('/api/learning/quizzes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: selectedSessionId,
          reset: true,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setStatusMsg(`Reverted ${selectedSessionId} to default curriculum questions.`);
        setStatusIsError(false);
        await mutate();
      } else {
        setStatusMsg(data.error || 'Failed to revert quiz');
        setStatusIsError(true);
      }
    } catch (err: any) {
      console.error('Error resetting quiz:', err);
      setStatusMsg(err?.message || 'Error communicating with server');
      setStatusIsError(true);
    } finally {
      setIsResetting(false);
    }
  }

  // Question manipulation helpers
  function handleAddQuestion() {
    const newId = `${selectedSessionId}-q${formData.questions.length + 1}-${Date.now().toString(36)}`;
    const newQuestion: QuizQuestion = {
      id: newId,
      question: 'New question prompt...',
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      correctIndex: 0,
      explanation: 'Explanation of the correct answer...',
    };

    setFormData((prev) => ({
      ...prev,
      questions: [...prev.questions, newQuestion],
    }));
  }

  function handleDeleteQuestion(index: number) {
    if (formData.questions.length <= 1) {
      alert('A quiz must have at least one question.');
      return;
    }
    setFormData((prev) => ({
      ...prev,
      questions: prev.questions.filter((_, i) => i !== index),
    }));
  }

  function handleMoveQuestion(index: number, direction: 'up' | 'down') {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= formData.questions.length) return;

    const updated = [...formData.questions];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;

    setFormData((prev) => ({ ...prev, questions: updated }));
  }

  function handleQuestionChange(index: number, field: keyof QuizQuestion, value: any) {
    setFormData((prev) => {
      const updated = [...prev.questions];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, questions: updated };
    });
  }

  function handleOptionChange(qIndex: number, optIndex: number, text: string) {
    setFormData((prev) => {
      const updatedQuestions = [...prev.questions];
      const updatedOptions = [...updatedQuestions[qIndex].options];
      updatedOptions[optIndex] = text;
      updatedQuestions[qIndex] = {
        ...updatedQuestions[qIndex],
        options: updatedOptions,
      };
      return { ...prev, questions: updatedQuestions };
    });
  }

  function handleAddOption(qIndex: number) {
    if (formData.questions[qIndex].options.length >= 6) {
      alert('Maximum 6 options allowed per question.');
      return;
    }
    setFormData((prev) => {
      const updatedQuestions = [...prev.questions];
      const updatedOptions = [
        ...updatedQuestions[qIndex].options,
        `Option ${String.fromCharCode(65 + updatedQuestions[qIndex].options.length)}`,
      ];
      updatedQuestions[qIndex] = {
        ...updatedQuestions[qIndex],
        options: updatedOptions,
      };
      return { ...prev, questions: updatedQuestions };
    });
  }

  function handleDeleteOption(qIndex: number, optIndex: number) {
    if (formData.questions[qIndex].options.length <= 2) {
      alert('A question must have at least 2 options.');
      return;
    }
    setFormData((prev) => {
      const updatedQuestions = [...prev.questions];
      const currentOptions = updatedQuestions[qIndex].options;
      const currentCorrect = updatedQuestions[qIndex].correctIndex ?? 0;

      const newOptions = currentOptions.filter((_, i) => i !== optIndex);
      let newCorrect = currentCorrect;
      if (optIndex === currentCorrect) {
        newCorrect = 0; // Reset to first option if deleted
      } else if (optIndex < currentCorrect) {
        newCorrect = currentCorrect - 1;
      }

      updatedQuestions[qIndex] = {
        ...updatedQuestions[qIndex],
        options: newOptions,
        correctIndex: newCorrect,
      };
      return { ...prev, questions: updatedQuestions };
    });
  }

  // Count metrics
  const totalQuizzes = Object.keys(quizzes).length || CURRICULUM_SESSIONS.length;
  const lockedCount = Object.values(quizzes).filter((q) => q.isLocked).length;
  const unlockedCount = Math.max(0, totalQuizzes - lockedCount);
  const customizedCount = Object.keys(overrides).length;

  return (
    <div className="space-y-6">
      {/* Header and Summary Bar */}
      <div className="bg-white dark:bg-[#150709] border border-slate-200 dark:border-[#3D1418] rounded-xl p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-lg bg-burgundy/10 dark:bg-burgundy/20 text-burgundy dark:text-[#E89BA5]">
                <FileQuestion className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-[#FAF6F3]">
                  Concept Quizzes & Assessment Manager
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Update questions, multiple-choice options, correct answers, and toggle lock status with instant student &apos;Coming Soon&apos; gating.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-[#1C0A0D] border border-slate-200 dark:border-[#3D1418] text-xs font-mono">
              <span className="text-slate-500">Live Quizzes: </span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">{unlockedCount}</span>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-[#1C0A0D] border border-slate-200 dark:border-[#3D1418] text-xs font-mono">
              <span className="text-slate-500">Locked (Soon): </span>
              <span className="font-bold text-amber-600 dark:text-amber-400">{lockedCount}</span>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-[#1C0A0D] border border-slate-200 dark:border-[#3D1418] text-xs font-mono">
              <span className="text-slate-500">Customized: </span>
              <span className="font-bold text-burgundy dark:text-[#E89BA5]">{customizedCount}</span>
            </div>
          </div>
        </div>

        {/* Status Alert Banner */}
        {statusMsg && (
          <div
            className={`mt-4 p-3.5 rounded-lg text-xs flex items-center justify-between gap-2 transition-all ${
              statusIsError
                ? 'bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200'
                : 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {statusIsError ? (
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              ) : (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              )}
              <span className="font-medium">{statusMsg}</span>
            </div>
            <button
              onClick={() => setStatusMsg('')}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Session Navigation Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        {CURRICULUM_SESSIONS.map((s) => {
          const isSelected = s.id === selectedSessionId;
          const sQuiz = quizzes[s.id];
          const isSessLocked = Boolean(sQuiz?.isLocked);
          const hasOverride = Boolean(overrides[s.id]);

          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setSelectedSessionId(s.id)}
              className={clsx(
                'flex flex-col text-left p-3 rounded-xl border transition-all text-xs cursor-pointer',
                isSelected
                  ? 'border-burgundy dark:border-[#E89BA5] bg-burgundy/5 dark:bg-burgundy/20 shadow-xs'
                  : 'border-slate-200 dark:border-[#3D1418] bg-white dark:bg-[#150709] hover:bg-slate-50 dark:hover:bg-[#1C0A0D]'
              )}
            >
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className="font-mono font-bold text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Day 0{s.day} · S0{s.sessionNumber}
                </span>
                {isSessLocked ? (
                  <span className="inline-flex items-center gap-0.5 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400">
                    <Lock className="w-2.5 h-2.5" />
                    Locked
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-0.5 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="w-2.5 h-2.5" />
                    Live
                  </span>
                )}
              </div>
              <span className="font-semibold text-slate-800 dark:text-[#FAF6F3] line-clamp-1 leading-snug">
                {s.title}
              </span>
              <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 mt-1 font-mono">
                <span>{sQuiz?.questions?.length || 0} questions</span>
                {hasOverride && (
                  <span className="text-burgundy dark:text-[#E89BA5] font-semibold">Custom</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Main Editing Area */}
      <form onSubmit={handleSave} className="space-y-6">
        {/* Top Control Bar: Master Lock/Unlock Switch & Actions */}
        <div className="bg-white dark:bg-[#150709] border border-slate-200 dark:border-[#3D1418] rounded-xl p-5 sm:p-6 shadow-xs">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Lock status banner & quick toggle */}
            <div className="flex items-center gap-3">
              <div
                className={clsx(
                  'w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border transition-colors',
                  formData.isLocked
                    ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400'
                    : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400'
                )}
              >
                {formData.isLocked ? (
                  <Lock className="w-6 h-6 animate-pulse" />
                ) : (
                  <Unlock className="w-6 h-6" />
                )}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={clsx(
                      'text-xs font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full',
                      formData.isLocked
                        ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                        : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                    )}
                  >
                    {formData.isLocked ? 'Quiz Locked (Coming Soon Mode)' : 'Quiz Live & Unlocked'}
                  </span>
                  {isCustomized && (
                    <span className="text-[10px] font-mono text-burgundy dark:text-[#E89BA5] bg-burgundy/10 dark:bg-burgundy/20 px-2 py-0.5 rounded">
                      Overridden
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xl">
                  {formData.isLocked
                    ? "When locked, students CANNOT view questions or submit answers. The quiz page displays a 'Coming Soon' holding state."
                    : 'When unlocked, registered students can view questions, submit answers, and receive instant grading.'}
                </p>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleQuickToggleLock}
                disabled={isTogglingLock}
                className={clsx(
                  'px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer border',
                  formData.isLocked
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600'
                    : 'bg-amber-500 hover:bg-amber-600 text-white border-amber-500'
                )}
              >
                {isTogglingLock ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : formData.isLocked ? (
                  <Unlock className="w-3.5 h-3.5" />
                ) : (
                  <Lock className="w-3.5 h-3.5" />
                )}
                {formData.isLocked ? 'Unlock Quiz (Go Live)' : 'Lock Quiz (Coming Soon)'}
              </button>

              <button
                type="button"
                onClick={() => setShowStudentPreview(!showStudentPreview)}
                className="px-3.5 py-2 rounded-lg text-xs font-semibold border border-slate-200 dark:border-[#3D1418] bg-slate-100 dark:bg-[#1C0A0D] text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#250D11] transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
                {showStudentPreview ? 'Hide Preview' : 'Preview Student View'}
              </button>

              {isCustomized && (
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={isResetting}
                  className="px-3.5 py-2 rounded-lg text-xs font-semibold border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  {isResetting ? 'Reverting...' : 'Revert to Default'}
                </button>
              )}

              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2 rounded-lg text-xs font-semibold bg-burgundy hover:bg-burgundy-deep text-white transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
              >
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                {isSaving ? 'Saving...' : 'Save Quiz Changes'}
              </button>
            </div>
          </div>
        </div>

        {/* Live Student Preview Card (Optional Toggle) */}
        {showStudentPreview && (
          <div className="bg-slate-50 dark:bg-[#100405] border-2 border-dashed border-burgundy/40 dark:border-burgundy/60 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-burgundy dark:text-[#E89BA5] flex items-center gap-1.5">
                <Eye className="w-4 h-4" />
                Student View Simulation ({formData.isLocked ? 'LOCKED / COMING SOON' : 'UNLOCKED / ACTIVE'})
              </span>
              <button
                type="button"
                onClick={() => setShowStudentPreview(false)}
                className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              >
                Close Preview
              </button>
            </div>

            {formData.isLocked ? (
              <div className="bg-white dark:bg-[#150709] border border-amber-200 dark:border-amber-900/60 p-6 rounded-xl text-center space-y-2 max-w-md mx-auto">
                <Lock className="w-8 h-8 text-amber-500 mx-auto" />
                <h4 className="font-serif font-bold text-slate-900 dark:text-[#FAF6F3]">
                  {formData.title}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  This concept check quiz is currently locked by the organizers and will be unlocked soon.
                </p>
                <div className="inline-block font-mono text-[10px] uppercase font-bold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/80 px-2 py-0.5 rounded">
                  Coming Soon
                </div>
              </div>
            ) : (
              <div className="bg-white dark:bg-[#150709] border border-slate-200 dark:border-[#3D1418] p-5 rounded-xl space-y-4">
                <div className="border-b border-slate-200 dark:border-[#3D1418] pb-3">
                  <h4 className="font-serif font-bold text-base text-slate-900 dark:text-[#FAF6F3]">
                    {formData.title}
                  </h4>
                  <span className="text-xs font-mono text-slate-500">
                    Passing requirement: {formData.passingScore}% · {formData.questions.length} questions
                  </span>
                </div>
                <div className="space-y-3">
                  {formData.questions.map((q, idx) => (
                    <div key={idx} className="p-3 bg-slate-50 dark:bg-[#1C0A0D] rounded-lg text-xs space-y-2">
                      <p className="font-semibold text-slate-800 dark:text-[#FAF6F3]">
                        Q{idx + 1}. {q.question}
                      </p>
                      <div className="space-y-1 pl-2">
                        {q.options.map((opt, oIdx) => (
                          <div
                            key={oIdx}
                            className={clsx(
                              'p-2 rounded border text-xs flex items-center justify-between',
                              oIdx === q.correctIndex
                                ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-300 font-medium'
                                : 'bg-white dark:bg-[#150709] border-slate-200 dark:border-[#3D1418] text-slate-600 dark:text-slate-400'
                            )}
                          >
                            <span>{opt}</span>
                            {oIdx === q.correctIndex && (
                              <span className="text-[10px] font-mono text-emerald-600 font-bold">
                                (Correct Answer)
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Quiz Metadata Config Card */}
        <div className="bg-white dark:bg-[#150709] border border-slate-200 dark:border-[#3D1418] rounded-xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-[#3D1418] pb-3">
            <Sliders className="w-4 h-4 text-burgundy dark:text-[#E89BA5]" />
            <h3 className="font-bold text-sm text-slate-900 dark:text-[#FAF6F3]">
              Quiz Configuration: {currentSessionMeta?.title || selectedSessionId}
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Quiz Title
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Session Concept Check Quiz Title"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-[#3D1418] bg-slate-50 dark:bg-[#1C0A0D] text-slate-900 dark:text-[#FAF6F3] focus:outline-none focus:ring-1 focus:ring-burgundy"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Passing Threshold (%)
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={formData.passingScore}
                onChange={(e) =>
                  setFormData({ ...formData, passingScore: Math.max(1, Math.min(100, Number(e.target.value) || 75)) })
                }
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-[#3D1418] bg-slate-50 dark:bg-[#1C0A0D] text-slate-900 dark:text-[#FAF6F3] focus:outline-none focus:ring-1 focus:ring-burgundy"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Minimum score percentage required to pass session (Default: 75%).
              </span>
            </div>
          </div>
        </div>

        {/* Questions Editor Card */}
        <div className="bg-white dark:bg-[#150709] border border-slate-200 dark:border-[#3D1418] rounded-xl p-5 sm:p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-[#3D1418] pb-4">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-[#FAF6F3]">
                Quiz Questions ({formData.questions.length})
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Each question requires at least 2 choices. Select the radio button to designate the correct answer.
              </p>
            </div>

            <button
              type="button"
              onClick={handleAddQuestion}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-burgundy/10 dark:bg-burgundy/20 hover:bg-burgundy/20 text-burgundy dark:text-[#E89BA5] transition-colors flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Question
            </button>
          </div>

          {/* List of Question Cards */}
          <div className="space-y-6">
            {formData.questions.map((q, qIndex) => (
              <div
                key={q.id || qIndex}
                className="p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-[#3D1418] bg-slate-50/60 dark:bg-[#1C0A0D]/60 space-y-4 transition-all"
              >
                {/* Question Header & Order Controls */}
                <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 dark:border-[#3D1418] pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-burgundy text-white font-mono text-xs font-bold flex items-center justify-center">
                      {qIndex + 1}
                    </span>
                    <span className="text-xs font-bold text-slate-800 dark:text-[#FAF6F3]">
                      Question #{qIndex + 1}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={qIndex === 0}
                      onClick={() => handleMoveQuestion(qIndex, 'up')}
                      title="Move Question Up"
                      className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      disabled={qIndex === formData.questions.length - 1}
                      onClick={() => handleMoveQuestion(qIndex, 'down')}
                      title="Move Question Down"
                      className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteQuestion(qIndex)}
                      title="Delete Question"
                      className="p-1 rounded text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer ml-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Question Text */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Question Prompt
                  </label>
                  <textarea
                    rows={2}
                    value={q.question}
                    onChange={(e) => handleQuestionChange(qIndex, 'question', e.target.value)}
                    placeholder="Enter the question prompt here..."
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-[#3D1418] bg-white dark:bg-[#150709] text-slate-900 dark:text-[#FAF6F3] focus:outline-none focus:ring-1 focus:ring-burgundy"
                  />
                </div>

                {/* Options List */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Answer Choices (Pick the radio button for the correct answer)
                    </label>
                    <button
                      type="button"
                      onClick={() => handleAddOption(qIndex)}
                      className="text-[11px] text-burgundy dark:text-[#E89BA5] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" /> Add Choice
                    </button>
                  </div>

                  <div className="space-y-2">
                    {q.options.map((opt, optIndex) => {
                      const isCorrect = q.correctIndex === optIndex;
                      return (
                        <div
                          key={optIndex}
                          className={clsx(
                            'flex items-center gap-2 p-2.5 rounded-lg border transition-colors',
                            isCorrect
                              ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800'
                              : 'bg-white dark:bg-[#150709] border-slate-200 dark:border-[#3D1418]'
                          )}
                        >
                          <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
                            <input
                              type="radio"
                              name={`correct-q-${qIndex}`}
                              checked={isCorrect}
                              onChange={() => handleQuestionChange(qIndex, 'correctIndex', optIndex)}
                              className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                            />
                            <span
                              className={clsx(
                                'font-mono text-xs font-bold w-5 h-5 rounded flex items-center justify-center',
                                isCorrect
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-slate-100 dark:bg-[#1C0A0D] text-slate-600 dark:text-slate-400'
                              )}
                            >
                              {String.fromCharCode(65 + optIndex)}
                            </span>
                          </label>

                          <input
                            type="text"
                            value={opt}
                            onChange={(e) => handleOptionChange(qIndex, optIndex, e.target.value)}
                            placeholder={`Choice ${String.fromCharCode(65 + optIndex)} text`}
                            className="flex-1 px-2.5 py-1.5 text-xs rounded border border-transparent hover:border-slate-200 dark:border-[#3D1418] focus:border-burgundy bg-transparent text-slate-900 dark:text-[#FAF6F3] focus:outline-none"
                          />

                          {isCorrect && (
                            <span className="text-[10px] font-mono font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 rounded shrink-0">
                              Correct Choice
                            </span>
                          )}

                          <button
                            type="button"
                            disabled={q.options.length <= 2}
                            onClick={() => handleDeleteOption(qIndex, optIndex)}
                            className="p-1 text-slate-400 hover:text-rose-600 disabled:opacity-20 cursor-pointer shrink-0"
                            title="Remove Choice"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Explanation */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Answer Explanation (Shown to students after submission)
                  </label>
                  <textarea
                    rows={2}
                    value={q.explanation || ''}
                    onChange={(e) => handleQuestionChange(qIndex, 'explanation', e.target.value)}
                    placeholder="Provide an explanation for why this choice is correct..."
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-[#3D1418] bg-white dark:bg-[#150709] text-slate-900 dark:text-[#FAF6F3] focus:outline-none focus:ring-1 focus:ring-burgundy"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Add Question Button at Bottom */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleAddQuestion}
              className="w-full py-3 rounded-xl border-2 border-dashed border-slate-200 dark:border-[#3D1418] hover:border-burgundy dark:hover:border-[#E89BA5] text-slate-600 dark:text-slate-400 hover:text-burgundy dark:hover:text-[#E89BA5] text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Add Another Question
            </button>
          </div>
        </div>

        {/* Bottom Save Bar */}
        <div className="bg-white dark:bg-[#150709] border border-slate-200 dark:border-[#3D1418] rounded-xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 sticky bottom-4 z-20">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <HelpCircle className="w-4 h-4 text-burgundy dark:text-[#E89BA5]" />
            <span>
              Editing {formData.questions.length} questions for{' '}
              <strong className="text-slate-800 dark:text-slate-200">
                {currentSessionMeta?.title || selectedSessionId}
              </strong>
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {isCustomized && (
              <button
                type="button"
                onClick={handleReset}
                disabled={isResetting}
                className="w-full sm:w-auto px-4 py-2 rounded-lg text-xs font-semibold border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Revert to Default
              </button>
            )}

            <button
              type="submit"
              disabled={isSaving}
              className="w-full sm:w-auto px-6 py-2 rounded-lg text-xs font-semibold bg-burgundy hover:bg-burgundy-deep text-white transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {isSaving ? 'Saving Changes...' : 'Save Quiz Changes'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
