'use client';

import React, { useEffect, useRef, Suspense } from 'react';
import { usePathname } from 'next/navigation';
import { trackPageView } from '@/lib/analytics';

function AnalyticsTracker() {
  const pathname = usePathname();
  const lastTrackedPath = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname) return;

    if (lastTrackedPath.current === pathname) return;
    lastTrackedPath.current = pathname;

    trackPageView(pathname);
  }, [pathname]);

  return null;
}

export function AnalyticsProvider() {
  return (
    <Suspense fallback={null}>
      <AnalyticsTracker />
    </Suspense>
  );
}
