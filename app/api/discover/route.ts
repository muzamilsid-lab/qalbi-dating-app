import { NextRequest, NextResponse } from 'next/server';
import { createClient }             from '@supabase/supabase-js';
import { cookies }                  from 'next/headers';
import { createServerClient }       from '@supabase/ssr';
import { RecommendationEngine }     from '@/lib/recommendations/RecommendationEngine';

// ─── Singleton engine per process ────────────────────────────────────────────
//     Next.js hot-reloads the module in dev, so we guard with a global.

declare global {
  // eslint-disable-next-line no-var
  var __recommendationEngine: RecommendationEngine | undefined;
}

function getEngine(): RecommendationEngine {
  if (!global.__recommendationEngine) {
    const supabaseUrl        = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const redisUrl           = process.env.REDIS_URL ?? 'redis://localhost:6379';

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing SUPABASE environment variables');
    }

    global.__recommendationEngine = new RecommendationEngine({
      supabaseUrl,
      supabaseServiceKey,
      redisUrl,
      isDev: process.env.NODE_ENV === 'development',
    });
  }
  return global.__recommendationEngine;
}

// ─── GET /api/discover ────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────

  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    },
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── Query params ──────────────────────────────────────────────────────────

  const { searchParams } = new URL(request.url);
  const limitParam  = searchParams.get('limit');
  const cursorParam = searchParams.get('cursor') ?? undefined;

  const limit = Math.min(
    Math.max(1, parseInt(limitParam ?? '20', 10) || 20),
    50, // hard cap
  );

  // ── Get feed ──────────────────────────────────────────────────────────────

  try {
    const engine   = getEngine();
    const response = await engine.getDiscoverFeed(user.id, limit, cursorParam);

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'no-store',
        'X-Feed-From-Cache': response.fromCache ? 'true' : 'false',
      },
    });
  } catch (err) {
    console.error('[GET /api/discover]', err);
    return NextResponse.json(
      { error: 'Failed to load discover feed' },
      { status: 500 },
    );
  }
}

// ─── POST /api/discover/swipe ─────────────────────────────────────────────────
//     Handles swipe actions and updates feed + attractiveness scores

export async function POST(request: NextRequest) {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    },
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { candidateId: string; direction: 'like' | 'pass' | 'superlike' };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { candidateId, direction } = body;
  if (!candidateId || !['like', 'pass', 'superlike'].includes(direction)) {
    return NextResponse.json({ error: 'Invalid swipe payload' }, { status: 400 });
  }

  try {
    // Persist swipe to DB
    await supabase.from('swipes').insert({
      swiper_id: user.id,
      swiped_id: candidateId,
      direction,
    });

    // Update Redis feed
    const engine = getEngine();
    await engine.onSwipe(user.id, candidateId, direction);

    // Check for match (both liked each other)
    const { data: theirSwipe } = await supabase
      .from('swipes')
      .select('id')
      .eq('swiper_id', candidateId)
      .eq('swiped_id', user.id)
      .eq('direction', 'like')
      .maybeSingle();

    const isMatch = direction !== 'pass' && !!theirSwipe;

    if (isMatch) {
      await supabase.from('matches').insert({
        user1_id: user.id < candidateId ? user.id : candidateId,
        user2_id: user.id < candidateId ? candidateId : user.id,
      });
    }

    return NextResponse.json({ success: true, match: isMatch });
  } catch (err) {
    console.error('[POST /api/discover]', err);
    return NextResponse.json({ error: 'Swipe failed' }, { status: 500 });
  }
}
