'use client';

import { useState }   from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx           from 'clsx';
import {
  SAFETY_TIPS,
  RED_FLAGS,
  GCC_EMERGENCY_NUMBERS,
} from '@/lib/safety/types';

// ─── Tab type ─────────────────────────────────────────────────────────────────

type Tab = 'tips' | 'redflags' | 'emergency' | 'report';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'tips',      label: 'Safety Tips',       icon: '🛡️'  },
  { id: 'redflags',  label: 'Red Flags',          icon: '🚩'  },
  { id: 'emergency', label: 'Emergency Numbers',  icon: '🆘'  },
  { id: 'report',    label: 'Report to Authorities', icon: '👮' },
];

// ─── Safety Center ────────────────────────────────────────────────────────────

export function SafetyCenter() {
  const [tab, setTab] = useState<Tab>('tips');

  return (
    <div className="flex flex-col gap-5 max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="text-center">
        <p className="text-4xl mb-2">🛡️</p>
        <h1 className="text-2xl font-bold text-white">Safety Center</h1>
        <p className="text-neutral-400 text-sm mt-1">
          Your safety is our top priority. Stay informed, stay safe.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 rounded-2xl bg-neutral-900 p-1 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={clsx(
              'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-colors',
              tab === t.id ? 'bg-purple-600 text-white' : 'text-neutral-400 hover:text-white',
            )}
          >
            <span>{t.icon}</span>
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.15 }}
          className="flex flex-col gap-3"
        >
          {/* ── Safety tips ───────────────────────────────────────────── */}
          {tab === 'tips' && SAFETY_TIPS.map((tip, i) => (
            <div key={i} className="rounded-2xl bg-neutral-900 border border-neutral-800 p-4 flex gap-4">
              <span className="text-2xl shrink-0 mt-0.5">{tip.icon}</span>
              <div>
                <p className="font-semibold text-white text-sm">{tip.title}</p>
                <p className="text-neutral-400 text-xs mt-1 leading-relaxed">{tip.content}</p>
              </div>
            </div>
          ))}

          {/* ── Red flags ─────────────────────────────────────────────── */}
          {tab === 'redflags' && (
            <>
              <div className="rounded-xl bg-red-950/40 border border-red-800/40 px-4 py-3 text-xs text-red-300">
                🚩 If something feels wrong, trust your instincts. You can block and report anyone instantly inside the app.
              </div>
              {RED_FLAGS.map((flag, i) => (
                <div key={i} className="rounded-2xl bg-neutral-900 border border-red-900/30 p-4 flex gap-3">
                  <span className="text-red-500 text-lg shrink-0 mt-0.5">⚠️</span>
                  <div>
                    <p className="font-semibold text-white text-sm">{flag.title}</p>
                    <p className="text-neutral-400 text-xs mt-1 leading-relaxed">{flag.description}</p>
                  </div>
                </div>
              ))}
            </>
          )}

          {/* ── Emergency numbers ─────────────────────────────────────── */}
          {tab === 'emergency' && (
            <>
              <p className="text-xs text-neutral-500 text-center">
                In immediate danger, call your local emergency number now.
              </p>
              {GCC_EMERGENCY_NUMBERS.map((nums, i) => (
                <div key={i} className="rounded-2xl bg-neutral-900 border border-neutral-800 p-4">
                  <p className="font-semibold text-white text-sm mb-3">{nums.country}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <NumberButton label="Police"    number={nums.police}    />
                    {nums.ambulance && <NumberButton label="Ambulance"  number={nums.ambulance} />}
                    {nums.domestic_violence && <NumberButton label="Domestic Violence" number={nums.domestic_violence} color="purple" />}
                    {nums.cyber_crime       && <NumberButton label="Cyber Crime"       number={nums.cyber_crime}       color="blue"   />}
                  </div>
                </div>
              ))}
            </>
          )}

          {/* ── Report to authorities ─────────────────────────────────── */}
          {tab === 'report' && (
            <div className="flex flex-col gap-4">
              <div className="rounded-xl bg-neutral-900 border border-neutral-800 p-5 flex flex-col gap-3">
                <p className="font-bold text-white">Report to Authorities</p>
                <p className="text-neutral-400 text-sm leading-relaxed">
                  If you believe you have been a victim of a crime, scam, or online abuse,
                  you can report it to local authorities in addition to reporting within Qalbi.
                </p>
              </div>

              {[
                {
                  country: '🇸🇦 Saudi Arabia',
                  agencies: [
                    { name: 'Cyber Crime (CITC)', url: 'https://citc.gov.sa', phone: '1441' },
                    { name: 'Social Protection', phone: '1919' },
                  ],
                },
                {
                  country: '🇦🇪 UAE',
                  agencies: [
                    { name: 'eCrime Portal', url: 'https://ecrime.ae' },
                    { name: 'Family Protection', phone: '800-SAFE (7233)' },
                  ],
                },
                {
                  country: '🇶🇦 Qatar',
                  agencies: [
                    { name: 'Cyber Crime Unit (MOI)', url: 'https://portal.moi.gov.qa' },
                    { name: 'Family Affairs', phone: '919' },
                  ],
                },
              ].map(country => (
                <div key={country.country} className="rounded-2xl bg-neutral-900 border border-neutral-800 p-4 flex flex-col gap-3">
                  <p className="font-semibold text-white text-sm">{country.country}</p>
                  {country.agencies.map(agency => (
                    <div key={agency.name} className="flex items-center justify-between">
                      <p className="text-sm text-neutral-300">{agency.name}</p>
                      <div className="flex gap-2">
                        {agency.url && (
                          <a
                            href={agency.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-1 rounded-lg bg-neutral-800 text-xs text-purple-400 hover:text-purple-300"
                          >
                            Website ↗
                          </a>
                        )}
                        {agency.phone && (
                          <a
                            href={`tel:${agency.phone}`}
                            className="px-2 py-1 rounded-lg bg-neutral-800 text-xs text-green-400 hover:text-green-300"
                          >
                            {agency.phone}
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ─── Number button ────────────────────────────────────────────────────────────

function NumberButton({
  label, number, color = 'red',
}: { label: string; number: string; color?: 'red' | 'purple' | 'blue' }) {
  const colors = {
    red:    'bg-red-900/50 text-red-300 border-red-800/40',
    purple: 'bg-purple-900/50 text-purple-300 border-purple-800/40',
    blue:   'bg-blue-900/50 text-blue-300 border-blue-800/40',
  };

  return (
    <a
      href={`tel:${number}`}
      className={clsx(
        'flex flex-col items-center justify-center py-2.5 rounded-xl border text-center',
        colors[color],
      )}
    >
      <span className="font-bold text-lg leading-none">{number}</span>
      <span className="text-xs opacity-70 mt-0.5">{label}</span>
    </a>
  );
}
