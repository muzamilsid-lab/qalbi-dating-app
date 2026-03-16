import { NextRequest, NextResponse } from 'next/server';
import { cookies }                  from 'next/headers';
import { createServerClient }       from '@supabase/ssr';
import { EngagementAction }         from '@/components/Prompts/types';

export const dynamic = 'force-dynamic';

const VALID_ACTIONS: EngagementAction[] = ['view', 'like', 'reply', 'swipe_right_after'];

// ─── POST /api/prompts/engagement ────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name: string) => cookieStore.get(name)?.value } },
  );

  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { promptId: number; authorId: string; action: EngagementAction };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { promptId, authorId, action } = body;

  if (!promptId || !authorId || !VALID_ACTIONS.includes(action)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 422 });
  }
  if (user.id === authorId) {
    return NextResponse.json({ success: true }); // silently drop self-engagements
  }

  const { error } = await supabase.from('prompt_engagements').insert({
    prompt_id: promptId,
    viewer_id: user.id,
    author_id: authorId,
    action,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// ─── GET /api/prompts/engagement?promptId=X — A/B stats (admin/dev only) ──────

export async function GET(request: NextRequest) {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,   // service role for analytics
    { cookies: { get: (name: string) => cookieStore.get(name)?.value } },
  );

  const promptId = new URL(request.url).searchParams.get('promptId');
  if (!promptId) return NextResponse.json({ error: 'promptId required' }, { status: 400 });

  const { data, error } = await supabase
    .from('prompt_engagements')
    .select('action, prompt_id')
    .eq('prompt_id', parseInt(promptId, 10));

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Aggregate counts per action
  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    counts[row.action] = (counts[row.action] ?? 0) + 1;
  }

  const views = counts['view'] ?? 0;
  const engagementRate = views > 0
    ? ((counts['like'] ?? 0) + (counts['reply'] ?? 0)) / views
    : 0;

  return NextResponse.json({
    promptId: parseInt(promptId, 10),
    counts,
    engagementRate: Math.round(engagementRate * 10000) / 100, // as percentage
  });
}
