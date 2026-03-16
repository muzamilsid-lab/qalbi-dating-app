import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { constructWebhookEvent } from '@/lib/stripe/StripeService';
import { invalidateFeaturesCache } from '@/lib/stripe/getPremiumFeatures';
import type { SubscriptionPlan, SubscriptionStatus } from '@/lib/stripe/types';

export const dynamic = 'force-dynamic';

// ─── Supabase service-role client ─────────────────────────────────────────────

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

// ─── Plan resolution from Stripe price metadata ───────────────────────────────

function planFromPriceId(priceId: string): SubscriptionPlan {
  const plusMonthly  = process.env.STRIPE_PRICE_PLUS_MONTHLY;
  const plusYearly   = process.env.STRIPE_PRICE_PLUS_YEARLY;
  const goldMonthly  = process.env.STRIPE_PRICE_GOLD_MONTHLY;
  const goldYearly   = process.env.STRIPE_PRICE_GOLD_YEARLY;

  if (priceId === plusMonthly || priceId === plusYearly)  return 'plus';
  if (priceId === goldMonthly || priceId === goldYearly)  return 'gold';
  return 'free';
}

// ─── Upsert subscription row ──────────────────────────────────────────────────

async function upsertSubscription(params: {
  userId:        string;
  customerId:    string;
  sub:           Stripe.Subscription;
  plan:          SubscriptionPlan;
  status:        SubscriptionStatus;
}) {
  const supabase = getAdmin();
  const { userId, customerId, sub, plan, status } = params;

  await supabase.from('subscriptions').upsert({
    user_id:                userId,
    stripe_subscription_id: sub.id,
    stripe_customer_id:     customerId,
    plan,
    status,
    current_period_start:   new Date((sub as any).current_period_start * 1000).toISOString(),
    current_period_end:     new Date((sub as any).current_period_end   * 1000).toISOString(),
    cancel_at_period_end:   (sub as any).cancel_at_period_end ?? false,
    trial_end:              (sub as any).trial_end
      ? new Date((sub as any).trial_end * 1000).toISOString()
      : null,
  }, { onConflict: 'user_id' });

  // Sync customer ID onto profile too
  await supabase.from('profiles')
    .update({ stripe_customer_id: customerId })
    .eq('id', userId);

  await invalidateFeaturesCache(userId);
}

// ─── Idempotency guard ────────────────────────────────────────────────────────

async function markProcessed(eventId: string): Promise<boolean> {
  const supabase = getAdmin();
  const { error } = await supabase.from('stripe_webhook_events').insert({
    id:           eventId,
    type:         '',
    processed:    true,
    processed_at: new Date().toISOString(),
  });
  // Unique constraint violation = already processed
  return !error;
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const body      = await request.text();
  const signature = request.headers.get('stripe-signature');
  if (!signature) return NextResponse.json({ error: 'No signature' }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = constructWebhookEvent(body, signature);
  } catch (err: any) {
    return NextResponse.json({ error: `Webhook error: ${err.message}` }, { status: 400 });
  }

  // Idempotency: skip if already processed
  const isNew = await markProcessed(event.id);
  if (!isNew) return NextResponse.json({ received: true });

  try {
    switch (event.type) {

      // ── Checkout completed → first subscription activation ──────────────────
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== 'subscription') break;

        const userId     = session.metadata?.userId;
        const customerId = session.customer as string;
        const subId      = session.subscription as string;
        if (!userId || !subId) break;

        // Fetch full subscription object to get price details
        const stripe = (await import('@/lib/stripe/StripeService')).getStripe();
        const sub    = await stripe.subscriptions.retrieve(subId);
        const priceId = sub.items.data[0]?.price.id ?? '';
        const plan    = planFromPriceId(priceId);

        await upsertSubscription({ userId, customerId, sub, plan, status: 'active' });
        break;
      }

      // ── Renewal paid ────────────────────────────────────────────────────────
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        if ((invoice as any).billing_reason === 'subscription_create') break; // handled above

        const customerId = invoice.customer as string;
        const subId      = (invoice as any).subscription as string;
        if (!subId) break;

        const supabase = getAdmin();
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single();
        if (!profile) break;

        const stripe = (await import('@/lib/stripe/StripeService')).getStripe();
        const sub    = await stripe.subscriptions.retrieve(subId);
        const plan   = planFromPriceId(sub.items.data[0]?.price.id ?? '');

        await upsertSubscription({ userId: profile.id, customerId, sub, plan, status: 'active' });
        break;
      }

      // ── Payment failed → grace period ─────────────────────────────────────
      case 'invoice.payment_failed': {
        const invoice    = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        const subId      = (invoice as any).subscription as string;
        if (!subId) break;

        const supabase = getAdmin();
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single();
        if (!profile) break;

        // Mark as past_due (don't strip access yet — Stripe retries)
        await supabase.from('subscriptions')
          .update({ status: 'past_due' })
          .eq('user_id', profile.id);

        await invalidateFeaturesCache(profile.id);

        // TODO: trigger email via your email provider (Resend / SendGrid)
        // await sendPaymentFailedEmail({ userId: profile.id });
        break;
      }

      // ── Subscription deleted → downgrade to free ──────────────────────────
      case 'customer.subscription.deleted': {
        const sub        = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;

        const supabase = getAdmin();
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single();
        if (!profile) break;

        await supabase.from('subscriptions').upsert({
          user_id:                profile.id,
          stripe_subscription_id: sub.id,
          stripe_customer_id:     customerId,
          plan:                   'free',
          status:                 'cancelled',
          cancel_at_period_end:   false,
        }, { onConflict: 'user_id' });

        await invalidateFeaturesCache(profile.id);
        break;
      }

      // ── Subscription updated (tier change, cancel toggle) ─────────────────
      case 'customer.subscription.updated': {
        const sub        = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;

        const supabase = getAdmin();
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single();
        if (!profile) break;

        const plan   = planFromPriceId(sub.items.data[0]?.price.id ?? '');
        const status = mapStripeStatus(sub.status);

        await upsertSubscription({ userId: profile.id, customerId, sub, plan, status });
        break;
      }
    }
  } catch (err) {
    console.error('[Stripe webhook] handler error:', err);
    // Return 200 so Stripe doesn't retry — log for manual investigation
  }

  return NextResponse.json({ received: true });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapStripeStatus(s: Stripe.Subscription.Status): SubscriptionStatus {
  switch (s) {
    case 'active':   return 'active';
    case 'trialing': return 'trialing';
    case 'past_due':
    case 'unpaid':   return 'past_due';
    default:         return 'cancelled';
  }
}
