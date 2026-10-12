import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session || !session.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const problemId = req.nextUrl.searchParams.get('problemId');
    if (!problemId) {
      return NextResponse.json({ success: false, error: 'Problem ID required' }, { status: 400 });
    }

    const { data: draft } = await supabaseAdmin
      .from('coding_drafts')
      .select('code, updated_at')
      .eq('user_email', session.email.toLowerCase())
      .eq('challenge_id', problemId.toUpperCase())
      .single();

    return NextResponse.json({
      success: true,
      code: draft?.code || null,
      updatedAt: draft?.updated_at || null,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session || !session.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { problemId, code } = await req.json();
    if (!problemId || typeof code !== 'string') {
      return NextResponse.json({ success: false, error: 'Invalid parameters' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('coding_drafts')
      .upsert(
        {
          user_email: session.email.toLowerCase(),
          challenge_id: problemId.toUpperCase(),
          code,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_email,challenge_id' }
      );

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, savedAt: new Date().toISOString() });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
