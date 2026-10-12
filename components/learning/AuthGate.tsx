'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Lock,
  AlertCircle,
  X,
  ExternalLink,
  MessageCircle,
} from 'lucide-react';
import { REGISTRATION_URL, WHATSAPP_COMMUNITY_URL } from '@/lib/constants';

interface AuthSession {
  email: string;
  fullName: string;
  role: string;
  isAdmin: boolean;
}

interface AuthGateProps {
  children: React.ReactNode;
  onSessionChange?: (session: AuthSession | null) => void;
}

const UNSTOP_REGISTRATION_URL = REGISTRATION_URL;

export function AuthGate({ children, onSessionChange }: AuthGateProps) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showToast, setShowToast] = useState(false);

  const currentSessionRef = useRef<AuthSession | null>(null);
  const isSyncingRef = useRef(false);


  function notifyAuthChange(newSession: AuthSession | null) {
    currentSessionRef.current = newSession;
    setSession(newSession);
    onSessionChange?.(newSession);
    if (typeof window !== 'undefined') {
      import('@/lib/session-client').then((m) => m.invalidateClientSessionCache());
      window.dispatchEvent(new CustomEvent('qff_auth_change', { detail: newSession }));
    }
  }

  async function syncSessionWithBackend(email: string, fullName: string, accessToken?: string) {
    if (isSyncingRef.current) return false;
    isSyncingRef.current = true;

    try {
      const verifyRes = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          fullName,
          accessToken,
        }),
      });

      const contentType = verifyRes.headers.get('content-type') || '';
      let verifyData: any = {};
      if (contentType.includes('application/json')) {
        verifyData = await verifyRes.json();
      } else {
        throw new Error(
          verifyRes.status >= 500
            ? 'Authentication service is momentarily recovering. Please refresh in a moment.'
            : `Authentication error (${verifyRes.status}). Please refresh and try again.`
        );
      }

      if (verifyRes.ok && verifyData.success) {
        notifyAuthChange(verifyData.session);

        // Clean up URL OAuth code/token params if present
        if (typeof window !== 'undefined') {
          if (
            window.location.search.includes('code=') ||
            window.location.hash.includes('access_token')
          ) {
            window.history.replaceState({}, document.title, window.location.pathname);
          }

          // Return to destination route if set
          const returnUrl = sessionStorage.getItem('qff_auth_return_url');
          if (
            returnUrl &&
            returnUrl !== window.location.pathname &&
            returnUrl.startsWith('/learning')
          ) {
            sessionStorage.removeItem('qff_auth_return_url');
            window.location.href = returnUrl;
          }
        }
        return true;
      } else if (verifyRes.status === 403) {
        // User is genuinely not whitelisted / not eligible
        await supabase.auth.signOut();
        notifyAuthChange(null);
        setShowToast(true);
        setErrorMessage(
          verifyData.error ||
            'You are not found in the verified participant whitelist. Please register on Unstop and join our WhatsApp group to quickly resolve access.'
        );
        return false;
      } else {
        await supabase.auth.signOut();
        notifyAuthChange(null);
        setShowToast(false);
        setErrorMessage(verifyData.error || 'Authentication failed. Please try again.');
        return false;
      }
    } catch (err: any) {
      console.error('Session sync error:', err);
      setErrorMessage(
        err?.message || 'Network error during authentication. Please refresh.'
      );
      setShowToast(false);
    } finally {
      isSyncingRef.current = false;
      setIsLoading(false);
      setIsSubmitting(false);
    }
    return false;
  }

  // 1. Check existing session on mount and subscribe to auth state changes
  useEffect(() => {
    let isMounted = true;

    // Check for OAuth error in URL on return
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const oauthError =
        searchParams.get('error_description') ||
        searchParams.get('error') ||
        hashParams.get('error_description') ||
        hashParams.get('error');

      if (oauthError) {
        setErrorMessage(oauthError);
        setShowToast(true);
        setIsLoading(false);
        setIsSubmitting(false);
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
      }

      if (searchParams.has('code') || hashParams.has('access_token')) {
        setIsSubmitting(true);
      }
    }

    async function checkCurrentSession() {
      try {
        setIsLoading(true);
        // 1. Check server session cookie first via deduplicated client cache
        const { getClientSession } = await import('@/lib/session-client');
        const data = await getClientSession();

        if (data.authenticated && data.session) {
          if (isMounted) {
            notifyAuthChange(data.session);
            setIsLoading(false);
            setIsSubmitting(false);
          }
          return;
        }

        // 2. If no server cookie, check Supabase auth
        const {
          data: { session: sbSession },
        } = await supabase.auth.getSession();

        if (sbSession?.user?.email) {
          const fullName =
            sbSession.user.user_metadata?.full_name ||
            sbSession.user.user_metadata?.name ||
            sbSession.user.user_metadata?.preferred_username ||
            '';
          await syncSessionWithBackend(sbSession.user.email, fullName, sbSession.access_token);
        }
      } catch (err) {
        console.error('Session check error:', err);
      } finally {
        if (isMounted) {
          const hasCode =
            typeof window !== 'undefined' &&
            (window.location.search.includes('code=') ||
              window.location.hash.includes('access_token'));
          if (!hasCode) {
            setIsLoading(false);
          }
        }
      }
    }

    checkCurrentSession();

    // 3. Listen to Supabase auth events (initial session, sign-in, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, sbSession) => {
      if (
        (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') &&
        sbSession?.user?.email
      ) {
        if (currentSessionRef.current?.email === sbSession.user.email.toLowerCase()) {
          if (isMounted) {
            setIsLoading(false);
            setIsSubmitting(false);
          }
          return;
        }

        const fullName =
          sbSession.user.user_metadata?.full_name ||
          sbSession.user.user_metadata?.name ||
          sbSession.user.user_metadata?.preferred_username ||
          '';
        await syncSessionWithBackend(sbSession.user.email, fullName, sbSession.access_token);
      } else if (event === 'SIGNED_OUT') {
        if (isMounted) {
          notifyAuthChange(null);
          setIsLoading(false);
          setIsSubmitting(false);
        }
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. Google OAuth sign-in handler
  async function handleGoogleSignIn() {
    setErrorMessage('');
    setShowToast(false);
    try {
      setIsSubmitting(true);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(
          'qff_auth_return_url',
          window.location.pathname + window.location.search
        );
      }
      const siteUrl =
        typeof window !== 'undefined'
          ? window.location.origin
          : (process.env.NEXT_PUBLIC_SITE_URL || '');
      const redirectUrl = `${siteUrl}/learning`;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            prompt: 'select_account',
          },
        },
      });

      if (error) {
        setErrorMessage(error.message);
        setShowToast(true);
        setIsSubmitting(false);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Google sign-in failed');
      setShowToast(true);
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div key="auth-gate-loading" className="min-h-[50vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-burgundy border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Verifying authorized access...</p>
        </div>
      </div>
    );
  }

  if (session) {
    return <React.Fragment key="auth-gate-authenticated">{children}</React.Fragment>;
  }

  // If not authenticated, render login gate + Toast
  return (
    <div key="auth-gate-login" className="min-h-[70vh] flex items-center justify-center p-4 relative font-sans">
      {/* Toast Notification for Ineligible Participants */}
      {showToast && (
        <div className="fixed top-5 right-5 sm:right-6 z-50 max-w-md w-[calc(100%-2.5rem)] bg-white dark:bg-[#18080B] border-2 border-rose-300 dark:border-rose-800 rounded-xl shadow-xl p-4 transition-all">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 mt-0.5">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div className="flex-1 text-xs">
              <div className="flex items-center justify-between gap-2">
                <h4 className="font-bold text-slate-900 dark:text-[#FAF6F3] text-sm">Access Restricted</h4>
                <button
                  onClick={() => setShowToast(false)}
                  className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 rounded-md cursor-pointer"
                  aria-label="Dismiss toast"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-slate-700 dark:text-slate-300 mt-1 leading-relaxed">
                You are not in the registered whitelist. Please register on{' '}
                <a
                  href={UNSTOP_REGISTRATION_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-burgundy dark:text-[#E89BA5] underline inline-flex items-center gap-1 hover:text-burgundy-deep"
                >
                  Unstop
                  <ExternalLink className="w-3 h-3 inline" />
                </a>{' '}
                and join our{' '}
                <a
                  href={WHATSAPP_COMMUNITY_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-emerald-600 dark:text-emerald-400 underline inline-flex items-center gap-1 hover:text-emerald-700"
                >
                  WhatsApp group
                  <ExternalLink className="w-3 h-3 inline" />
                </a>{' '}
                for quickly resolving the issue.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-md bg-white dark:bg-[#150709] border border-slate-200 dark:border-[#3D1418] rounded-2xl shadow-lg p-6 sm:p-8 font-sans">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-full bg-burgundy/10 text-burgundy dark:bg-burgundy/20 dark:text-[#E89BA5] flex items-center justify-center mx-auto mb-3">
            <Lock className="w-6 h-6" />
          </div>
          <div className="font-mono text-[11px] font-semibold text-burgundy dark:text-[#E89BA5] uppercase tracking-[0.2em] mb-1">
            PARTICIPANT GATEWAY
          </div>
          <h2 className="font-serif text-2xl font-bold text-slate-900 dark:text-[#FAF6F3] tracking-tight">
            Qiskit Fall Fest 2026 Portal
          </h2>
          <p className="font-sans text-xs text-slate-600 dark:text-slate-400 mt-1">
            Online Phase Learning Platform & Hackathon Workspace
          </p>
        </div>

        {errorMessage && (
          <div className="mb-5 p-3.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-900 dark:text-rose-200 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
            <div className="leading-relaxed space-y-1.5">
              {errorMessage.toLowerCase().includes('eligible') ||
              errorMessage.toLowerCase().includes('whitelist') ||
              errorMessage.toLowerCase().includes('unstop') ? (
                <>
                  <p>
                    You are not in the registered whitelist. Please register on{' '}
                    <a
                      href={UNSTOP_REGISTRATION_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-bold text-burgundy dark:text-[#E89BA5] underline inline-flex items-center gap-1 hover:text-burgundy-deep"
                    >
                      Unstop
                      <ExternalLink className="w-3 h-3 inline" />
                    </a>{' '}
                    and join the{' '}
                    <a
                      href={WHATSAPP_COMMUNITY_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-bold text-emerald-600 dark:text-emerald-400 underline inline-flex items-center gap-1 hover:text-emerald-700"
                    >
                      WhatsApp group
                      <ExternalLink className="w-3 h-3 inline" />
                    </a>{' '}
                    for quickly resolving the issue.
                  </p>
                </>
              ) : (
                <span className="font-medium">{errorMessage}</span>
              )}
            </div>
          </div>
        )}

        {/* Google Sign In Button */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={isSubmitting}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-slate-300 dark:border-[#3D1418] bg-white dark:bg-[#1C0A0D] rounded-xl text-sm font-semibold text-slate-800 dark:text-[#FAF6F3] hover:bg-slate-50 dark:hover:bg-[#250D11] hover:border-slate-400 dark:hover:border-burgundy/50 transition-all shadow-sm disabled:opacity-60 cursor-pointer"
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
              <span className="w-4 h-4 border-2 border-burgundy border-t-transparent rounded-full animate-spin" />
              <span>Connecting to Google...</span>
            </span>
          ) : (
            <>
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Continue with Google</span>
            </>
          )}
        </button>

        <div className="mt-6 pt-5 border-t border-slate-100 dark:border-[#3D1418] text-center space-y-3">
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Please sign in using your registered Gmail account. Access is restricted to registered Unstop participants and event organizers.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 pt-1 text-xs font-mono font-semibold">
            <a
              href={UNSTOP_REGISTRATION_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-burgundy dark:text-[#E89BA5] hover:underline inline-flex items-center gap-1"
            >
              <span>Register on Unstop</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <span className="text-slate-300 dark:text-slate-700">·</span>
            <a
              href="/"
              className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
            >
              Return to Main Site
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
