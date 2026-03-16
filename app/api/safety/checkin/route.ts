import { NextRequest, NextResponse } from 'next/server';
import { cookies }                  from 'next/headers';
import { createServerClient }       from '@supabase/ssr';
import type { EmergencyContact }    from '@/lib/safety/types';

export const dynamic = 'force-dynamic';

function makeSupabase() {
  const jar = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n: string) => jar.get(n)?.value } },
  );
}

// ─── POST /api/safety/checkin — create a date check-in ───────────────────────

export async function POST(request: NextRequest) {
  const supabase = makeSupabase();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null) as {
    dateName:         string;
    dateLocation:     string;
    dateStartsAt:     string;
    emergencyContact: EmergencyContact;
    checkinPromptAt:  string;
  } | null;

  if (!body?.dateName || !body?.dateLocation || !body?.dateStartsAt || !body?.emergencyContact?.phone) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Validate date is in the future
  if (new Date(body.dateStartsAt) < new Date()) {
    return NextResponse.json({ error: 'Date must be in the future' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('date_checkins')
    .insert({
      user_id:           user.id,
      date_name:         body.dateName.slice(0, 100),
      date_location:     body.dateLocation.slice(0, 200),
      date_starts_at:    body.dateStartsAt,
      emergency_contact: body.emergencyContact,
      checkin_prompt_at: body.checkinPromptAt,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// ─── GET /api/safety/checkin — list active check-ins ─────────────────────────

export async function GET() {
  const supabase = makeSupabase();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data } = await supabase
    .from('date_checkins')
    .select('*')
    .eq('user_id', user.id)
    .in('status', ['pending'])
    .order('date_starts_at', { ascending: true });

  return NextResponse.json(data ?? []);
}
