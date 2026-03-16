import { NextRequest, NextResponse } from 'next/server';
import { cookies }                  from 'next/headers';
import { createServerClient }       from '@supabase/ssr';
import { getPremiumFeatures }       from '@/lib/stripe/getPremiumFeatures';
import { invalidateFeaturesCache }  from '@/lib/stripe/getPremiumFeatures';

export const dynamic = 'force-dynamic';

function makeSupabase() {
  const jar = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n: string) => jar.get(n)?.value } },
  );
}

// ─── PUT /api/settings/incognito ──────────────────────────────────────────────

export async function PUT(request: NextRequest) {
  const supabase = makeSupabase();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { enabled } = await request.json().catch(() => ({})) as { enabled?: boolean };
  if (typeof enabled !== 'boolean') {
    return NextResponse.json({ error: 'enabled (boolean) required' }, { status: 400 });
  }

  // Incognito mode is a Gold feature
  if (enabled) {
    const features = await getPremiumFeatures(user.id);
    if (!features.incognitoMode) {
      return NextResponse.json({ error: 'Requires Qalbi Gold' }, { status: 403 });
    }
  }

  const { error } = await supabase
    .from('profiles')
    .update({ incognito_mode: enabled })
    .eq('id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await invalidateFeaturesCache(user.id);
  return NextResponse.json({ success: true, incognitoMode: enabled });
}
