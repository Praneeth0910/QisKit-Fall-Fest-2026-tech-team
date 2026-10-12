'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Activity,
  Eye,
  Users,
  TrendingUp,
  RefreshCw,
  ExternalLink,
  Laptop,
  Smartphone,
  Tablet,
  CheckCircle2,
  Clock,
  Zap,
  Globe,
  Award,
  Layers,
  BarChart3,
  Flame,
} from 'lucide-react';
import type { AnalyticsSummary } from '@/lib/analytics-server';

export function AdminAnalyticsView() {
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPurging, setIsPurging] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/admin/analytics');
      if (res.ok) {
        const json = await res.json();
        if (json.analytics) {
          setData(json.analytics);
        }
      }
    } catch (err) {
      console.error('Error fetching analytics:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePurgeCache = async () => {
    try {
      setIsPurging(true);
      setStatusMessage(null);
      const res = await fetch('/api/admin/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'purge-cache' }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.analytics) {
          setData(json.analytics);
        }
        setStatusMessage('Analytics cache purged & synchronized fresh from Redis!');
        setTimeout(() => setStatusMessage(null), 4000);
      }
    } catch (err) {
      console.error('Error purging analytics cache:', err);
    } finally {
      setIsPurging(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
    // Auto refresh every 90s only when tab is actively visible
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      fetchAnalytics();
    }, 90000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading && !data) {
    return (
      <div className="p-12 bg-white dark:bg-[#150709] border border-slate-200 dark:border-[#3D1418] rounded-xl flex flex-col items-center justify-center text-slate-500 dark:text-slate-400 gap-3 font-sans">
        <RefreshCw className="w-6 h-6 animate-spin text-burgundy dark:text-[#E89BA5]" />
        <p className="text-xs font-medium">Aggregating telemetry from Redis & Vercel Analytics...</p>
      </div>
    );
  }

  const maxDailyViews = Math.max(
    ...(data?.history7Days?.map((d) => d.views) || [1]),
    1
  );

  const totalDeviceCount =
    (data?.deviceBreakdown?.desktop || 0) +
    (data?.deviceBreakdown?.mobile || 0) +
    (data?.deviceBreakdown?.tablet || 0) || 1;

  const desktopPct = Math.round(((data?.deviceBreakdown?.desktop || 0) / totalDeviceCount) * 100);
  const mobilePct = Math.round(((data?.deviceBreakdown?.mobile || 0) / totalDeviceCount) * 100);
  const tabletPct = Math.round(((data?.deviceBreakdown?.tablet || 0) / totalDeviceCount) * 100);

  return (
    <div className="space-y-6 font-sans">
      {/* Top Banner & Cache Controls */}
      <div className="p-5 bg-gradient-to-r from-slate-900 via-burgundy/90 to-slate-900 dark:from-[#150709] dark:via-burgundy/80 dark:to-[#150709] text-white rounded-xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 border border-slate-800 dark:border-[#3D1418]">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              Live Vercel Analytics & Speed Insights Ingestion
            </span>
          </div>
          <h2 className="text-lg font-bold">Real-time Telemetry & Traffic Intelligence</h2>
          <p className="text-xs text-slate-300 max-w-xl">
            High-speed Edge telemetry with Upstash Redis cache-aside caching (60s TTL) and
            @vercel/analytics event tracking.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={fetchAnalytics}
            disabled={isLoading}
            className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-semibold text-white flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
            title="Fetch latest cached metrics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          <button
            type="button"
            onClick={handlePurgeCache}
            disabled={isPurging}
            className="px-3.5 py-1.5 rounded-lg bg-burgundy hover:bg-burgundy-deep border border-rose-400/30 text-xs font-semibold text-white flex items-center gap-1.5 shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
            title="Invalidate Redis cache key admin:analytics_summary"
          >
            <Zap className={`w-3.5 h-3.5 text-amber-300 ${isPurging ? 'animate-spin' : ''}`} />
            {isPurging ? 'Purging Cache...' : 'Purge Cache'}
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs rounded-lg flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* KPI Highlight Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Page Views */}
        <div className="p-5 rounded-xl bg-white dark:bg-[#150709] border border-slate-200 dark:border-[#3D1418] shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Total Pageviews
            </span>
            <div className="p-2 rounded-lg bg-burgundy/10 text-burgundy dark:bg-burgundy/20 dark:text-[#E89BA5]">
              <Eye className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-[#FAF6F3]">
              {data?.totalPageViews?.toLocaleString() || 0}
            </span>
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded">
              +{data?.todayPageViews || 0} today
            </span>
          </div>
          <span className="text-[11px] text-slate-400 dark:text-slate-500 block mt-1">Across all public routes</span>
        </div>

        {/* Unique Visitors */}
        <div className="p-5 rounded-xl bg-white dark:bg-[#150709] border border-slate-200 dark:border-[#3D1418] shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Unique Visitors
            </span>
            <div className="p-2 rounded-lg bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-[#FAF6F3]">
              {data?.totalUniqueVisitors?.toLocaleString() || 0}
            </span>
            <span className="text-[11px] font-semibold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40 px-1.5 py-0.5 rounded">
              +{data?.todayUniqueVisitors || 0} today
            </span>
          </div>
          <span className="text-[11px] text-slate-400 dark:text-slate-500 block mt-1">HyperLogLog cardinality</span>
        </div>

        {/* Unstop Registrations CTA */}
        <div className="p-5 rounded-xl bg-white dark:bg-[#150709] border border-slate-200 dark:border-[#3D1418] shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Unstop CTA Clicks
            </span>
            <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
              <Flame className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-[#FAF6F3]">
              {data?.eventCounts?.unstop_registration_click?.toLocaleString() || 0}
            </span>
            <span className="text-[11px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded font-medium">
              Outbound Portal
            </span>
          </div>
          <span className="text-[11px] text-slate-400 dark:text-slate-500 block mt-1">Primary conversion lead</span>
        </div>

        {/* Hackathon Teams / Active Users */}
        <div className="p-5 rounded-xl bg-white dark:bg-[#150709] border border-slate-200 dark:border-[#3D1418] shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Whitelisted & Formed
            </span>
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-[#FAF6F3]">
              {data?.platformConversions?.whitelistedUsers || 0}
            </span>
            <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-[#1C0A0D] px-1.5 py-0.5 rounded">
              {data?.platformConversions?.teamsFormed || 0} teams
            </span>
          </div>
          <span className="text-[11px] text-slate-400 dark:text-slate-500 block mt-1">Authorized hackathon roster</span>
        </div>
      </div>

      {/* Main Charts & Top Pages Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 7-Day Traffic Activity Chart */}
        <div className="lg:col-span-2 p-6 bg-white dark:bg-[#150709] border border-slate-200 dark:border-[#3D1418] rounded-xl shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-burgundy dark:text-[#E89BA5]" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-[#FAF6F3]">7-Day Traffic & Visitor Velocity</h3>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-burgundy dark:bg-[#E89BA5]"></span>
                <span>Pageviews</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-sky-400"></span>
                <span>Visitors</span>
              </div>
            </div>
          </div>

          <div className="pt-4 pb-2">
            <div className="grid grid-cols-7 gap-2 sm:gap-3 items-end h-44 border-b border-slate-100 dark:border-[#3D1418] pb-2">
              {(data?.history7Days || []).map((day, idx) => {
                const viewHeightPct = Math.max(8, Math.round((day.views / maxDailyViews) * 100));
                const visitorHeightPct = Math.max(6, Math.round((day.visitors / maxDailyViews) * 100));

                return (
                  <div key={day.date || idx} className="flex flex-col items-center h-full justify-end group relative">
                    {/* Tooltip on hover */}
                    <div className="absolute -top-12 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity bg-slate-900 dark:bg-black border border-slate-800 dark:border-[#3D1418] text-white text-[10px] rounded px-2 py-1 shadow-lg whitespace-nowrap z-10">
                      <p className="font-bold">{day.date}</p>
                      <p className="text-slate-300">{day.views} views • {day.visitors} unique</p>
                    </div>

                    <div className="w-full flex items-end justify-center gap-1 sm:gap-1.5 h-full">
                      {/* Views Bar */}
                      <div
                        style={{ height: `${viewHeightPct}%` }}
                        className="w-1/2 max-w-[18px] bg-burgundy dark:bg-[#E89BA5] hover:bg-burgundy-deep dark:hover:bg-rose-300 rounded-t transition-all duration-300"
                      />
                      {/* Visitors Bar */}
                      <div
                        style={{ height: `${visitorHeightPct}%` }}
                        className="w-1/2 max-w-[18px] bg-sky-400 hover:bg-sky-500 rounded-t transition-all duration-300"
                      />
                    </div>
                    <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mt-2 truncate w-full text-center">
                      {day.dayLabel?.split(',')[0] || day.dayLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1">
            <span>Aggregated across all pages on edge CDN</span>
            <span className="font-medium text-slate-700 dark:text-slate-300">
              Avg: {Math.round((data?.totalPageViews || 0) / Math.max(1, (data?.history7Days?.length || 7)))} views/day
            </span>
          </div>
        </div>

        {/* Device & Client Breakdown */}
        <div className="p-6 bg-white dark:bg-[#150709] border border-slate-200 dark:border-[#3D1418] rounded-xl shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-burgundy dark:text-[#E89BA5]" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-[#FAF6F3]">Device Distribution</h3>
          </div>

          {/* Visual Stacked Bar */}
          <div className="space-y-1.5 pt-2">
            <div className="h-3.5 w-full bg-slate-100 dark:bg-[#1C0A0D] rounded-full overflow-hidden flex">
              <div
                style={{ width: `${desktopPct}%` }}
                className="bg-burgundy dark:bg-[#E89BA5] h-full transition-all duration-500"
                title={`Desktop: ${desktopPct}%`}
              />
              <div
                style={{ width: `${mobilePct}%` }}
                className="bg-sky-500 h-full transition-all duration-500"
                title={`Mobile: ${mobilePct}%`}
              />
              <div
                style={{ width: `${tabletPct}%` }}
                className="bg-amber-400 h-full transition-all duration-500"
                title={`Tablet: ${tabletPct}%`}
              />
            </div>
            <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <span>Desktop ({desktopPct}%)</span>
              <span>Mobile ({mobilePct}%)</span>
              <span>Tablet ({tabletPct}%)</span>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <div className="p-2.5 rounded-lg border border-slate-100 dark:border-[#3D1418] bg-slate-50/70 dark:bg-[#1C0A0D] flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-[#FAF6F3]">
                <Laptop className="w-4 h-4 text-burgundy dark:text-[#E89BA5]" />
                <span>Desktop Workstations</span>
              </div>
              <span className="text-xs font-bold text-slate-900 dark:text-[#FAF6F3]">
                {data?.deviceBreakdown?.desktop || 0} ({desktopPct}%)
              </span>
            </div>

            <div className="p-2.5 rounded-lg border border-slate-100 dark:border-[#3D1418] bg-slate-50/70 dark:bg-[#1C0A0D] flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-[#FAF6F3]">
                <Smartphone className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                <span>Mobile Devices</span>
              </div>
              <span className="text-xs font-bold text-slate-900 dark:text-[#FAF6F3]">
                {data?.deviceBreakdown?.mobile || 0} ({mobilePct}%)
              </span>
            </div>

            <div className="p-2.5 rounded-lg border border-slate-100 dark:border-[#3D1418] bg-slate-50/70 dark:bg-[#1C0A0D] flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-[#FAF6F3]">
                <Tablet className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>Tablets & iPads</span>
              </div>
              <span className="text-xs font-bold text-slate-900 dark:text-[#FAF6F3]">
                {data?.deviceBreakdown?.tablet || 0} ({tabletPct}%)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Top Pages Table & Event Action Counters */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Pages Table */}
        <div className="bg-white dark:bg-[#150709] border border-slate-200 dark:border-[#3D1418] rounded-xl shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-200 dark:border-[#3D1418] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-burgundy dark:text-[#E89BA5]" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-[#FAF6F3]">Most Popular Pages & Routes</h3>
            </div>
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Sorted by frequency</span>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-[#3D1418]">
            {(data?.topPages || []).map((page, idx) => (
              <div key={page.path || idx} className="p-3.5 px-5 flex items-center justify-between hover:bg-slate-50/60 dark:hover:bg-[#1C0A0D]/60 transition-colors">
                <div className="flex items-center gap-3 min-w-0 pr-4">
                  <span className="text-xs font-bold text-slate-400 w-4">#{idx + 1}</span>
                  <div className="min-w-0">
                    <Link
                      href={page.path}
                      target="_blank"
                      className="text-xs font-mono font-medium text-slate-900 dark:text-[#FAF6F3] hover:text-burgundy dark:hover:text-[#E89BA5] flex items-center gap-1 truncate"
                    >
                      <span>{page.path}</span>
                      <ExternalLink className="w-3 h-3 text-slate-400 shrink-0" />
                    </Link>
                    <div className="w-32 bg-slate-100 dark:bg-[#1C0A0D] rounded-full h-1 mt-1 overflow-hidden">
                      <div
                        style={{ width: `${Math.min(100, page.percentage || 10)}%` }}
                        className="bg-burgundy dark:bg-[#E89BA5] h-full rounded-full"
                      />
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-xs font-bold text-slate-900 dark:text-[#FAF6F3] block font-mono">
                    {page.views.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 block">
                    {page.percentage}% of views
                  </span>
                </div>
              </div>
            ))}

            {(data?.topPages || []).length === 0 && (
              <div className="p-6 text-center text-xs text-slate-400">
                No route telemetry recorded yet.
              </div>
            )}
          </div>
        </div>

        {/* Key Event Conversions & Engagement Funnel */}
        <div className="p-6 bg-white dark:bg-[#150709] border border-slate-200 dark:border-[#3D1418] rounded-xl shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-burgundy dark:text-[#E89BA5]" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-[#FAF6F3]">User Interaction & Conversion Funnel</h3>
          </div>

          <div className="space-y-3">
            <div className="p-3 rounded-lg border border-slate-200 dark:border-[#3D1418] bg-slate-50/70 dark:bg-[#1C0A0D] flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-[#FAF6F3] block">
                  Outbound Unstop Registrations
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                  Users directed to IBM / Unstop portal
                </span>
              </div>
              <span className="text-sm font-bold font-mono text-burgundy dark:text-[#E89BA5]">
                {data?.eventCounts?.unstop_registration_click || 0}
              </span>
            </div>

            <div className="p-3 rounded-lg border border-slate-200 dark:border-[#3D1418] bg-slate-50/70 dark:bg-[#1C0A0D] flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-[#FAF6F3] block">
                  Learning Module Explorations
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                  Active participants studying quantum lectures
                </span>
              </div>
              <span className="text-sm font-bold font-mono text-slate-900 dark:text-[#FAF6F3]">
                {data?.eventCounts?.lecture_view || 0}
              </span>
            </div>

            <div className="p-3 rounded-lg border border-slate-200 dark:border-[#3D1418] bg-slate-50/70 dark:bg-[#1C0A0D] flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-[#FAF6F3] block">
                  Curriculum Quiz Attempts
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                  Masterclass verification quizzes submitted
                </span>
              </div>
              <span className="text-sm font-bold font-mono text-slate-900 dark:text-[#FAF6F3]">
                {data?.eventCounts?.quiz_submission || 0}
              </span>
            </div>

            <div className="p-3 rounded-lg border border-slate-200 dark:border-[#3D1418] bg-slate-50/70 dark:bg-[#1C0A0D] flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-[#FAF6F3] block">
                  Hackathon Teams Created
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                  Registered groups in the collaborative workspace
                </span>
              </div>
              <span className="text-sm font-bold font-mono text-slate-900 dark:text-[#FAF6F3]">
                {data?.platformConversions?.teamsFormed || data?.eventCounts?.hackathon_team_created || 0}
              </span>
            </div>

            <div className="p-3 rounded-lg border border-slate-200 dark:border-[#3D1418] bg-slate-50/70 dark:bg-[#1C0A0D] flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-[#FAF6F3] block">
                  Official Certificates Issued & Verified
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                  Verified tamper-proof serial inquiries
                </span>
              </div>
              <span className="text-sm font-bold font-mono text-emerald-700 dark:text-emerald-400">
                {data?.platformConversions?.certificatesIssued || data?.eventCounts?.certificate_verification_search || 0}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Real-time Activity Stream & Vercel Official Integration */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Real-time Stream */}
        <div className="lg:col-span-2 bg-white dark:bg-[#150709] border border-slate-200 dark:border-[#3D1418] rounded-xl shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-200 dark:border-[#3D1418] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-[#FAF6F3]">Live Activity Feed (Last 20 Events)</h3>
            </div>
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded">
              Real-time Ingest
            </span>
          </div>

          <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-[#3D1418]">
            {(data?.recentEvents || []).map((ev, i) => {
              const dateObj = new Date(ev.timestamp);
              const timeStr = !isNaN(dateObj.getTime())
                ? dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                : 'Just now';

              return (
                <div key={i} className="p-3 px-5 flex items-center justify-between text-xs hover:bg-slate-50/50 dark:hover:bg-[#1C0A0D]/50">
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-[#250D11] text-slate-700 dark:text-slate-300 shrink-0">
                      {ev.event?.replace(/_/g, ' ')}
                    </span>
                    <span className="font-mono text-slate-900 dark:text-[#FAF6F3] truncate">
                      {ev.path || '/'}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 text-slate-400 dark:text-slate-500 text-[11px]">
                    <span className="capitalize">{ev.device || 'desktop'}</span>
                    <span className="font-mono">{timeStr}</span>
                  </div>
                </div>
              );
            })}

            {(data?.recentEvents || []).length === 0 && (
              <div className="p-8 text-center text-xs text-slate-400">
                No recent activity stream entries available.
              </div>
            )}
          </div>
        </div>

        {/* Vercel Official Analytics Quick Link & Architecture */}
        <div className="p-6 bg-slate-900 dark:bg-[#150709] border border-slate-800 dark:border-[#3D1418] text-white rounded-xl shadow-xs space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-white">
              <BarChart3 className="w-5 h-5 text-burgundy dark:text-[#E89BA5]" />
              <h3 className="text-sm font-bold">Vercel Web Analytics & Speed Insights</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Vercel native analytics captures Core Web Vitals (LCP, INP, CLS) and visitor metrics
              at the edge without heavy third-party tracking scripts.
            </p>

            <div className="p-3 rounded-lg bg-slate-800/80 dark:bg-[#1C0A0D] border border-slate-700/60 dark:border-[#3D1418] space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-slate-300">
                <span>Privacy Standard:</span>
                <span className="text-emerald-400 font-semibold">GDPR & Cookie-Free</span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span>Edge Acceleration:</span>
                <span className="text-sky-400 font-semibold">Vercel Edge Network</span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span>Speed Insights:</span>
                <span className="text-amber-400 font-semibold">Real-time Web Vitals</span>
              </div>
            </div>
          </div>

          <a
            href="https://vercel.com"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-2.5 px-4 rounded-lg bg-white text-slate-900 font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-slate-100 transition-colors shadow-sm"
          >
            <span>Open Vercel Dashboard</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}
