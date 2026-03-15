'use client';

import { useMemo } from 'react';
import { PromptDraft, ProfileStrength, StrengthFactor } from '../types';

interface ProfileSnapshot {
  photoCount:  number;
  hasBio:      boolean;
  hasOccupation: boolean;
  hasLifestyle:  boolean;
  drafts:      PromptDraft[];
}

const FACTORS: Array<{
  key: string;
  label: string;
  points: number;
  check: (s: ProfileSnapshot) => boolean;
  suggestion?: string;
}> = [
  {
    key: 'photo_1',
    label: 'Added a photo',
    points: 10,
    check: s => s.photoCount >= 1,
  },
  {
    key: 'photo_3',
    label: 'At least 3 photos',
    points: 15,
    check: s => s.photoCount >= 3,
    suggestion: 'Add more photos — profiles with 3+ photos get 2× more likes',
  },
  {
    key: 'bio',
    label: 'Wrote a bio',
    points: 15,
    check: s => s.hasBio,
    suggestion: 'Write a short bio to let people know who you are',
  },
  {
    key: 'occupation',
    label: 'Added occupation',
    points: 10,
    check: s => s.hasOccupation,
    suggestion: 'Share what you do — it sparks great conversations',
  },
  {
    key: 'lifestyle',
    label: 'Filled lifestyle info',
    points: 10,
    check: s => s.hasLifestyle,
    suggestion: 'Add lifestyle details to find better matches',
  },
  {
    key: 'prompt_1',
    label: 'Answered first prompt',
    points: 15,
    check: s => s.drafts.some(d => d.promptId !== null && d.answer.trim().length > 0),
    suggestion: 'Answer a prompt — it\'s the #1 way to start conversations',
  },
  {
    key: 'prompt_2',
    label: 'Answered second prompt',
    points: 12,
    check: s => s.drafts.filter(d => d.promptId !== null && d.answer.trim().length > 0).length >= 2,
    suggestion: 'Add a second prompt answer to show more of your personality',
  },
  {
    key: 'prompt_3',
    label: 'Answered all 3 prompts',
    points: 13,
    check: s => s.drafts.filter(d => d.promptId !== null && d.answer.trim().length > 0).length >= 3,
    suggestion: 'Complete all 3 prompts for a fully expressive profile',
  },
];

function levelOf(score: number): ProfileStrength['level'] {
  if (score >= 90) return 'complete';
  if (score >= 65) return 'strong';
  if (score >= 35) return 'growing';
  return 'starter';
}

export function useProfileStrength(snapshot: ProfileSnapshot): ProfileStrength {
  return useMemo(() => {
    const factors: StrengthFactor[] = FACTORS.map(f => ({
      key:    f.key,
      label:  f.label,
      done:   f.check(snapshot),
      points: f.points,
    }));

    const score = factors.reduce((acc, f) => acc + (f.done ? f.points : 0), 0);
    const level = levelOf(score);

    // First incomplete factor with a suggestion
    const nextSuggestion =
      FACTORS.find(f => !f.check(snapshot) && f.suggestion)?.suggestion ?? null;

    return { score, level, factors, nextSuggestion };
  }, [
    snapshot.photoCount,
    snapshot.hasBio,
    snapshot.hasOccupation,
    snapshot.hasLifestyle,
    JSON.stringify(snapshot.drafts),
  ]);
}
