'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import clsx from 'clsx';
import {
  Play,
  Send,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Clock,
  Terminal as TerminalIcon,
  Award,
  AlertTriangle,
  Code2,
  Check,
  Loader2,
  FileCode,
  Layers,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { CodingChallenge } from '@/data/qiskit/challenges';

// Dynamically import Monaco Editor to avoid SSR window issues
const Editor = dynamic<any>(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col items-center justify-center h-full min-h-[420px] bg-[#1e1e1e] text-slate-400 font-mono text-xs gap-3">
      <Loader2 className="w-6 h-6 animate-spin text-burgundy" />
      <span>Loading Monaco Code Editor...</span>
    </div>
  ),
});

interface PublicTestResult {
  test_number: number;
  test_name: string;
  passed: boolean;
  execution_time_ms: number;
  error_message: string | null;
}

interface HiddenTestResult {
  test_number: number;
  passed: boolean;
  execution_time_ms: number;
  error_message: string | null;
}

interface SubmissionDetails {
  submissionId: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'timeout' | 'system_error';
  score?: number;
  maxScore?: number;
  passedTests?: number;
  totalTests?: number;
  executionTimeMs?: number;
  stdout?: string;
  stderr?: string;
  errorMessage?: string;
  publicResults?: PublicTestResult[];
  hiddenResults?: HiddenTestResult[];
}

