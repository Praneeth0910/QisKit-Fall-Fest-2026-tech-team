import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { supabaseAdmin } from './supabase-admin.ts';
import { redis, cacheAside } from './redis.ts';
import { QISKIT_CHALLENGES } from '../data/qiskit/challenges.ts';
import { evaluateProblemWithTypeScript } from './qiskit-evaluator-ts.ts';
import { localTestSubmissions, type LocalTestSubmission, saveLocalTestSubmission } from './local-test-store.ts';
import { isProductionOrCloudEnvironment } from './local-test-auth-policy.ts';

// In-memory & Redis fallback store for submissions when database tables are initializing
export const fallbackSubmissions = new Map<string, any>();
const MAX_JUDGE_OUTPUT_BYTES = 64 * 1024;


export interface TestResultItem {
  test_type: 'public' | 'hidden';
  test_number: number;
  test_name: string;
  passed: boolean;
  execution_time_ms: number;
  error_message: string | null;
}

export interface JudgeEvaluationResult {
  success: boolean;
  mode: 'run' | 'submit';
  score: number;
  max_score: number;
  passed_tests: number;
  total_tests: number;
  execution_time_ms: number;
  stdout: string;
  stderr: string;
  error_message: string | null;
  public_results: TestResultItem[];
  hidden_results: TestResultItem[];
}

export interface CompetitionConfig {
  enabled: boolean;
  is_locked?: boolean;
  start_time: string;
  end_time: string;
  max_submissions_per_problem: number;
  run_rate_limit_per_min: number;
  duration_minutes: number;
}

function invalidJudgeResult(problemId: string, mode: 'run' | 'submit', message: string): JudgeEvaluationResult {
  const challenge = QISKIT_CHALLENGES.find((item) => item.id === problemId);
  return {
    success: false,
    mode,
    score: 0,
    max_score: challenge?.points || 0,
    passed_tests: 0,
    total_tests: 0,
    execution_time_ms: 0,
    stdout: '',
    stderr: message,
    error_message: message,
    public_results: [],
    hidden_results: [],
  };
}

function validateJudgeResult(
  problemId: string,
  mode: 'run' | 'submit',
  result: unknown
): JudgeEvaluationResult {
  const challenge = QISKIT_CHALLENGES.find((item) => item.id === problemId);
  if (!challenge || !result || typeof result !== 'object') {
    return invalidJudgeResult(problemId, mode, 'Judge returned an invalid result.');
  }

  const candidate = result as Partial<JudgeEvaluationResult>;
  const validNumber = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value);
  const publicResults = Array.isArray(candidate.public_results) ? candidate.public_results : null;
  const hiddenResults = Array.isArray(candidate.hidden_results) ? candidate.hidden_results : null;
  const score = candidate.score;
  const passedTests = candidate.passed_tests;
  const totalTests = candidate.total_tests;
  if (
    candidate.mode !== mode ||
    candidate.max_score !== challenge.points ||
    !validNumber(score) ||
    score < 0 ||
    score > challenge.points ||
    !validNumber(passedTests) ||
    !validNumber(totalTests) ||
    !publicResults ||
    !hiddenResults ||
    passedTests < 0 ||
    totalTests < 0 ||
    passedTests > totalTests
  ) {
    return invalidJudgeResult(problemId, mode, 'Judge returned an invalid score result.');
  }

  return {
    ...(candidate as JudgeEvaluationResult),
    score: Math.floor(score),
    max_score: challenge.points,
    passed_tests: Math.floor(passedTests),
    total_tests: Math.floor(totalTests),
  };
}

const DEFAULT_CONFIG: CompetitionConfig = {
  enabled: true,
  is_locked: false,
  start_time: '2026-10-01T00:00:00+05:30',
  end_time: '2026-10-20T23:59:59+05:30',
  max_submissions_per_problem: 10,
  run_rate_limit_per_min: 30,
  duration_minutes: 180,
};

/**
 * Server-authoritative check for competition window.
 */
