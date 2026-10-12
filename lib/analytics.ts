import { track as vercelTrack } from '@vercel/analytics';
import { supabase } from './supabase';

/**
 * Client-Side Analytics Event Tracker
 *
 * Dispatches custom events to @vercel/analytics and persists
 * genuine telemetry data into the server database and cache.
 */

// Helper to get or create an anonymous client visitor ID for unique daily stats
function getOrCreateVisitorId(): string {
  if (typeof window === 'undefined') return 'server';
  try {
    const STORAGE_KEY = 'qff_visitor_id';
    let id = localStorage.getItem(STORAGE_KEY);
    if (!id) {
      id = 'v_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
      localStorage.setItem(STORAGE_KEY, id);
    }
    return id;
  } catch {
    return 'anonymous';
  }
}

// Check if running in a local development environment
function isDevEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname;
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname.endsWith('.local')
  );
}

/**
 * Universal Event Tracker
 * Logs to Vercel Analytics and persistent API endpoint
 */
export function trackEvent(
  eventName: string,
  properties?: Record<string, string | number | boolean | null | undefined>
) {
  if (typeof window === 'undefined') return;
  if (isDevEnvironment()) return;

  // 1. Ingest into Vercel Web Analytics
  // NOTE: @vercel/analytics <Analytics /> already tracks page views automatically at the edge.
  // We NEVER pass 'page_view' here to prevent double-counting against the 50,000 monthly event quota.
  if (eventName !== 'page_view') {
    try {
      vercelTrack(eventName, properties || {});
    } catch (err) {
      console.debug('[Vercel Analytics] Track error:', err);
    }
  }

  // 2. Direct telemetry write to Supabase Pro (bypasses Vercel Serverless Functions completely)
  // For 'page_view', deduplicate per browser session
  if (eventName === 'page_view') {
    try {
      const pathKey = `qff_pv_${window.location.pathname || '/'}`;
      if (sessionStorage.getItem(pathKey)) {
        return; // Already tracked for this session; skip write
      }
      sessionStorage.setItem(pathKey, '1');
    } catch {
      // sessionStorage may fail in private mode; proceed
    }
  }

  try {
    const payload = {
      event: eventName,
      path: window.location.pathname || '/',
      properties: properties || {},
      visitor_id: getOrCreateVisitorId(),
      created_at: new Date().toISOString(),
    };

    supabase
      .from('telemetry_events')
      .insert(payload)
      .then(
        ({ error }: any) => {
          if (error) {
            console.debug('[Supabase Telemetry] Notice:', error.message);
          }
        },
        (err: any) => {
          console.debug('[Supabase Telemetry] Dispatch notice:', err);
        }
      );
  } catch (err: any) {
    console.debug('[Supabase Telemetry] Exception:', err);
  }
}

/**
 * Convenience Helpers for Common Conversion and Navigation Events
 */

export function trackPageView(path: string, referrer?: string) {
  trackEvent('page_view', {
    path,
    referrer: referrer || (typeof document !== 'undefined' ? document.referrer : ''),
  });
}

export function trackUnstopClick(source: string = 'general') {
  trackEvent('unstop_registration_click', { source });
}

export function trackLectureView(sessionId: string, title: string) {
  trackEvent('lecture_view', { sessionId, title });
}

export function trackQuizAttempt(
  sessionId: string,
  score: number,
  passed: boolean
) {
  trackEvent('quiz_submission', {
    sessionId,
    score,
    passed,
  });
}

export function trackTeamCreated(teamName: string, memberCount: number) {
  trackEvent('hackathon_team_created', {
    teamName,
    memberCount,
  });
}

export function trackCertificateVerification(serial: string, valid: boolean) {
  trackEvent('certificate_verification_search', {
    serial,
    valid,
  });
}

export function trackSocialClick(platform: string, destination: string) {
  trackEvent('social_link_click', {
    platform,
    destination,
  });
}
