'use client';

import useSWR from 'swr';
import { SessionQuiz } from '@/data/learning/types';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to fetch quizzes');
  }
  return res.json();
};

export function useQuizzes(options?: { admin?: boolean }) {
  const query = options?.admin ? '?admin=true' : '';
  const { data, error, isLoading, mutate } = useSWR(
    `/api/learning/quizzes${query}`,
    fetcher,
    {
      revalidateOnFocus: true,
      revalidateIfStale: false,
      dedupingInterval: 15000,
    }
  );

  const quizzes: Record<string, SessionQuiz> = data?.quizzes || {};
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
  const quiz: SessionQuiz | null = sessionId && quizzes[sessionId] ? quizzes[sessionId] : null;
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