export async function getChallengeConfig(): Promise<CompetitionConfig> {
  return cacheAside('platform_config:qiskit_challenge', 60, async () => {
    try {
      const { data, error } = await supabaseAdmin
        .from('platform_config')
        .select('value')
        .eq('key', 'qiskit_challenge_config')
        .single();

      if (error || !data?.value) {
        return DEFAULT_CONFIG;
      }
      return { ...DEFAULT_CONFIG, ...(data.value as Partial<CompetitionConfig>) };
    } catch {
      return DEFAULT_CONFIG;
    }
  });
}

/**
 * Checks whether competition is currently active and open for code submissions.
 */
export async function checkCompetitionStatus(): Promise<{ allowed: boolean; reason?: string; config: CompetitionConfig }> {
  const config = await getChallengeConfig();

  if (config.is_locked) {
    return {
      allowed: false,
      reason: 'The Python Coding Challenge in Qiskit is currently locked by organizers. Coming Soon!',
      config,
    };
  }

  if (!config.enabled) {
    return { allowed: false, reason: 'The Python Coding Challenge in Qiskit is currently disabled by organizers.', config };
  }

  const now = new Date().getTime();
  const startTime = new Date(config.start_time).getTime();
  const endTime = new Date(config.end_time).getTime();

  if (now < startTime) {
    return {
      allowed: false,
      reason: `The challenge has not started yet. Starts at ${new Date(startTime).toLocaleString()}.`,
      config,
    };
  }

  if (now > endTime) {
    return {
      allowed: false,
      reason: `The challenge deadline has passed (${new Date(endTime).toLocaleString()}). Submissions are closed.`,
      config,
    };
  }

  return { allowed: true, config };
}

/**
 * Rate limit check using Redis or fallback.
 */
export async function checkRateLimit(
  email: string,
  action: 'run' | 'submit',
  problemId: string
): Promise<{ allowed: boolean; remaining?: number; message?: string }> {
  const normEmail = email.trim().toLowerCase();

  if (!redis) {
    return { allowed: true };
  }

  try {
    if (action === 'run') {
      const key = `coding:ratelimit:run:${normEmail}`;
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, 60); // 1 minute window
      }
      if (count > 30) {
        return {
          allowed: false,
          remaining: 0,
          message: 'Rate limit exceeded: Maximum 30 runs per minute. Please wait before running again.',
        };
      }
      return { allowed: true, remaining: 30 - count };
    }

    if (action === 'submit') {
      const countKey = `coding:sub_count:${normEmail}:${problemId.toUpperCase()}`;
      const existing = (await redis.get<number>(countKey)) || 0;
      if (existing >= 10) {
        return {
          allowed: false,
          remaining: 0,
          message: `Submission limit reached: You have used all 10 submissions for problem ${problemId}.`,
        };
      }
      return { allowed: true, remaining: 10 - existing };
    }
  } catch (err) {
    console.warn('[Rate Limit Error]:', err);
  }

  return { allowed: true };
}

/**
 * Increments official submission counter for user and problem.
 */
export async function incrementSubmissionCount(email: string, problemId: string): Promise<void> {
  if (!redis) return;
  try {
    const normEmail = email.trim().toLowerCase();
    const countKey = `coding:sub_count:${normEmail}:${problemId.toUpperCase()}`;
    await redis.incr(countKey);
  } catch (e) {
    console.warn('[Redis] Failed to incr submission count:', e);
  }
}

/**
 * Dispatches code execution to remote Judge service (if configured), local Python runner,
 * or ultra-fast built-in TypeScript Quantum Circuit Evaluator (default for Vercel Serverless).
 */
