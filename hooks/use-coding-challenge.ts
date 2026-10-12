'use client';

import useSWR from 'swr';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch coding challenge status');
  return res.json();
};

export function useCodingChallengeStatus() {
  const { data, error, isLoading, mutate } = useSWR(
    '/api/qiskit/challenges',
    fetcher,
    {
      revalidateOnFocus: true,
      revalidateIfStale: false,
      dedupingInterval: 60000,
    }
  );

  const isLocked = Boolean(data?.isLocked ?? data?.config?.is_locked ?? true);
  const isAdmin = Boolean(data?.isAdmin);

  return {
    isLocked,
    isAdmin,
    config: data?.config || null,
    challenges: data?.challenges || [],
    isLoading,
    isError: !!error,
    mutate,
  };
}
