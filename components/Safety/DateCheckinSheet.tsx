'use client';

import { useCallback, useState }   from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import clsx                        from 'clsx';
import { useDateCheckin }          from '@/lib/safety/hooks/useDateCheckin';
import type { EmergencyContact, CreateCheckinPayload } from '@/lib/safety/types';

// ─── Form state ───────────────────────────────────────────────────────────────

const EMPTY_FORM: CreateCheckinPayload = {
  dateName:         '',
  dateLocation:     '',
  dateStartsAt:     '',
  emergencyContact: { name: '', phone: '', email: '' },
};

// ─── Check-in prompt banner ───────────────────────────────────────────────────

export function CheckinPromptBanner() {
  const { awaitingResponse, markSafe, cancelCheckin } = useDateCheckin();

  if (awaitingResponse.length === 0) return null;

  const checkin = awaitingResponse[0];

  return (
    <motion.div
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0,   opacity: 1 }}
      exit={{ y: -80, opacity: 0 }}
      className="fixed top-4 inset-x-4 z-50 rounded-2xl bg-red-950 border border-red-600 p-4 shadow-2xl"
    >
      <div className="flex gap-3">
        <span className="text-2xl shrink-0">🔔</span>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-white text-sm">Safety Check-In</p>
          <p className="text-red-300 text-xs mt-0.5">
            You were meeting <strong>{checkin.date_name}</strong> at {checkin.date_location}.
            Are you safe?
          </p>
        </div>
      </div>

      <div className="flex gap-2 mt-3">
        <button
          onClick={() => markSafe(checkin.id)}
          className="flex-1 py-2.5 rounded-xl bg-green-700 hover:bg-green-600 text-white text-sm font-bold transition-colors"
        >
          ✅ I'm Safe
        </button>
        <button
          onClick={() => cancelCheckin(checkin.id)}
          className="px-4 py-2.5 rounded-xl bg-neutral-800 text-neutral-400 text-sm hover:text-white transition-colors"
        >
          Cancel
        </button>
      </div>
    </motion.div>
  );
}

// ─── Date Check-In Sheet ──────────────────────────────────────────────────────

interface Props {
  open:    boolean;
  onClose: () => void;
}

