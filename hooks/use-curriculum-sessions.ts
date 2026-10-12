'use client';

import useSWR from 'swr';
import { CURRICULUM_SESSIONS } from '@/data/learning/curriculum';
import { LectureSession } from '@/data/learning/types';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch curriculum sessions');
  return res.json();
};

export function useCurriculumSessions() {
  const { data, error, isLoading, mutate } = useSWR(
    '/api/learning/sessions',
    fetcher,
    {
      fallbackData: { success: true, sessions: CURRICULUM_SESSIONS, overrides: {} },
      revalidateOnFocus: true,
      revalidateIfStale: false,
      dedupingInterval: 60000,
    }
  );

  const sessions: LectureSession[] = data?.sessions || CURRICULUM_SESSIONS;
  const overrides: Record<string, any> = data?.overrides || {};

  return {
    sessions,
    overrides,
    isLoading: isLoading && !data,
    isError: !!error,
    mutate,
  };
}

export function useCurriculumSession(sessionId?: string) {
  const { sessions, overrides, isLoading, isError, mutate } = useCurriculumSessions();
  const session =
    sessions.find((s) => s.id === sessionId) ||
    CURRICULUM_SESSIONS.find((s) => s.id === sessionId);
  const override = sessionId ? overrides[sessionId] || null : null;

  return {
    session,
    override,
    isLoading,
    isError,
    mutate,
  };
}
