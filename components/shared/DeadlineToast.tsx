'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Clock, X, ArrowRight } from 'lucide-react';

const STORAGE_KEY = 'qff_deadline_notice_dismissed_14oct_v1';

export function DeadlineToast() {
  const [isVisible, setIsVisible] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    try {
      const dismissed = localStorage.getItem(STORAGE_KEY);
      if (!dismissed) {
        // Short delay for smooth entrance after page mount
        const timer = setTimeout(() => {
          setIsVisible(true);
        }, 800);
        return () => clearTimeout(timer);
      }
    } catch {
      // LocalStorage access fallback
      setIsVisible(true);
    }
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch {}
  };

  if (!isMounted || !isVisible) {
    return null;
  }

  return (
    <aside
      aria-label="Deadline Extension Notice"
      className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 max-w-sm sm:max-w-md w-[calc(100%-2rem)] bg-white dark:bg-[#18080B] border-2 border-amber-300 dark:border-amber-800/80 rounded-2xl shadow-2xl p-4 sm:p-4.5 font-sans transition-all duration-300 animate-in fade-in slide-in-from-bottom-4"
    >
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5 border border-amber-200 dark:border-amber-800/60">
          <Clock className="w-4 h-4" />
        </div>

        <div className="flex-1 min-w-0 text-xs">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                Deadline Extended
              </span>
              <span className="font-mono text-[9px] px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 font-semibold">
                Until 14 Oct
              </span>
            </div>
            <button
              onClick={handleDismiss}
              className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 rounded-md cursor-pointer transition-colors"
              aria-label="Dismiss deadline notice"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <h4 className="font-serif font-bold text-slate-900 dark:text-[#FAF6F3] text-sm mt-1 leading-snug">
            Creative Competitions Extended to 14 Oct
          </h4>

          <p className="text-slate-600 dark:text-slate-300 mt-1 leading-relaxed text-[11px] sm:text-xs">
            Submissions for Tech Reels, Digital Poster, and Technical Essay have been extended to Wednesday, 14 October 2026, 11:59 PM IST.
          </p>

          <div className="mt-3 flex items-center gap-3">
            <Link
              href="/learning?challenge=1"
              onClick={handleDismiss}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-burgundy hover:bg-burgundy-deep text-white font-mono text-[11px] font-semibold transition-colors shadow-xs"
            >
              <span>View Challenges</span>
              <ArrowRight className="w-3 h-3" />
            </Link>

            <button
              onClick={handleDismiss}
              className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-mono text-[11px] font-semibold transition-colors cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