export async function dispatchJudgeEvaluation(
  problemId: string,
  sourceCode: string,
  mode: 'run' | 'submit'
): Promise<JudgeEvaluationResult> {
  const judgeUrl = process.env.QISKIT_JUDGE_URL;
  const judgeSecret = process.env.QISKIT_JUDGE_SECRET;

  // 1. Try remote judge service if configured
  if (judgeUrl) {
    if (!judgeSecret?.trim()) {
      console.error('[Judge Service] Shared secret QISKIT_JUDGE_SECRET is missing or empty.');
      return invalidJudgeResult(
        problemId,
        mode,
        'Judge authentication secret is not configured.'
      );
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${judgeSecret.trim()}`,
      };

      const res = await fetch(`${judgeUrl.replace(/\/+$/, '')}/evaluate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          problemId,
          code: sourceCode,
          mode,
        }),
        signal: controller.signal,
      });

      if (res.ok) {
        return validateJudgeResult(problemId, mode, await res.json());
      }

      const errorBody = await res.text();
      console.warn(
        '[Judge Service] Evaluation rejected:',
        res.status,
        errorBody.slice(0, 2000)
      );

      return invalidJudgeResult(
        problemId,
        mode,
        `Judge rejected evaluation (HTTP ${res.status}).`
      );
    } catch (err) {
      console.warn('[Judge Service] Connection failed:', err);
      return invalidJudgeResult(problemId, mode, 'Judge service is unavailable.');
    } finally {
      clearTimeout(timer);
    }
  }

  // 2. Try local Python runner ONLY in non-serverless environments if explicitly enabled
  const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
  const enableLocalPython = process.env.ENABLE_LOCAL_PYTHON_JUDGE === 'true';

  if (!isServerless && enableLocalPython) {
    const runnerPath = path.join(process.cwd(), 'qiskit-judge', 'runner.py');
    if (fs.existsSync(runnerPath)) {
      try {
        const localRes = await executeLocalRunner(problemId, sourceCode, mode);
        return validateJudgeResult(problemId, mode, localRes);
      } catch (err) {
        console.warn('[Local Python Runner] Failed:', err);
        return invalidJudgeResult(problemId, mode, 'Judge process is unavailable.');
      }
    }
  }

  const isProd = isProductionOrCloudEnvironment();
  if (process.env.ENABLE_TYPESCRIPT_JUDGE_FALLBACK === 'true' && !isProd) {
    return validateJudgeResult(
      problemId,
      mode,
      await evaluateProblemWithTypeScript(problemId, sourceCode, mode)
    );
  }

  return invalidJudgeResult(
    problemId,
    mode,
    isProd
      ? 'No authoritative judge service is configured in production. Fallback evaluator is disabled.'
      : 'No authoritative judge is configured.'
  );
}

function getPythonExecutable(): string {
  if (process.env.PYTHON_BIN) return process.env.PYTHON_BIN;
  if (process.platform === 'win32') {
    const knownPaths = [
      path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python314', 'python.exe'),
      path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python312', 'python.exe'),
      path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python311', 'python.exe'),
      path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python310', 'python.exe'),
    ];
    for (const p of knownPaths) {
      if (fs.existsSync(p)) return p;
    }
    return 'python';
  }
  return 'python3';
}

/**
 * Runs local Python runner `qiskit-judge/runner.py`.
 */
