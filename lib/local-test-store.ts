import fs from 'fs/promises';
import path from 'path';

export interface LocalTestSubmission {
  id: string;
  user_email: string;
  challenge_id: string;
  source_code: string;
  status: string;
  score: number;
  max_score: number;
  passed_tests: number;
  total_tests: number;
  execution_time_ms: number;
  submitted_at: string;
  completed_at: string | null;
  error_message: string | null;
  stdout: string;
  stderr: string;
  public_results: unknown[];
  hidden_results: unknown[];
}

export const localTestSubmissions = new Map<string, LocalTestSubmission>();
export const localTestDrafts = new Map<string, string>();

const storePath = path.join(process.cwd(), '.next', 'local-test-store.json');

interface LocalTestStoreFile {
  submissions: Record<string, LocalTestSubmission>;
  drafts: Record<string, string>;
}

async function readStore(): Promise<LocalTestStoreFile> {
  try {
    const contents = await fs.readFile(storePath, 'utf8');
    const parsed = JSON.parse(contents) as Partial<LocalTestStoreFile>;
    return {
      submissions: parsed.submissions || {},
      drafts: parsed.drafts || {},
    };
  } catch {
    return { submissions: {}, drafts: {} };
  }
}

async function writeStore(store: LocalTestStoreFile): Promise<void> {
  await fs.mkdir(path.dirname(storePath), { recursive: true });
  const tempPath = `${storePath}.${process.pid}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(store), 'utf8');
  await fs.rename(tempPath, storePath);
}

export async function saveLocalTestSubmission(submission: LocalTestSubmission): Promise<void> {
  localTestSubmissions.set(submission.id, submission);
  const store = await readStore();
  store.submissions[submission.id] = submission;
  await writeStore(store);
}

export async function getLocalTestSubmission(id: string): Promise<LocalTestSubmission | null> {
  const store = await readStore();
  const submission = store.submissions[id];
  if (submission) localTestSubmissions.set(id, submission);
  return submission || localTestSubmissions.get(id) || null;
}

export async function listLocalTestSubmissions(): Promise<LocalTestSubmission[]> {
  const store = await readStore();
  for (const submission of Object.values(store.submissions)) {
    localTestSubmissions.set(submission.id, submission);
  }
  return Object.values(store.submissions);
}

export async function saveLocalTestDraft(key: string, code: string): Promise<void> {
  localTestDrafts.set(key, code);
  const store = await readStore();
  store.drafts[key] = code;
  await writeStore(store);
}

export async function getLocalTestDraft(key: string): Promise<string | null> {
  const inMemory = localTestDrafts.get(key);
  if (inMemory !== undefined) return inMemory;
  const store = await readStore();
  const code = store.drafts[key];
  if (code !== undefined) localTestDrafts.set(key, code);
  return code || null;
}
