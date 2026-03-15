/**
 * GET /api/safety/checkin/alert
 *
 * Called by a cron job every 5 minutes (e.g. Vercel Cron, GitHub Actions, or
 * an external scheduler hitting: GET /api/safety/checkin/alert with the
 * CRON_SECRET header).
 *
 * Finds check-ins that:
 *   - Are still 'pending'
 *   - checkin_prompt_at has passed (date started 2h ago)
 *   - No response in 30 minutes after prompt
 *   - Not yet alerted
 *
 * Sends an SMS/email to the emergency contact via your configured provider.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient }             from '@supabase/supabase-js';
import type { EmergencyContact }    from '@/lib/safety/types';

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

const ALERT_WINDOW_MS = 30 * 60 * 1000; // 30 minutes after prompt before alerting

export async function GET(request: NextRequest) {
  // Authenticate cron caller
  const secret = request.headers.get('x-cron-secret');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const admin = getAdmin();
  const now   = new Date();

  // Find overdue check-ins
  const alertThreshold = new Date(now.getTime() - ALERT_WINDOW_MS).toISOString();

  const { data: overdue } = await admin
    .from('date_checkins')
    .select('*')
    .eq('status', 'pending')
    .is('checked_in_at', null)
    .is('alerted_at', null)
    .lte('checkin_prompt_at', alertThreshold);

  if (!overdue?.length) {
    return NextResponse.json({ processed: 0 });
  }

  let alerted = 0;

  for (const checkin of overdue) {
    const contact = checkin.emergency_contact as EmergencyContact;

    // Send alert (pluggable — replace with Twilio, SendGrid, etc.)
    await sendAlert({
      contact,
      userName:     checkin.user_id,   // In production: fetch display_name
      dateName:     checkin.date_name,
      dateLocation: checkin.date_location,
      dateStartedAt: checkin.date_starts_at,
    });

    // Mark alerted
    await admin.from('date_checkins')
      .update({ alerted_at: now.toISOString(), status: 'alerted' })
      .eq('id', checkin.id);

    alerted++;
  }

  return NextResponse.json({ processed: alerted });
}

// ─── Alert sender (stub — wire to your SMS/email provider) ───────────────────

async function sendAlert(params: {
  contact:      EmergencyContact;
  userName:     string;
  dateName:     string;
  dateLocation: string;
  dateStartedAt: string;
}) {
  const { contact, dateName, dateLocation, dateStartedAt } = params;

  const dateTime  = new Date(dateStartedAt).toLocaleString('en-GB', { timeZone: 'Asia/Riyadh' });
  const message   =
    `⚠️ QALBI SAFETY ALERT\n\n` +
    `A Qalbi user listed you as their emergency contact.\n\n` +
    `They were supposed to check in after their date and have not responded.\n\n` +
    `Date details:\n` +
    `• Meeting: ${dateName}\n` +
    `• Location: ${dateLocation}\n` +
    `• Started: ${dateTime}\n\n` +
    `Please check on them. If you cannot reach them, contact local authorities.\n\n` +
    `Emergency numbers: Police 999 | Ambulance 998`;

  // ── Twilio SMS ─────────────────────────────────────────────────────────
  const twilioSid   = process.env.TWILIO_ACCOUNT_SID;
  const twilioToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioFrom  = process.env.TWILIO_FROM_NUMBER;

  if (twilioSid && twilioToken && twilioFrom && contact.phone) {
    const body = new URLSearchParams({
      To:   contact.phone,
      From: twilioFrom,
      Body: message,
    });

    await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64')}`,
      },
      body: body.toString(),
    }).catch(err => console.error('[checkin/alert] SMS error:', err));
  }

  // ── Email fallback via SMTP webhook ───────────────────────────────────
  const emailWebhook = process.env.EMAIL_ALERT_WEBHOOK_URL;
  if (emailWebhook && contact.email) {
    await fetch(emailWebhook, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        to:      contact.email,
        subject: '⚠️ Qalbi Safety Alert — Check on your contact',
        text:    message,
      }),
    }).catch(err => console.error('[checkin/alert] email error:', err));
  }
}
