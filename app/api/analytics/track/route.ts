import { NextRequest, NextResponse } from 'next/server';
import { recordAnalyticsEvent } from '@/lib/analytics-server';

function isBot(userAgent?: string): boolean {
  if (!userAgent) return false;
  return /bot|crawler|spider|crawling|headless|lighthouse|pingdom|uptime|slurp|facebookexternalhit|baiduspider|twitterbot|bytespider/i.test(
    userAgent
  );
}

export async function POST(request: NextRequest) {
  try {
    const userAgent = request.headers.get('user-agent') || undefined;

    // Fast return for bots and automated crawlers to save serverless CPU
    if (isBot(userAgent)) {
      return NextResponse.json({ success: true, ignored: true });
    }

    let body: any = null;
    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      body = await request.json().catch(() => null);
    } else {
      const rawText = await request.text().catch(() => '');
      try {
        body = JSON.parse(rawText);
      } catch {
        body = null;
      }
    }

    if (!body?.event) {
      return NextResponse.json({ error: 'event is required' }, { status: 400 });
    }

    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      undefined;

    await recordAnalyticsEvent({
      event: body.event,
      path: body.path || '/',
      properties: body.properties,
      visitorId: body.visitorId,
      userAgent,
      ip,
      timestamp: body.timestamp || new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.warn('[Analytics Track Route] Ingestion warning:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to record event' },
      { status: 200 }
    );
  }
}