function executeLocalRunner(
  problemId: string,
  sourceCode: string,
  mode: 'run' | 'submit'
): Promise<JudgeEvaluationResult> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const runnerPath = path.join(process.cwd(), 'qiskit-judge', 'runner.py');
    const payload = JSON.stringify({
      problem_id: problemId,
      code: sourceCode,
      mode,
    });

    let stdout = '';
    let stderr = '';
    let outputBytes = 0;
    let timedOut = false;
    let resolved = false;

    const safeResolve = (res: JudgeEvaluationResult) => {
      if (!resolved) {
        resolved = true;
        resolve(res);
      }
    };

    let py: any;
    try {
      const pythonCmd = getPythonExecutable();
      py = spawn(pythonCmd, [runnerPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          PYTHONPATH: path.join(process.cwd(), 'qiskit-judge'),
        },
      });
    } catch (e: any) {
      return safeResolve({
        success: false,
        mode,
        score: 0,
        max_score: 0,
        passed_tests: 0,
        total_tests: 0,
        execution_time_ms: 0,
        stdout: '',
        stderr: e.message || 'Python not available',
        error_message: 'JUDGE_INFRA_PYTHON_SPAWN_ERROR',
        public_results: [],
        hidden_results: [],
      });
    }

    const timeoutMs = 15000;
    const timer = setTimeout(() => {
      timedOut = true;
      try {
        py.kill();
      } catch {}
      safeResolve({
        success: false,
        mode,
        score: 0,
        max_score: 0,
        passed_tests: 0,
        total_tests: 0,
        execution_time_ms: timeoutMs,
        stdout: '',
        stderr: `Execution timed out after ${Math.round(timeoutMs / 1000)} seconds.`,
        error_message: 'Execution timed out.',
        public_results: [],
        hidden_results: [],
      });
    }, timeoutMs);

    py.on('error', (err: any) => {
      clearTimeout(timer);
      safeResolve({
        success: false,
        mode,
        score: 0,
        max_score: 0,
        passed_tests: 0,
        total_tests: 0,
        execution_time_ms: Date.now() - startTime,
        stdout: '',
        stderr: err?.message || 'Python process spawn error',
        error_message: 'JUDGE_INFRA_PYTHON_SPAWN_ERROR',
        public_results: [],
        hidden_results: [],
      });
    });

    py.stdout?.on('data', (d: Buffer | string) => {
      const chunk = d.toString();
      outputBytes += Buffer.byteLength(chunk);
      if (outputBytes > MAX_JUDGE_OUTPUT_BYTES) {
        try {
          py.kill();
        } catch {}
        safeResolve({
          ...invalidJudgeResult(problemId, mode, 'Judge output exceeded the maximum permitted size.'),
          execution_time_ms: Date.now() - startTime,
        });
        return;
      }
      stdout += chunk;
    });

    py.stderr?.on('data', (d: Buffer | string) => {
      const chunk = d.toString();
      outputBytes += Buffer.byteLength(chunk);
      if (outputBytes > MAX_JUDGE_OUTPUT_BYTES) {
        try {
          py.kill();
        } catch {}
        safeResolve({
          ...invalidJudgeResult(problemId, mode, 'Judge output exceeded the maximum permitted size.'),
          execution_time_ms: Date.now() - startTime,
        });
        return;
      }
      stderr += chunk;
    });

    py.on('close', () => {
      clearTimeout(timer);
      const executionTimeMs = Date.now() - startTime;

      if (timedOut) return;

      try {
        const parsed = JSON.parse(stdout.trim());
        safeResolve(parsed as JudgeEvaluationResult);
      } catch {
        safeResolve({
          success: false,
          mode,
          score: 0,
          max_score: 0,
          passed_tests: 0,
          total_tests: 0,
          execution_time_ms: executionTimeMs,
          stdout: stdout.slice(0, 1000),
          stderr: stderr || 'Execution error in judge runner.',
          error_message: stderr || 'Execution failed',
          public_results: [],
          hidden_results: [],
        });
      }
    });

    try {
      py.stdin?.write(payload);
      py.stdin?.end();
    } catch {}
  });
}

/**
 * Creates an asynchronous submission and begins processing.
 */
