import { NextRequest, NextResponse } from 'next/server';
import { cookies }                  from 'next/headers';
import { createServerClient }       from '@supabase/ssr';
import {
  getOrCreateCustomer,
  createCheckoutSession,
  getPriceId,
} from '@/lib/stripe/StripeService';
import { PLANS } from '@/lib/stripe/types';

function makeSupabase() {
  const jar = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n: string) => jar.get(n)?.value } },
  );
}

// ─── POST /api/stripe/checkout ────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const supabase = makeSupabase();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { priceEnvKey } = await request.json().catch(() => ({})) as { priceEnvKey?: string };
  if (!priceEnvKey) return NextResponse.json({ error: 'priceEnvKey required' }, { status: 400 });

  // Validate that it's a known plan key
  const validKeys = PLANS.map(p => p.id);
  if (!validKeys.includes(priceEnvKey)) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
  }

  let priceId: string;
  try {
    priceId = getPriceId(priceEnvKey);
  } catch {
    return NextResponse.json({ error: 'Price not configured' }, { status: 500 });
  }

  // Fetch profile for stripe_customer_id + email
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id, display_name')
    .eq('id', user.id)
    .single();

  // Get-or-create Stripe customer
  const customerId = await getOrCreateCustomer({
    email:              user.email!,
    userId:             user.id,
    name:               profile?.display_name,
    existingCustomerId: profile?.stripe_customer_id,
  });

  // Persist customer ID if newly created
  if (!profile?.stripe_customer_id) {
    await supabase.from('profiles')
      .update({ stripe_customer_id: customerId })
      .eq('id', user.id);
  }

  const origin = request.headers.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL!;

  const url = await createCheckoutSession({
    customerId,
    priceId,
    userId:     user.id,
    successUrl: `${origin}/settings/subscription?success=1`,
    cancelUrl:  `${origin}/settings/subscription?cancelled=1`,
  });

  return NextResponse.json({ url });
}
