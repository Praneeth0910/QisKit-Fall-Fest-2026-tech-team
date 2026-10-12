'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Clock, ArrowRight, X } from 'lucide-react';

const STORAGE_KEY = 'qff_learning_deadline_banner_dismissed_14oct_v1';

export function DeadlineExtensionBanner() {
  const [isDismissed, setIsDismissed] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      setIsDismissed(saved === 'true');
    } catch {
      setIsDismissed(false);
    }
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch {}
  };

  if (!isMounted || isDismissed) {
    return null;
  }

  return (
    <div className="relative overflow-hidden p-4 sm:p-5 rounded-2xl border border-amber-300 dark:border-amber-800/80 bg-amber-50/80 dark:bg-[#1A0A0D] shadow-xs">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/80 flex items-center justify-center shrink-0 mt-0.5">
            <Clock className="w-5 h-5" />
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                Official Deadline Extension
              </span>
              <span className="px-2 py-0.5 rounded-full font-mono text-[9px] font-bold uppercase tracking-wider bg-amber-200/70 dark:bg-amber-950 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700">
                Extended to 14 Oct
              </span>
            </div>

            <h3 className="font-serif font-bold text-slate-900 dark:text-[#FAF6F3] text-sm sm:text-base">
              Online Competition Submissions Open Until 14 October 2026, 11:59 PM IST
            </h3>

            <p className="font-sans text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed max-w-2xl">
              All Day 1, Day 2, and Day 3 creative competition submission deadlines (Tech Reels, Digital Poster Creation, and Technical Essay Competition) have been officially extended to Wednesday, 14 October 2026, 11:59 PM IST.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-2">
              <Link
                href="/learning?challenge=1"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-burgundy hover:bg-burgundy-deep text-white font-mono text-xs font-semibold transition-colors shadow-xs"
              >
                <span>Day 01: Tech Reels</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                href="/learning?challenge=2"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-[#250D11] hover:bg-slate-100 dark:hover:bg-[#331117] text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-[#3D1418] font-mono text-xs font-semibold transition-colors"
              >
                <span>Day 02: Digital Poster</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                href="/learning?challenge=3"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-[#250D11] hover:bg-slate-100 dark:hover:bg-[#331117] text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-[#3D1418] font-mono text-xs font-semibold transition-colors"
              >
                <span>Day 03: Essay</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>

        <button
          onClick={handleDismiss}
          className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 rounded-md cursor-pointer transition-colors shrink-0"
          aria-label="Dismiss extension banner"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
