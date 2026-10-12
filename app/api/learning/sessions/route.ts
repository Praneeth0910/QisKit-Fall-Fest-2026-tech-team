import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { CURRICULUM_SESSIONS } from '@/data/learning/curriculum';
import { LectureSession } from '@/data/learning/types';
import {
  getPlatformConfigCached,
  invalidatePlatformConfigCache,
} from '@/lib/redis';
import { extractYoutubeId } from '@/lib/youtube';

function mergeSessionWithOverride(
  base: LectureSession,
  override?: Record<string, any>
): LectureSession {
  if (!override) return base;

  const rawYt = override.youtubeUrl || override.youtubeId || base.youtubeId;
  const ytId = extractYoutubeId(rawYt);

  return {
    ...base,
    title: override.title !== undefined && override.title.trim() !== '' ? override.title.trim() : base.title,
    dateStr: override.dateStr !== undefined && override.dateStr.trim() !== '' ? override.dateStr.trim() : base.dateStr,
    timeStr: override.timeStr !== undefined && override.timeStr.trim() !== '' ? override.timeStr.trim() : base.timeStr,
    duration: override.duration !== undefined && override.duration.trim() !== '' ? override.duration.trim() : base.duration,
    description: override.description !== undefined && override.description.trim() !== '' ? override.description.trim() : base.description,
    youtubeId: ytId || base.youtubeId,
    youtubeUrl: override.youtubeUrl?.trim() || (ytId ? `https://www.youtube.com/watch?v=${ytId}` : base.youtubeUrl),
    defaultStartSeconds:
      typeof override.defaultStartSeconds === 'number'
        ? override.defaultStartSeconds
        : base.defaultStartSeconds,
    lectureNotesUrl:
      override.lectureNotesUrl !== undefined
        ? override.lectureNotesUrl?.trim() || undefined
        : base.lectureNotesUrl,
    slidesUrl:
      override.slidesUrl !== undefined
        ? override.slidesUrl?.trim() || undefined
        : base.slidesUrl,
    liveMeetingUrl: override.liveMeetingUrl !== undefined ? override.liveMeetingUrl?.trim() || undefined : base.liveMeetingUrl,
    isLive: typeof override.isLive === 'boolean' ? override.isLive : false,
    liveNotice: override.liveNotice !== undefined ? override.liveNotice?.trim() || undefined : undefined,
    customEmbedUrl: override.customEmbedUrl !== undefined ? override.customEmbedUrl?.trim() || undefined : undefined,
    speaker: {
      ...base.speaker,
      ...(override.speaker || {}),
    },
    coSpeakers: Array.isArray(override.coSpeakers) ? override.coSpeakers : base.coSpeakers,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedId = searchParams.get('id');

    // Retrieve cached session overrides
    const overrides = await getPlatformConfigCached<Record<string, any>>(
      'session_overrides',
      async () => {
        const { data } = await supabaseAdmin
          .from('platform_config')
          .select('value')
          .eq('key', 'session_overrides')
          .limit(1);
        return data?.[0]?.value ?? {};
      }
    );

    const mergedSessions = CURRICULUM_SESSIONS.map((s) =>
      mergeSessionWithOverride(s, overrides?.[s.id])
    );

    if (requestedId) {
      const session = mergedSessions.find((s) => s.id === requestedId);
      if (!session) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }
      return NextResponse.json(
        {
          success: true,
          session,
          override: overrides?.[requestedId] || null,
        },
        {
          headers: {
            'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
          },
        }
      );
    }

    return NextResponse.json(
      {
        success: true,
        sessions: mergedSessions,
        overrides: overrides || {},
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        },
      }
    );
  } catch (error: any) {
    console.error('Error fetching sessions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dynamic sessions', sessions: CURRICULUM_SESSIONS },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session || !session.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { sessionId, updates, reset } = body;

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    // Fetch existing overrides directly from Supabase to prevent stale concurrency
    const { data: currentData } = await supabaseAdmin
      .from('platform_config')
      .select('value')
      .eq('key', 'session_overrides')
      .limit(1);

    const currentOverrides: Record<string, any> = currentData?.[0]?.value || {};

    if (reset) {
      delete currentOverrides[sessionId];
    } else if (updates) {
      const rawYt = updates.youtubeUrl || updates.youtubeId;
      const extractedId = rawYt ? extractYoutubeId(rawYt) : undefined;

      currentOverrides[sessionId] = {
        ...(currentOverrides[sessionId] || {}),
        ...updates,
        ...(extractedId ? { youtubeId: extractedId } : {}),
        updatedAt: new Date().toISOString(),
        updatedBy: session.email,
      };
    }

    // Upsert into platform_config
    const { error: upsertError } = await supabaseAdmin
      .from('platform_config')
      .upsert({
        key: 'session_overrides',
        value: currentOverrides,
        updated_at: new Date().toISOString(),
      });

    if (upsertError) throw upsertError;

    // Invalidate Redis caches
    await invalidatePlatformConfigCache('session_overrides');
    await invalidatePlatformConfigCache();

    // Compute updated sessions
    const mergedSessions = CURRICULUM_SESSIONS.map((s) =>
      mergeSessionWithOverride(s, currentOverrides[s.id])
    );

    return NextResponse.json({
      success: true,
      message: reset
        ? `Reverted Session ${sessionId} to default curriculum settings.`
        : `Successfully updated live details for ${sessionId}.`,
      sessions: mergedSessions,
      overrides: currentOverrides,
    });
  } catch (error: any) {
    console.error('Error updating session configuration:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to update session' },
      { status: 500 }
    );
  }
}