export async function createAsyncSubmission(
  email: string,
  problemId: string,
  sourceCode: string
): Promise<{ success: boolean; submissionId?: string; status?: string; error?: string }> {
  try {
    const normEmail = email.trim().toLowerCase();
    const pid = problemId.toUpperCase();

    // 1. Resolve challenge info (static fallback + Supabase)
    const staticChallenge = QISKIT_CHALLENGES.find((c) => c.id.toUpperCase() === pid);
    if (!staticChallenge) {
      return { success: false, error: `Invalid problem ID: ${problemId}` };
    }

    const challengePoints = staticChallenge.points;

    let submissionId = crypto.randomUUID();

    // 2. Insert the authoritative queued record before acknowledging submission.
    const { data: submission, error: subErr } = await supabaseAdmin
      .from('coding_submissions')
      .insert({
        id: submissionId,
        user_email: normEmail,
        challenge_id: pid,
        source_code: sourceCode,
        status: 'queued',
        score: 0,
        max_score: challengePoints,
        passed_tests: 0,
        total_tests: 0,
        execution_time_ms: 0,
      })
      .select('id')
      .single();

    if (subErr || !submission?.id) {
      return { success: false, error: 'Submission could not be persisted.' };
    }
    submissionId = submission.id;

    // Save in in-memory fallback store
    fallbackSubmissions.set(submissionId, {
      id: submissionId,
      user_email: normEmail,
      challenge_id: pid,
      source_code: sourceCode,
      status: 'queued',
      score: 0,
      max_score: challengePoints,
      passed_tests: 0,
      total_tests: 0,
      execution_time_ms: 0,
      submitted_at: new Date().toISOString(),
      completed_at: null,
      error_message: null,
      stdout: '',
      stderr: '',
      public_results: [],
      hidden_results: [],
    });

    // Also persist in Redis if available
    if (redis) {
      try {
        await redis.set(`coding:sub:${submissionId}`, JSON.stringify(fallbackSubmissions.get(submissionId)), { ex: 3600 });
      } catch {}
    }

    // Increment submission counter
    await incrementSubmissionCount(normEmail, pid);

    // 3. Trigger asynchronous judge execution in background
    runSubmissionInBackground(submissionId, pid, sourceCode).catch((err) => {
      console.error(`[Judge Background] Submission ${submissionId} failed:`, err);
    });

    return {
      success: true,
      submissionId,
      status: 'queued',
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Server error creating submission.' };
  }
}

export async function createLocalTestSubmission(
  email: string,
  problemId: string,
  sourceCode: string
): Promise<{ success: boolean; submissionId?: string; status?: string; error?: string }> {
  const challenge = QISKIT_CHALLENGES.find((item) => item.id === problemId);
  if (!challenge) {
    return { success: false, error: `Invalid problem ID: ${problemId}` };
  }

  const submissionId = crypto.randomUUID();
  const submission: LocalTestSubmission = {
    id: submissionId,
    user_email: email,
    challenge_id: problemId,
    source_code: sourceCode,
    status: 'queued',
    score: 0,
    max_score: challenge.points,
    passed_tests: 0,
    total_tests: 0,
    execution_time_ms: 0,
    submitted_at: new Date().toISOString(),
    completed_at: null,
    error_message: null,
    stdout: '',
    stderr: '',
    public_results: [],
    hidden_results: [],
  };
  localTestSubmissions.set(submissionId, submission);
  await saveLocalTestSubmission(submission);

  void (async () => {
    submission.status = 'running';
    const result = await dispatchJudgeEvaluation(problemId, sourceCode, 'submit');
    submission.status = result.success
      ? 'completed'
      : result.error_message?.includes('timed out') ? 'timeout' : 'failed';
    submission.score = result.score;
    submission.passed_tests = result.passed_tests;
    submission.total_tests = result.total_tests;
    submission.execution_time_ms = result.execution_time_ms;
    submission.stdout = result.stdout;
    submission.stderr = result.stderr;
    submission.error_message = result.error_message;
    submission.public_results = result.public_results;
    submission.hidden_results = result.hidden_results;
    submission.completed_at = new Date().toISOString();
    await saveLocalTestSubmission(submission);
  })().catch((error) => {
    submission.status = 'system_error';
    submission.error_message = error instanceof Error ? error.message : 'Local evaluation failed.';
    submission.completed_at = new Date().toISOString();
    void saveLocalTestSubmission(submission);
  });

  return { success: true, submissionId, status: submission.status };
}

/**
 * Background worker execution for a queued submission.
 */
async function runSubmissionInBackground(
  submissionId: string,
  problemId: string,
  sourceCode: string
): Promise<void> {
  // Update status to 'running'
  const memRecord = fallbackSubmissions.get(submissionId);
  try {
    const { error: statusError } = await supabaseAdmin
      .from('coding_submissions')
      .update({ status: 'running' })
      .eq('id', submissionId);
    if (statusError) {
      throw statusError;
    }
  } catch (error) {
    console.error('[Judge] Could not mark submission as running:', error);
    if (memRecord) {
      memRecord.status = 'system_error';
      memRecord.error_message = 'Evaluation could not be started.';
    }
    return;
  }

  if (memRecord) {
    memRecord.status = 'running';
  }

  // Dispatch judge evaluation
  const evalResult = await dispatchJudgeEvaluation(problemId, sourceCode, 'submit');

  const status = evalResult.success
    ? 'completed'
    : evalResult.error_message?.includes('timed out')
    ? 'timeout'
    : (evalResult.total_tests > 0 && (evalResult.public_results?.length > 0 || evalResult.hidden_results?.length > 0))
    ? 'completed'
    : 'failed';

  const completedAt = new Date().toISOString();

  // Update in-memory fallback
  if (memRecord) {
    memRecord.status = status;
    memRecord.score = evalResult.score;
    memRecord.passed_tests = evalResult.passed_tests;
    memRecord.total_tests = evalResult.total_tests;
    memRecord.execution_time_ms = evalResult.execution_time_ms;
    memRecord.stdout = evalResult.stdout;
    memRecord.stderr = evalResult.stderr;
    memRecord.error_message = evalResult.error_message;
    memRecord.completed_at = completedAt;
    memRecord.public_results = evalResult.public_results || [];
    memRecord.hidden_results = (evalResult.hidden_results || []).map((t) => ({
      test_type: 'hidden',
      test_number: t.test_number,
      test_name: `Hidden Test #${t.test_number}`,
      passed: t.passed,
      execution_time_ms: t.execution_time_ms,
      error_message: t.passed ? null : 'Hidden test failed. Check constraints and edge cases.',
    }));
  }

  // Also persist in Redis
  if (redis && memRecord) {
    try {
      await redis.set(`coding:sub:${submissionId}`, JSON.stringify(memRecord), { ex: 3600 });
      // Add to user submissions list in Redis
      await redis.lpush(`coding:user_subs:${memRecord.user_email}`, submissionId);
    } catch {}
  }

  // Finalize the score and test results in one database transaction.
  try {
    // Insert individual public and hidden test results
    const testResults: Array<{
      test_type: 'public' | 'hidden';
      test_number: number;
      test_name: string | null;
      passed: boolean;
      execution_time_ms: number;
      error_message: string | null;
    }> = [];

    for (const t of evalResult.public_results || []) {
      testResults.push({
        test_type: 'public',
        test_number: t.test_number,
        test_name: t.test_name,
        passed: t.passed,
        execution_time_ms: t.execution_time_ms,
        error_message: t.error_message,
      });
    }

    for (const t of evalResult.hidden_results || []) {
      testResults.push({
        test_type: 'hidden',
        test_number: t.test_number,
        test_name: `Hidden Test #${t.test_number}`,
        passed: t.passed,
        execution_time_ms: t.execution_time_ms,
        error_message: t.passed ? null : 'Hidden test failed. Check constraints and edge cases.',
      });
    }

    const { error: finalizeError } = await supabaseAdmin.rpc('finalize_coding_submission', {
      p_submission_id: submissionId,
      p_status: status,
      p_score: evalResult.score,
      p_passed_tests: evalResult.passed_tests,
      p_total_tests: evalResult.total_tests,
      p_execution_time_ms: evalResult.execution_time_ms,
      p_stdout: evalResult.stdout,
      p_stderr: evalResult.stderr,
      p_error_message: evalResult.error_message,
      p_completed_at: completedAt,
      p_test_results: testResults,
    });
    if (finalizeError) {
      throw finalizeError;
    }
  } catch (dbErr) {
    console.error('[Judge] Supabase write failed:', dbErr);
    if (memRecord) {
      memRecord.status = 'system_error';
      memRecord.error_message = 'Evaluation result could not be persisted.';
    }
  }
}

/**
 * Retrieve submission from memory or Redis if not found in database.
 */
export async function getSubmissionWithFallback(submissionId: string): Promise<any | null> {
  const inMem = fallbackSubmissions.get(submissionId);
  if (inMem) return inMem;

  if (redis) {
    try {
      const data = await redis.get<string>(`coding:sub:${submissionId}`);
      if (data) {
        return typeof data === 'string' ? JSON.parse(data) : data;
      }
    } catch {}
  }

  return null;
}
