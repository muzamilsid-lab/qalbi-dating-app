'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { clsx } from 'clsx';
import { Profile } from './types';

interface Props {
  profile: Profile;
  expanded: boolean;
  onToggleExpand: () => void;
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-sm text-white text-xs font-medium border border-white/20">
      {children}
    </span>
  );
}

function VerificationBadge() {
  return (
    <span
      className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-sky-500 ml-1 shrink-0"
      aria-label="Verified profile"
      title="Verified"
    >
      <svg viewBox="0 0 10 10" className="w-3 h-3" fill="none" stroke="white" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 5l2 2 4-4"/>
      </svg>
    </span>
  );
}

export function ProfileOverlay({ profile, expanded, onToggleExpand }: Props) {
  const [bioTruncated, setBioTruncated] = useState(true);

  return (
    <>
      {/* Static gradient — always visible */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.35) 45%, transparent 70%)' }}
        aria-hidden="true"
      />

      {/* Collapsed info bar */}
      <div className="absolute bottom-0 left-0 right-0 px-4 pb-5 pt-16">
        {/* Name row */}
        <div className="flex items-baseline gap-1 flex-wrap">
          <h2 className="text-white text-2xl font-bold leading-tight tracking-tight">
            {profile.name}
          </h2>
          <span className="text-white/90 text-2xl font-light">{profile.age}</span>
          {profile.verified && <VerificationBadge />}
        </div>

        {/* Tags row */}
        <div className="flex flex-wrap gap-1.5 mt-2">
          {profile.city && (
            <Tag>
              <svg viewBox="0 0 16 16" className="w-3 h-3 fill-current opacity-80" aria-hidden>
                <path d="M8 1C5.24 1 3 3.24 3 6c0 3.75 5 9 5 9s5-5.25 5-9c0-2.76-2.24-5-5-5zm0 6.75A1.75 1.75 0 1 1 8 4.25a1.75 1.75 0 0 1 0 3.5z"/>
              </svg>
              {profile.city}
            </Tag>
          )}
          {profile.nationality && <Tag>🌍 {profile.nationality}</Tag>}
          {profile.distance !== undefined && (
            <Tag>{profile.distance < 1 ? 'Nearby' : `${profile.distance} km`}</Tag>
          )}
          {profile.online && (
            <Tag>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" aria-hidden />
              Online
            </Tag>
          )}
        </div>

        {/* Bio — truncated, tap to expand */}
        {profile.bio && (
          <div className="mt-2.5">
            <p
              className={clsx(
                'text-white/85 text-sm leading-relaxed',
                bioTruncated && 'line-clamp-3'
              )}
            >
              {profile.bio}
            </p>
            {profile.bio.length > 120 && (
              <button
                onClick={(e) => { e.stopPropagation(); setBioTruncated(b => !b); }}
                className="text-white/60 text-xs mt-0.5 hover:text-white transition-colors"
              >
                {bioTruncated ? 'Read more' : 'Show less'}
              </button>
            )}
          </div>
        )}

        {/* Expand profile hint */}
        <button
          className="flex items-center gap-1 mt-3 text-white/50 text-xs hover:text-white/80 transition-colors"
          onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}
          aria-expanded={expanded}
          aria-label="Expand profile details"
        >
          <motion.svg
            viewBox="0 0 16 16"
            className="w-3.5 h-3.5 fill-none stroke-current"
            strokeWidth={2}
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            aria-hidden
          >
            <path d="M3 6l5-4 5 4" strokeLinecap="round" strokeLinejoin="round"/>
          </motion.svg>
          {expanded ? 'Less info' : 'More info'}
        </button>
      </div>

      {/* Expanded profile sheet */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            className="absolute inset-x-0 bottom-0 z-20 bg-[var(--color-surface)] rounded-t-3xl overflow-y-auto max-h-[75%]"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 400, damping: 35 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-[var(--color-border)]" />
            </div>

            <div className="px-5 pb-8 space-y-5">
              {/* Name + age header */}
              <div>
                <div className="flex items-center gap-1">
                  <h3 className="text-[var(--color-text-primary)] text-xl font-bold">
                    {profile.name}, {profile.age}
                  </h3>
                  {profile.verified && <VerificationBadge />}
                </div>
                {profile.occupation && (
                  <p className="text-[var(--color-text-secondary)] text-sm mt-0.5">
                    {profile.occupation}
                  </p>
                )}
              </div>

              {/* Full bio */}
              {profile.bio && (
                <div>
                  <h4 className="text-[var(--color-text-muted)] text-xs uppercase tracking-widest font-semibold mb-1.5">
                    About
                  </h4>
                  <p className="text-[var(--color-text-primary)] text-sm leading-relaxed">
                    {profile.bio}
                  </p>
                </div>
              )}

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-3">
                {profile.city && (
                  <StatTile icon="📍" label="City" value={profile.city} />
                )}
                {profile.nationality && (
                  <StatTile icon="🌍" label="Nationality" value={profile.nationality} />
                )}
                {profile.height && (
                  <StatTile icon="📏" label="Height" value={`${profile.height} cm`} />
                )}
                {profile.distance !== undefined && (
                  <StatTile
                    icon="🗺"
                    label="Distance"
                    value={profile.distance < 1 ? 'Nearby' : `${profile.distance} km away`}
                  />
                )}
              </div>

              {/* Interests */}
              {profile.interests && profile.interests.length > 0 && (
                <div>
                  <h4 className="text-[var(--color-text-muted)] text-xs uppercase tracking-widest font-semibold mb-2">
                    Interests
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {profile.interests.map(interest => (
                      <span
                        key={interest}
                        className="px-3 py-1 rounded-full bg-[var(--color-surface-alt)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-sm"
                      >
                        {interest}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function StatTile({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 p-3 rounded-xl bg-[var(--color-surface-alt)] border border-[var(--color-border)]">
      <span className="text-lg" aria-hidden>{icon}</span>
      <div className="min-w-0">
        <p className="text-[var(--color-text-muted)] text-[10px] uppercase tracking-wider font-medium">{label}</p>
        <p className="text-[var(--color-text-primary)] text-sm font-semibold truncate">{value}</p>
      </div>
    </div>
  );
}
