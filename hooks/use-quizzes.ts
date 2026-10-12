'use client';

import useSWR from 'swr';
import { SESSION_QUIZZES } from '@/data/learning/quizzes';
import { SessionQuiz } from '@/data/learning/types';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch quizzes');
  return res.json();
};

export function useQuizzes(options?: { admin?: boolean }) {
  const query = options?.admin ? '?admin=true' : '';
  const { data, error, isLoading, mutate } = useSWR(
    `/api/learning/quizzes${query}`,
    fetcher,
    {
      fallbackData: { success: true, quizzes: SESSION_QUIZZES, overrides: {} },
      revalidateOnFocus: true,
      revalidateIfStale: false,
      dedupingInterval: 60000,
    }
  );

  const quizzes: Record<string, SessionQuiz> = data?.quizzes || SESSION_QUIZZES;
  const overrides: Record<string, any> = data?.overrides || {};

  return {
    quizzes,
    overrides,
    isLoading: isLoading && !data,
    isError: !!error,
    mutate,
  };
}

export function useQuiz(sessionId?: string, options?: { admin?: boolean }) {
  const { quizzes, overrides, isLoading, isError, mutate } = useQuizzes(options);
  const quiz: SessionQuiz | null = sessionId
    ? quizzes[sessionId] || SESSION_QUIZZES[sessionId] || null
    : null;
  const isLocked = Boolean(quiz?.isLocked);
  const override = sessionId ? overrides[sessionId] || null : null;

  return {
    quiz,
    isLocked,
    override,
    isLoading,
    isError,
    mutate,
  };
}
