import { Redis } from '@upstash/redis';
import { supabase } from './supabase';

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

export const redis =
  redisUrl && redisToken
    ? new Redis({
        url: redisUrl,
        token: redisToken,
      })
    : null;

// Standard Cache TTL constants (in seconds)
export const CACHE_TTL = {
  PLATFORM_CONFIG: 3600, // 1 hour for system flags
  WHITELIST: 3600, // 1 hour for user auth/role
  USER_PROGRESS: 600, // 10 minutes for curriculum progress
  HACKATHON_TEAM: 300, // 5 minutes for hackathon team state
  COMPETITIONS: 600, // 10 minutes for competition submissions
  ADMIN_STATS: 60, // 1 minute for admin dashboard stats
  MEMBER_TEAM: 600, // 10 minutes for teammate lookups
} as const;

/**
 * Generic Cache-Aside implementation using Upstash Redis.
 *
 * 1. Checks Redis cache for given key.
 * 2. If hit, returns parsed cached data immediately.
 * 3. If miss, executes the fetcher function.
 * 4. Stores non-null/non-undefined result in Redis with TTL.
 * 5. Returns the fresh result.
 *
 * Gracefully degrades to direct fetcher execution if Redis is unavailable or errors.
 */
export async function cacheAside<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<T> {
  if (redis) {
    try {
      const cached = await redis.get<T>(key);
      if (cached !== null && cached !== undefined) {
        return cached;
      }
    } catch (err) {
      console.warn(`[Redis Cache-Aside] Read error for key "${key}", falling back:`, err);
    }
  }

  // Cache miss or Redis unavailable - query source of truth
  const result = await fetcher();

  if (redis && result !== null && result !== undefined) {
    try {
      await redis.set(key, result, { ex: ttlSeconds });
    } catch (cacheErr) {
      console.warn(`[Redis Cache-Aside] Failed to write cache for key "${key}":`, cacheErr);
    }
  }

  return result;
}

/**
 * Invalidates one or multiple keys in Upstash Redis.
 */
export async function invalidateCache(keys: string | string[]): Promise<void> {
  if (!redis) return;
  const keyList = (Array.isArray(keys) ? keys : [keys]).filter(Boolean);
  if (keyList.length === 0) return;

  try {
    if (keyList.length === 1) {
      await redis.del(keyList[0]);
    } else {
      await redis.del(...keyList);
    }
  } catch (err) {
    console.warn(`[Redis Cache-Aside] Invalidation failed for keys [${keyList.join(', ')}]:`, err);
  }
}

// -------------------------------------------------------------
// Domain-Specific Cache-Aside Helpers
// -------------------------------------------------------------

/**
 * Checks whether an email address is whitelisted in Redis or Supabase.
 */
export async function isEmailWhitelisted(
  email: string
): Promise<{ whitelisted: boolean; role?: string; fullName?: string }> {
  const normalizedEmail = email.trim().toLowerCase();
  const cacheKey = `whitelist:${normalizedEmail}`;

  return cacheAside(cacheKey, CACHE_TTL.WHITELIST, async () => {
    try {
      const { data, error } = await supabase
        .from('allowed_emails')
        .select('email, role, full_name, is_active')
        .ilike('email', normalizedEmail)
        .eq('is_active', true)
        .maybeSingle();

      if (error || !data) {
        return { whitelisted: false };
      }

      return {
        whitelisted: true,
        role: data.role,
        fullName: data.full_name || '',
      };
    } catch (err) {
      console.error('Database whitelist check error:', err);
      return { whitelisted: false };
    }
  });
}

/**
 * Checks if a member is already in a team (by email).
 */
export async function getMemberTeam(
  email: string
): Promise<{ inTeam: boolean; teamId?: string; teamName?: string; status?: string }> {
  const normalizedEmail = email.trim().toLowerCase();
  const cacheKey = `member_team:${normalizedEmail}`;

  return cacheAside(cacheKey, CACHE_TTL.MEMBER_TEAM, async () => {
    try {
      const { data, error } = await supabase
        .from('team_members')
        .select('team_id, status, hackathon_teams(name)')
        .ilike('email', normalizedEmail)
        .neq('status', 'declined')
        .maybeSingle();

      if (error || !data) {
        return { inTeam: false };
      }

      // @ts-expect-error Supabase join syntax
      const teamName = data.hackathon_teams?.name || 'Unknown Team';
      return {
        inTeam: true,
        teamId: data.team_id,
        teamName,
        status: data.status,
      };
    } catch (err) {
      console.error('Error checking member team status:', err);
      return { inTeam: false };
    }
  });
}

/**
 * Platform configuration cache-aside helper.
 */
export async function getPlatformConfigCached<T>(
  key: string,
  fetcher: () => Promise<T>
): Promise<T> {
  const cacheKey = `platform_config:${key}`;
  return cacheAside(cacheKey, CACHE_TTL.PLATFORM_CONFIG, fetcher);
}

export async function invalidatePlatformConfigCache(key?: string): Promise<void> {
  if (key) {
    await invalidateCache([`platform_config:${key}`, 'platform_config:all', 'admin:stats_overview']);
  } else {
    await invalidateCache(['platform_config:all', 'admin:stats_overview']);
  }
}

/**
 * User curriculum progress cache-aside helper.
 */
export async function getUserProgressCached<T>(
  email: string,
  fetcher: () => Promise<T>
): Promise<T> {
  const normalizedEmail = email.trim().toLowerCase();
  const cacheKey = `user_progress:${normalizedEmail}`;
  return cacheAside(cacheKey, CACHE_TTL.USER_PROGRESS, fetcher);
}

export async function invalidateUserProgressCache(email: string): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();
  await invalidateCache(`user_progress:${normalizedEmail}`);
}

/**
 * Hackathon team & invitations cache-aside helper.
 */
export async function getHackathonTeamCached<T>(
  email: string,
  fetcher: () => Promise<T>
): Promise<T> {
  const normalizedEmail = email.trim().toLowerCase();
  const cacheKey = `hackathon:team_data:${normalizedEmail}`;
  return cacheAside(cacheKey, CACHE_TTL.HACKATHON_TEAM, fetcher);
}

export async function invalidateHackathonTeamCache(emails: string | string[]): Promise<void> {
  const emailList = Array.isArray(emails) ? emails : [emails];
  const keys = emailList.map((e) => `hackathon:team_data:${e.trim().toLowerCase()}`);
  await invalidateCache(keys);
}

/**
 * Competition submissions cache-aside helper.
 */
export async function getCompetitionSubmissionsCached<T>(
  email: string,
  fetcher: () => Promise<T>
): Promise<T> {
  const normalizedEmail = email.trim().toLowerCase();
  const cacheKey = `competition:submissions:${normalizedEmail}`;
  return cacheAside(cacheKey, CACHE_TTL.COMPETITIONS, fetcher);
}

export async function invalidateCompetitionSubmissionsCache(email: string): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();
  await invalidateCache(`competition:submissions:${normalizedEmail}`);
}

/**
 * Invalidate all user-related caches across systems.
 */
export async function invalidateEmailCache(email: string): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();
  await invalidateCache([
    `whitelist:${normalizedEmail}`,
    `member_team:${normalizedEmail}`,
    `user_progress:${normalizedEmail}`,
    `hackathon:team_data:${normalizedEmail}`,
    `competition:submissions:${normalizedEmail}`,
    'admin:stats_overview',
    'admin:config_and_stats',
  ]);
}
