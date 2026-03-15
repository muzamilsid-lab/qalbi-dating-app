import { UserProfile, SUB_WEIGHTS } from '../types';

const MS_PER_DAY = 86_400_000;

// ─── New profile boost — linear decay over 7 days (0.04) ─────────────────────

function scoreNewProfileBoost(createdAt: Date): number {
  const daysOld = (Date.now() - createdAt.getTime()) / MS_PER_DAY;
  if (daysOld > 7) return 0;
  return 1 - daysOld / 7;
}

// ─── Recent update boost — bio/photo updated in last 3 days (0.03) ───────────

function scoreRecentUpdateBoost(updatedAt: Date): number {
  const daysAgo = (Date.now() - updatedAt.getTime()) / MS_PER_DAY;
  if (daysAgo > 3) return 0;
  return 1 - daysAgo / 3;
}

// ─── Rotation score — penalise profiles shown too recently (0.03) ────────────
//     lastImpressionHoursAgo: hours since this candidate was last shown to viewer

export function scoreRotation(lastImpressionHoursAgo: number | null): number {
  if (lastImpressionHoursAgo === null) return 1.0; // never shown → full boost
  const cooldownHours = 24;
  if (lastImpressionHoursAgo >= cooldownHours) return 1.0;
  return lastImpressionHoursAgo / cooldownHours;
}

// ─── Aggregated freshness score ───────────────────────────────────────────────

export interface FreshnessResult {
  total: number;
  newProfileBoost: number;
  recentUpdateBoost: number;
  rotationScore: number;
}

export function scoreFreshness(
  profile: UserProfile,
  lastImpressionHoursAgo: number | null,
): FreshnessResult {
  const w = SUB_WEIGHTS.freshness;

  const newProfileBoost   = scoreNewProfileBoost(profile.createdAt);
  const recentUpdateBoost = scoreRecentUpdateBoost(profile.updatedAt);
  const rotationScore     = scoreRotation(lastImpressionHoursAgo);

  const total =
    newProfileBoost   * (w.newProfileBoost   / 0.10) +
    recentUpdateBoost * (w.recentUpdateBoost / 0.10) +
    rotationScore     * (w.rotationScore     / 0.10);

  return {
    total:            clamp(total),
    newProfileBoost:  clamp(newProfileBoost),
    recentUpdateBoost: clamp(recentUpdateBoost),
    rotationScore:    clamp(rotationScore),
  };
}

function clamp(n: number): number {
  return Math.max(0, Math.min(1, n));
}