export function DateCheckinSheet({ open, onClose }: Props) {
  const { checkins, createCheckin, markSafe, cancelCheckin } = useDateCheckin();
  const [view, setView]     = useState<'list' | 'new'>('list');
  const [form, setForm]     = useState<CreateCheckinPayload>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  const setField = useCallback(<K extends keyof CreateCheckinPayload>(
    key: K, value: CreateCheckinPayload[K],
  ) => {
    setForm(prev => ({ ...prev, [key]: value }));
  }, []);

  const setContactField = useCallback((key: keyof EmergencyContact, value: string) => {
    setForm(prev => ({
      ...prev,
      emergencyContact: { ...prev.emergencyContact, [key]: value },
    }));
  }, []);

  const submit = useCallback(async () => {
    if (!form.dateName || !form.dateLocation || !form.dateStartsAt || !form.emergencyContact.phone) {
      setError('Please fill in all required fields');
      return;
    }
    setSaving(true);
    setError(null);
    const result = await createCheckin(form);
    setSaving(false);
    if (!result) { setError('Failed to create check-in'); return; }
    setForm(EMPTY_FORM);
    setView('list');
  }, [form, createCheckin]);

  // Default checkin time: 2 hours from now rounded to nearest 15min
  const defaultStartTime = () => {
    const d = new Date(Date.now() + 2 * 3600_000);
    d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
    return d.toISOString().slice(0, 16);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="bg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            key="sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl bg-neutral-950 border-t border-neutral-800 px-5 pb-10 pt-5 max-h-[90vh] overflow-y-auto"
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-neutral-700" />

            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                {view === 'new' && (
                  <button onClick={() => setView('list')} className="text-neutral-400 hover:text-white text-lg">←</button>
                )}
                <div>
                  <h2 className="font-bold text-white text-lg">
                    {view === 'list' ? '📍 Date Check-Ins' : 'New Check-In'}
                  </h2>
                  {view === 'list' && (
                    <p className="text-xs text-neutral-500">Share plans with an emergency contact</p>
                  )}
                </div>
              </div>
              <button onClick={onClose} className="text-neutral-500 hover:text-white text-xl">✕</button>
            </div>

            {/* ── List view ─────────────────────────────────────────────── */}
            {view === 'list' && (
              <div className="flex flex-col gap-4">
                {checkins.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-4xl mb-3">🛡️</p>
                    <p className="text-neutral-400 text-sm">No active check-ins</p>
                    <p className="text-neutral-600 text-xs mt-1">
                      Create one before your next date
                    </p>
                  </div>
                ) : (
                  checkins.map(c => (
                    <div key={c.id} className="rounded-xl bg-neutral-900 border border-neutral-800 p-4 flex flex-col gap-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-white text-sm">{c.date_name}</p>
                          <p className="text-xs text-neutral-400">📍 {c.date_location}</p>
                          <p className="text-xs text-neutral-500">
                            🕐 {new Date(c.date_starts_at).toLocaleString()}
                          </p>
                        </div>
                        <span className={clsx(
                          'px-2 py-0.5 rounded-full text-xs font-medium',
                          c.status === 'safe'    ? 'bg-green-900 text-green-400' :
                          c.status === 'alerted' ? 'bg-red-900 text-red-400' :
                          'bg-amber-900 text-amber-400',
                        )}>
                          {c.status}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-500">
                        Emergency contact: {(c.emergency_contact as EmergencyContact).name} · {(c.emergency_contact as EmergencyContact).phone}
                      </p>
                      {c.status === 'pending' && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => markSafe(c.id)}
                            className="flex-1 py-2 rounded-lg bg-green-800 hover:bg-green-700 text-white text-xs font-semibold"
                          >
                            ✅ I'm Safe
                          </button>
                          <button
                            onClick={() => cancelCheckin(c.id)}
                            className="px-3 py-2 rounded-lg bg-neutral-800 text-neutral-400 text-xs hover:text-white"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}

                <button
                  onClick={() => { setForm({ ...EMPTY_FORM, dateStartsAt: defaultStartTime() }); setView('new'); }}
                  className="w-full py-3.5 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-sm transition-colors"
                >
                  + Create Check-In
                </button>
              </div>
            )}

            {/* ── New check-in form ──────────────────────────────────────── */}
            {view === 'new' && (
              <div className="flex flex-col gap-4">
                {error && (
                  <div className="rounded-xl bg-red-950 border border-red-700 px-3 py-2 text-red-300 text-xs">{error}</div>
                )}

                <Field label="Who are you meeting? *" hint="First name or nickname is fine">
                  <input
                    value={form.dateName}
                    onChange={e => setField('dateName', e.target.value)}
                    placeholder="e.g. Ahmed"
                    className="input-field"
                  />
                </Field>

                <Field label="Location *" hint="Name of the venue / area">
                  <input
                    value={form.dateLocation}
                    onChange={e => setField('dateLocation', e.target.value)}
                    placeholder="e.g. Nespresso, Al Nakheel Mall, Riyadh"
                    className="input-field"
                  />
                </Field>

                <Field label="Date & time *">
                  <input
                    type="datetime-local"
                    value={form.dateStartsAt}
                    onChange={e => setField('dateStartsAt', e.target.value)}
                    className="input-field"
                  />
                </Field>

                <div className="rounded-xl bg-neutral-900 border border-neutral-800 p-4 flex flex-col gap-3">
                  <p className="text-sm font-semibold text-white">Emergency Contact *</p>
                  <p className="text-xs text-neutral-500">
                    We'll alert this person if you don't check in within 30 minutes of the prompt.
                  </p>

                  <Field label="Name">
                    <input
                      value={form.emergencyContact.name}
                      onChange={e => setContactField('name', e.target.value)}
                      placeholder="Contact name"
                      className="input-field"
                    />
                  </Field>
                  <Field label="Phone *" hint="Include country code e.g. +966">
                    <input
                      type="tel"
                      value={form.emergencyContact.phone}
                      onChange={e => setContactField('phone', e.target.value)}
                      placeholder="+966 5x xxx xxxx"
                      className="input-field"
                    />
                  </Field>
                  <Field label="Email (optional)">
                    <input
                      type="email"
                      value={form.emergencyContact.email ?? ''}
                      onChange={e => setContactField('email', e.target.value)}
                      placeholder="contact@email.com"
                      className="input-field"
                    />
                  </Field>
                </div>

                <div className="rounded-xl bg-amber-950/40 border border-amber-800/40 px-4 py-3 text-xs text-amber-300">
                  📲 You'll receive a check-in prompt 2 hours after your date starts.
                  If you don't respond within 30 minutes, your emergency contact will be alerted.
                </div>

                <button
                  onClick={submit}
                  disabled={saving}
                  className={clsx(
                    'w-full py-3.5 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-sm transition-colors',
                    saving && 'opacity-60 cursor-not-allowed',
                  )}
                >
                  {saving ? 'Creating…' : 'Create Check-In'}
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── Field wrapper ────────────────────────────────────────────────────────────

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-neutral-400">{label}</label>
      {hint && <p className="text-xs text-neutral-600">{hint}</p>}
      {children}
    </div>
  );
}
