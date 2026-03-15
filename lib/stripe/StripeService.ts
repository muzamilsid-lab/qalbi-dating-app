import Stripe from 'stripe';

// ─── Singleton ────────────────────────────────────────────────────────────────

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2026-02-25.clover',
      typescript:  true,
    });
  }
  return _stripe;
}

// ─── Price IDs resolved from env ─────────────────────────────────────────────

export function getPriceId(envKey: string): string {
  const id = process.env[envKey];
  if (!id) throw new Error(`Missing env var: ${envKey}`);
  return id;
}

// ─── Customer management ──────────────────────────────────────────────────────

export async function createCustomer(params: {
  email:    string;
  userId:   string;
  name?:    string;
}): Promise<string> {
  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email:    params.email,
    name:     params.name,
    metadata: { userId: params.userId },
  });
  return customer.id;
}

export async function getOrCreateCustomer(params: {
  email:              string;
  userId:             string;
  name?:              string;
  existingCustomerId?: string | null;
}): Promise<string> {
  if (params.existingCustomerId) return params.existingCustomerId;
  return createCustomer(params);
}

// ─── Checkout session ─────────────────────────────────────────────────────────

export async function createCheckoutSession(params: {
  customerId:  string;
  priceId:     string;
  userId:      string;
  successUrl:  string;
  cancelUrl:   string;
  trialDays?:  number;
}): Promise<string> {
  const stripe = getStripe();

  const session = await stripe.checkout.sessions.create({
    customer:             params.customerId,
    mode:                 'subscription',
    payment_method_types: ['card'],
    line_items: [{
      price:    params.priceId,
      quantity: 1,
    }],
    subscription_data: {
      trial_period_days: params.trialDays,
      metadata:          { userId: params.userId },
    },
    success_url: params.successUrl,
    cancel_url:  params.cancelUrl,
    metadata:    { userId: params.userId },
    allow_promotion_codes: true,
  });

  return session.url!;
}

// ─── Customer portal ──────────────────────────────────────────────────────────

export async function createPortalSession(params: {
  customerId:  string;
  returnUrl:   string;
}): Promise<string> {
  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer:   params.customerId,
    return_url: params.returnUrl,
  });
  return session.url;
}

// ─── Subscription helpers ─────────────────────────────────────────────────────

export async function cancelSubscription(stripeSubId: string): Promise<void> {
  const stripe = getStripe();
  await stripe.subscriptions.update(stripeSubId, { cancel_at_period_end: true });
}

// ─── Webhook signature verification ──────────────────────────────────────────

export function constructWebhookEvent(
  payload:   string | Buffer,
  signature: string,
): Stripe.Event {
  const stripe = getStripe();
  return stripe.webhooks.constructEvent(
    payload,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET!,
  );
}