interface QiskitPlaygroundProps {
  challenge: CodingChallenge;
  userEmail: string;
  onSubmissionSuccess?: (score: number) => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

export function QiskitPlayground({
  challenge,
  userEmail,
  onSubmissionSuccess,
  isFullscreen = false,
  onToggleFullscreen,
}: QiskitPlaygroundProps) {
  const [code, setCode] = useState<string>(challenge.starterCode);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [activeBottomTab, setActiveBottomTab] = useState<'testcase' | 'result' | 'submission' | 'console'>('testcase');
  const [selectedCaseIdx, setSelectedCaseIdx] = useState<number>(0);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [isConsoleCollapsed, setIsConsoleCollapsed] = useState<boolean>(false);

  // Run execution result state
  const [runStdout, setRunStdout] = useState<string>('');
  const [runStderr, setRunStderr] = useState<string>('');
  const [runExecutionMs, setRunExecutionMs] = useState<number>(0);
  const [publicTestResults, setPublicTestResults] = useState<PublicTestResult[]>([]);
  const [lastRunSuccess, setLastRunSuccess] = useState<boolean | null>(null);

  // Submission result state
  const [submission, setSubmission] = useState<SubmissionDetails | null>(null);

  const editorRef = useRef<any>(null);
  const localDraftKey = `qff_draft_${(userEmail || '').toLowerCase()}_${challenge.id}`;
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Load initial code from LocalStorage or server draft
  useEffect(() => {
    let initialCode = challenge.starterCode;

    try {
      const local = localStorage.getItem(localDraftKey);
      if (local && local.trim()) {
        initialCode = local;
      }
    } catch (e) {}

    setCode(initialCode);

    async function fetchServerDraft() {
      try {
        const res = await fetch(`/api/qiskit/draft?problemId=${challenge.id}`);
        const data = await res.json();
        if (data.success && data.code) {
          setCode(data.code);
          try {
            localStorage.setItem(localDraftKey, data.code);
          } catch {}
        }
      } catch (err) {
        console.warn('Could not fetch server draft:', err);
      }
    }

    fetchServerDraft();

    setRunStdout('');
    setRunStderr('');
    setPublicTestResults([]);
    setSubmission(null);
    setLastRunSuccess(null);
    setActiveBottomTab('testcase');
    setSelectedCaseIdx(0);

    // Re-layout and focus editor on problem switch
    setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.layout();
        editorRef.current.focus();
      }
    }, 150);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [challenge.id, localDraftKey, challenge.starterCode]);

  // 2. Local Draft Persistence with Debounced Auto-Save
  useEffect(() => {
    if (!code) return;

    try {
      localStorage.setItem(localDraftKey, code);
    } catch {}

    const timer = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        await fetch('/api/qiskit/draft', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            problemId: challenge.id,
            code,
          }),
        });
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch {
        setSaveStatus('idle');
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [code, challenge.id, localDraftKey]);

  // 3. Reset to Starter Code
  const handleReset = () => {
    if (confirm('Reset code to default starter template? Unsaved changes will be discarded.')) {
      setCode(challenge.starterCode);
      try {
        localStorage.removeItem(localDraftKey);
      } catch {}
      if (editorRef.current) {
        editorRef.current.focus();
      }
    }
  };

  // Draft saving function
  const triggerSaveDraft = useCallback(async () => {
    if (!code) return;
    setSaveStatus('saving');
    try {
      localStorage.setItem(localDraftKey, code);
      await fetch('/api/qiskit/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          problemId: challenge.id,
          code,
        }),
      });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('idle');
    }
  }, [code, challenge.id, localDraftKey]);

  // Keep latest function refs for Monaco commands
  const runCodeRef = useRef<() => void>(() => {});
  const submitCodeRef = useRef<() => void>(() => {});
  const saveDraftRef = useRef<() => void>(() => {});

  // 4. Editor Mount Handler (Guarantees Clickable & Interactive with Shortcuts)
  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
    editor.layout();
    editor.focus();

    if (monaco) {
      // Cmd/Ctrl + Enter -> Run code against public tests
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
        runCodeRef.current();
      });

      // Cmd/Ctrl + Shift + Enter -> Submit solution
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Enter, () => {
        submitCodeRef.current();
      });

      // Cmd/Ctrl + S -> Save draft without browser 'Save Page' prompt
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        saveDraftRef.current();
      });
    }

    setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.layout();
        editorRef.current.focus();
      }
    }, 150);
  };

  // 5. Run Code (Public Tests Only)
  const handleRunCode = useCallback(async () => {
    if (isRunning || isSubmitting) return;

    setIsRunning(true);
    setIsConsoleCollapsed(false);
    setActiveBottomTab('result');
    setPublicTestResults([]);
    setRunStdout('');
    setRunStderr('');
    setLastRunSuccess(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    try {
      const res = await fetch('/api/qiskit/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          problemId: challenge.id,
          code,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const contentType = res.headers.get('content-type') || '';
      let data: any = {};
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        throw new Error(
          res.status === 504
            ? 'Execution timed out on server.'
            : `Server response error (${res.status}): ${text.slice(0, 120)}`
        );
      }

      setRunExecutionMs(data.executionTimeMs || 0);

      const publicResults = data.publicResults || [];
      setPublicTestResults(publicResults);
      const hasPublicResults = publicResults.length > 0;
      const allPassed = hasPublicResults
        ? publicResults.every((t: any) => Boolean(t.passed)) && Boolean(data.success)
        : false;

      setRunStdout(data.stdout || '');
      setRunStderr(data.stderr || (allPassed ? '' : (data.error || (!res.ok ? 'Execution failed.' : ''))));
      setLastRunSuccess(allPassed);
    } catch (err: any) {
      clearTimeout(timeoutId);
      setLastRunSuccess(false);
      setRunStderr(
        err.name === 'AbortError'
          ? 'Execution timed out after 20 seconds. Check for infinite loops or long-running computations.'
          : `Execution error: ${err.message || 'Failed to communicate with runner.'}`
      );
    } finally {
      setIsRunning(false);
    }
  }, [isRunning, isSubmitting, challenge.id, code]);

  // 6. Submit Solution (Asynchronous Evaluation)
  const handleSubmitCode = useCallback(async () => {
    if (isRunning || isSubmitting) return;

    setIsSubmitting(true);
    setIsConsoleCollapsed(false);
    setActiveBottomTab('submission');
    setSubmission({
      submissionId: '',
      status: 'queued',
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    try {
      const res = await fetch('/api/qiskit/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          problemId: challenge.id,
          code,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const contentType = res.headers.get('content-type') || '';
      let data: any = {};
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        throw new Error(`Server error (${res.status}): ${text.slice(0, 120)}`);
      }

      if (!res.ok || !data.success) {
        setSubmission({
          submissionId: '',
          status: 'failed',
          errorMessage: data.error || 'Submission failed.',
        });
        setIsSubmitting(false);
        return;
      }

      const subId = data.submissionId;
      setSubmission({
        submissionId: subId,
        status: 'queued',
      });

      pollSubmissionStatus(subId);
    } catch (err: any) {
      clearTimeout(timeoutId);
      setSubmission({
        submissionId: '',
        status: 'failed',
        errorMessage: err.name === 'AbortError' ? 'Submission timed out.' : err.message || 'Network error during submission.',
      });
      setIsSubmitting(false);
    }
  }, [isRunning, isSubmitting, challenge.id, code]);





  // 7. Polling Worker for Asynchronous Submission Status
  const pollSubmissionStatus = useCallback((subId: string) => {
    let attempts = 0;
    const maxAttempts = 30;

    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    pollingIntervalRef.current = setInterval(async () => {
      attempts += 1;
      try {
        const res = await fetch(`/api/qiskit/submission/${subId}`);
        const data = await res.json();

        if (res.ok && data.success) {
          if (data.status === 'completed' || data.status === 'failed' || data.status === 'timeout') {
            clearInterval(pollingIntervalRef.current!);
            setIsSubmitting(false);
            setSubmission(data);
            if (data.status === 'completed' && (data.score || 0) > 0 && onSubmissionSuccess) {
              onSubmissionSuccess(data.score);
            }
          } else {
            setSubmission((prev) => ({
              ...(prev || { submissionId: subId }),
              status: data.status,
            }));
          }
        }

        if (attempts >= maxAttempts) {
          clearInterval(pollingIntervalRef.current!);
          setIsSubmitting(false);
          setSubmission((prev) => ({
            ...(prev || { submissionId: subId }),
            status: 'timeout',
            errorMessage: 'Evaluation timed out waiting for judge results.',
          }));
        }
      } catch (e) {
        console.warn('Error polling submission:', e);
      }
    }, 1000);
  }, [onSubmissionSuccess]);

  // Keep refs synchronized with latest handlers
  runCodeRef.current = handleRunCode;
  submitCodeRef.current = handleSubmitCode;
  saveDraftRef.current = triggerSaveDraft;

  // Keyboard shortcut: Cmd/Ctrl + Enter to Run, Cmd/Ctrl + Shift + Enter to Submit, Cmd/Ctrl + S to Save
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        handleSubmitCode();
      } else {
        handleRunCode();
      }
    } else if ((e.metaKey || e.ctrlKey) && (e.key === 's' || e.key === 'S')) {
      e.preventDefault();
      triggerSaveDraft();
    }
  };

  const selectedPublicTest = challenge.publicTests?.[selectedCaseIdx] || challenge.publicTests?.[0];

  return (
    <div
      className="flex flex-col h-full min-h-0 bg-[#181818] border border-slate-700/60 dark:border-[#3D1418] rounded-xl overflow-hidden shadow-lg"
      onKeyDown={handleKeyDown}
    >
      {/* ─────────────────────────────────────────────────────────────
          1. LEETCODE-STYLE EDITOR TOOLBAR
         ───────────────────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center justify-between px-3 sm:px-4 py-2 bg-[#252526] border-b border-[#333333] select-none gap-2 overflow-hidden">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-[#1e1e1e] text-xs font-mono font-medium text-slate-200 border border-[#3e3e42] shrink-0">
            <Code2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Python 3 (Qiskit 2.x)</span>
          </div>

          {saveStatus === 'saving' && (
            <span className="flex items-center gap-1 text-[11px] font-mono text-slate-400 truncate">
              <Loader2 className="w-3 h-3 animate-spin text-burgundy shrink-0" />
              <span className="hidden sm:inline">Saving draft...</span>
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="flex items-center gap-1 text-[11px] font-mono text-emerald-400 truncate">
              <Check className="w-3 h-3 shrink-0" />
              <span className="hidden sm:inline">Draft saved</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Full Screen Toggle */}
          <button
            onClick={() => {
              if (onToggleFullscreen) {
                onToggleFullscreen();
              } else if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('qiskit:toggle-fullscreen'));
              }
            }}
            type="button"
            title={isFullscreen ? 'Exit Full Screen' : 'Full Screen Playground'}
            className="p-1.5 rounded hover:bg-[#333333] text-slate-400 hover:text-slate-200 transition-colors cursor-pointer shrink-0"
          >
            {isFullscreen ? (
              <Minimize2 className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Reset Template */}
          <button
            onClick={handleReset}
            type="button"
            title="Reset code to starter template"
            className="p-1.5 rounded hover:bg-[#333333] text-slate-400 hover:text-slate-200 transition-colors cursor-pointer shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. MONACO CODE EDITOR (Guaranteed Clickable & Focused)
         ───────────────────────────────────────────────────────────── */}
      <div
        className="relative w-full flex-1 min-h-[200px] min-h-0 bg-[#1e1e1e] cursor-text"
        onClick={() => {
          if (editorRef.current) {
            editorRef.current.focus();
          }
        }}
      >
        <Editor
          height="100%"
          width="100%"
          language="python"
          theme="vs-dark"
          value={code}
          onMount={handleEditorDidMount}
          onChange={(newVal?: string) => setCode(newVal || '')}
          options={{
            readOnly: false,
            domReadOnly: false,
            cursorBlinking: 'blink',
            cursorStyle: 'line',
            selectOnLineNumbers: true,
            automaticLayout: true,
            lineNumbers: 'on',
            glyphMargin: false,
            folding: true,
            scrollbar: {
              vertical: 'visible',
              horizontal: 'visible',
              verticalScrollbarSize: 10,
              horizontalScrollbarSize: 10,
            },
            overviewRulerLanes: 0,
            hideCursorInOverviewRuler: true,
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            tabSize: 4,
            fontSize: 13,
            fontFamily: "'Fira Code', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            padding: { top: 12, bottom: 12 },
          }}
        />
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. LEETCODE-STYLE CONSOLE & TESTCASE PANEL
         ───────────────────────────────────────────────────────────── */}
      <div className="shrink-0 flex flex-col bg-[#1e1e1e] border-t border-[#333333]">
        {/* Tab Headers */}
        <div className="shrink-0 flex items-center justify-between px-2.5 sm:px-3 bg-[#252526] border-b border-[#333333] gap-2 overflow-hidden">
          <div className="flex items-center gap-1 min-w-0 overflow-x-auto no-scrollbar py-1 shrink">
            <button
              onClick={() => {
                setActiveBottomTab('testcase');
                setIsConsoleCollapsed(false);
              }}
              type="button"
              className={clsx(
                'px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs font-mono font-medium border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer shrink-0',
                activeBottomTab === 'testcase' && !isConsoleCollapsed
                  ? 'border-emerald-500 text-white font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              )}
            >
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>Testcase</span>
            </button>

            <button
              onClick={() => {
                setActiveBottomTab('result');
                setIsConsoleCollapsed(false);
              }}
              type="button"
              className={clsx(
                'px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs font-mono font-medium border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer shrink-0',
                activeBottomTab === 'result' && !isConsoleCollapsed
                  ? 'border-emerald-500 text-white font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              )}
            >
              <TerminalIcon className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Test Result</span>
              <span className="sm:hidden">Result</span>
              {publicTestResults.length > 0 && (
                <span className={clsx(
                  'px-1.5 py-0.2 rounded text-[10px] font-bold shrink-0',
                  lastRunSuccess ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'
                )}>
                  {publicTestResults.filter(t => t.passed).length}/{publicTestResults.length}
                </span>
              )}
            </button>

            <button
              onClick={() => {
                setActiveBottomTab('submission');
                setIsConsoleCollapsed(false);
              }}
              type="button"
              className={clsx(
                'px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs font-mono font-medium border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer shrink-0',
                activeBottomTab === 'submission' && !isConsoleCollapsed
                  ? 'border-emerald-500 text-white font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              )}
            >
              <Award className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Submission</span>
              <span className="sm:hidden">Submit</span>
              {submission?.score !== undefined && (
                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-950 text-amber-300 shrink-0">
                  {submission.score}/{challenge.points} pts
                </span>
              )}
            </button>
          </div>

          {/* Action Buttons: Run & Submit & Minimize Toggle */}
          <div className="flex items-center gap-1.5 sm:gap-2 py-1.5 shrink-0 ml-auto">
            <button
              onClick={handleRunCode}
              disabled={isRunning || isSubmitting}
              type="button"
              title="Run code against public tests (Cmd/Ctrl + Enter)"
              className="px-2.5 sm:px-3 py-1.5 rounded-md bg-[#333333] hover:bg-[#3e3e42] text-white text-xs font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-xs shrink-0"
            >
              {isRunning ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current text-slate-300" />
              )}
              <span>Run</span>
              <span className="hidden md:inline text-[10px] font-mono text-slate-400 ml-0.5">⌘↵</span>
            </button>

            <button
              onClick={handleSubmitCode}
              disabled={isRunning || isSubmitting}
              type="button"
              title="Submit solution for official judging (Cmd/Ctrl + Shift + Enter)"
              className="px-3 sm:px-4 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-xs shrink-0"
            >
              {isSubmitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              <span>Submit</span>
              <span className="hidden md:inline text-[10px] font-mono text-emerald-200 ml-0.5">⌘⇧↵</span>
            </button>

            {/* Collapse / Expand Toggle Button */}
            <button
              onClick={() => setIsConsoleCollapsed((prev) => !prev)}
              type="button"
              title={isConsoleCollapsed ? 'Expand test panel' : 'Collapse test panel'}
              className="p-1.5 rounded hover:bg-[#333333] text-slate-400 hover:text-slate-200 transition-colors cursor-pointer shrink-0"
            >
              {isConsoleCollapsed ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Tab Body */}
        {!isConsoleCollapsed && (
          <div data-lenis-prevent="true" className="p-3.5 sm:p-4 pb-8 sm:pb-10 h-[210px] sm:h-[230px] overflow-y-auto font-mono text-xs text-slate-200 overscroll-contain">
          {/* TAB 1: Testcase Selector */}
          {activeBottomTab === 'testcase' && (
            <div className="space-y-3 pb-8">
              {/* Case Chips */}
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                {(challenge.publicTests || []).map((t, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedCaseIdx(idx)}
                    className={clsx(
                      'px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors cursor-pointer',
                      selectedCaseIdx === idx
                        ? 'bg-[#333333] text-white font-bold'
                        : 'bg-[#252526] text-slate-400 hover:bg-[#2c2c2d] hover:text-slate-200'
                    )}
                  >
                    Case {idx + 1}
                  </button>
                ))}
              </div>

              {selectedPublicTest && (
                <div className="space-y-2 pt-1">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Input ({selectedPublicTest.name})
                    </span>
                    <div className="p-2.5 rounded-lg bg-[#252526] border border-[#333333] text-emerald-400 font-mono text-xs">
                      {selectedPublicTest.inputSummary}
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Expected Output
                    </span>
                    <div className="p-2.5 rounded-lg bg-[#252526] border border-[#333333] text-slate-300 font-mono text-xs">
                      {selectedPublicTest.expectedSummary}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Run Result */}
          {activeBottomTab === 'result' && (
            <div>
              {isRunning ? (
                <div className="flex items-center gap-2 py-6 text-slate-400">
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                  <span>Executing code on public test suite...</span>
                </div>
              ) : lastRunSuccess === null ? (
                <div className="text-slate-400 italic py-6">
                  You must run your code first to view test results.
                </div>
              ) : (
                <div className="space-y-3 pb-8">
                  {/* Status Headline */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={clsx(
                        'text-base font-bold font-sans',
                        lastRunSuccess ? 'text-emerald-400' : 'text-rose-400'
                      )}>
                        {lastRunSuccess ? 'Accepted' : 'Wrong Answer'}
                      </span>
                      <span className="text-slate-500">•</span>
                      <span className="text-xs text-slate-400">
                        Runtime: {runExecutionMs} ms
                      </span>
                    </div>
                  </div>

                  {/* Public Test Cards */}
                  <div className="space-y-2">
                    {publicTestResults.map((t, idx) => (
                      <div
                        key={idx}
                        className={clsx(
                          'p-3 rounded-lg border flex flex-col gap-1',
                          t.passed
                            ? 'bg-[#1b2b22] border-emerald-800/60'
                            : 'bg-[#2b181a] border-rose-800/60'
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {t.passed ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                            ) : (
                              <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                            )}
                            <span className="font-semibold text-white">
                              {t.test_name}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-400">
                            {t.execution_time_ms} ms
                          </span>
                        </div>
                        {t.error_message && (
                          <div className="text-[11px] text-rose-300 pl-6 whitespace-pre-wrap font-mono mt-1">
                            {t.error_message}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Stdout / Stderr logs */}
                  {runStdout && (
                    <div className="space-y-1 pt-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Stdout</span>
                      <div className="p-2.5 rounded bg-[#252526] text-slate-300 whitespace-pre-wrap">
                        {runStdout}
                      </div>
                    </div>
                  )}
                  {runStderr && (
                    <div className="space-y-1 pt-2">
                      <span className="text-[10px] font-bold text-rose-400 uppercase">Stderr</span>
                      <div className="p-2.5 rounded bg-[#2b181a] text-rose-300 whitespace-pre-wrap">
                        {runStderr}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Official Submission */}
          {activeBottomTab === 'submission' && (
            <div>
              {!submission ? (
                <div className="text-slate-400 italic py-6">
                  Click <span className="font-semibold text-white">[Submit]</span> to evaluate your code against the complete public and hidden test harness.
                </div>
              ) : submission.status === 'queued' || submission.status === 'running' ? (
                <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-800/50 flex items-center gap-3">
                  <Loader2 className="w-5 h-5 animate-spin text-amber-400 shrink-0" />
                  <div>
                    <h4 className="font-semibold text-amber-200 text-xs">
                      Evaluating Submission ({submission.status})...
                    </h4>
                    <p className="text-[11px] text-amber-300/80">
                      Running public tests and parameterized hidden suites in sandbox.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 pb-8">
                  {/* Status Headline Banner */}
                  {(() => {
                    const isAccepted = Boolean(
                      submission.status === 'completed' &&
                      (submission.score || 0) === challenge.points &&
                      (submission.passedTests || 0) === (submission.totalTests || 0) &&
                      (submission.totalTests || 0) > 0
                    );
                    const isPartial = Boolean(
                      submission.status === 'completed' &&
                      !isAccepted &&
                      (submission.score || 0) > 0
                    );
                    const errText = submission.errorMessage || submission.stderr || '';
                    const headline = isAccepted
                      ? 'Accepted'
                      : isPartial
                      ? 'Partial Credit'
                      : errText
                      ? (errText.includes('Syntax') || errText.includes('Compilation')
                          ? 'Compilation Error'
                          : 'Runtime Error')
                      : 'Wrong Answer';

                    return (
                      <div className={clsx(
                        'p-4 rounded-xl border flex items-center justify-between',
                        isAccepted
                          ? 'bg-[#1b2b22] border-emerald-800'
                          : isPartial
                          ? 'bg-[#2b2416] border-amber-800'
                          : 'bg-[#2b181a] border-rose-800'
                      )}>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={clsx(
                              'text-lg font-bold font-sans',
                              isAccepted
                                ? 'text-emerald-400'
                                : isPartial
                                ? 'text-amber-400'
                                : 'text-rose-400'
                            )}>
                              {headline}
                            </span>
                            <span className="text-slate-500">•</span>
                            <span className="text-xs text-slate-300">
                              {submission.executionTimeMs} ms
                            </span>
                          </div>
                          <p className="text-xs text-slate-300 mt-0.5">
                            Earned <span className="font-bold text-white">{submission.score || 0}</span> of <span className="font-bold text-white">{challenge.points}</span> points ({submission.passedTests || 0}/{submission.totalTests || 0} tests passed).
                          </p>
                        </div>

                        <div className="text-right">
                          <span className={clsx(
                            'text-xs font-mono font-bold px-3 py-1.5 rounded-lg border',
                            isAccepted
                              ? 'bg-[#1b2b22] border-emerald-800 text-emerald-300'
                              : isPartial
                              ? 'bg-[#2b2416] border-amber-800 text-amber-300'
                              : 'bg-[#252526] border-[#3e3e42] text-slate-400'
                          )}>
                            +{submission.score || 0} pts
                          </span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Stderr / Error Message in Submission Tab */}
                  {(submission.errorMessage || submission.stderr) && (
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider block">
                        Diagnostics & Error Output
                      </span>
                      <div className="p-3 rounded-lg bg-[#2b181a] border border-rose-800/60 text-rose-200 font-mono text-xs whitespace-pre-wrap">
                        {submission.stderr || submission.errorMessage}
                      </div>
                    </div>
                  )}

                  {/* Public breakdown */}
                  {submission.publicResults && submission.publicResults.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Public Tests ({submission.publicResults.filter(t => t.passed).length}/{submission.publicResults.length})
                      </span>
                      <div className="space-y-1.5">
                        {submission.publicResults.map((t, i) => (
                          <div
                            key={i}
                            className={clsx(
                              'p-2.5 rounded border text-xs flex flex-col gap-1',
                              t.passed ? 'bg-[#1b2b22] border-emerald-800/40 text-emerald-300' : 'bg-[#2b181a] border-rose-800/40 text-rose-300'
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-semibold">{t.test_name}</span>
                              <span className="text-[10px] text-slate-400">{t.execution_time_ms}ms</span>
                            </div>
                            {t.error_message && (
                              <div className="text-[11px] text-rose-300 font-mono pt-1 border-t border-rose-900/40 whitespace-pre-wrap">
                                {t.error_message}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Hidden breakdown */}
                  {submission.hiddenResults && submission.hiddenResults.length > 0 && (
                    <div className="space-y-1.5 pt-2 border-t border-[#333333]">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Hidden Tests ({submission.hiddenResults.filter(t => t.passed).length}/{submission.hiddenResults.length})
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {submission.hiddenResults.map((t, i) => (
                          <div
                            key={i}
                            className={clsx(
                              'p-2 rounded border text-xs flex items-center justify-between',
                              t.passed ? 'bg-[#1b2b22] border-emerald-800/40 text-emerald-300' : 'bg-amber-950/40 border-amber-800/40 text-amber-300'
                            )}
                          >
                            <span>Hidden Test #{t.test_number}</span>
                            <span className="text-[10px] font-bold">{t.passed ? 'Passed' : 'Failed'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  );
}
