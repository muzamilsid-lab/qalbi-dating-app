import { UserProfile, UserActivityData, SUB_WEIGHTS } from '../types';

// ─── Recency decay — exponential half-life 3 days (0.10) ─────────────────────

function scoreRecency(lastActiveAt: Date): number {
  const hoursAgo = (Date.now() - lastActiveAt.getTime()) / (1000 * 3600);
  const halfLifeHours = 72; // 3 days
  return Math.exp(-Math.LN2 * hoursAgo / halfLifeHours);
}

// ─── Response rate (0.08) ─────────────────────────────────────────────────────

function scoreResponseRate(activity: UserActivityData): number {
  const { messagesReceived, messagesReplied } = activity;
  if (messagesReceived === 0) return 0.5; // neutral — no messages yet
  return Math.min(1, messagesReplied / messagesReceived);
}

// ─── Profile completeness (0.07) ─────────────────────────────────────────────

function scoreProfileCompleteness(profile: UserProfile): number {
  let score = 0;
  const checks: [boolean, number][] = [
    [profile.photoCount >= 1, 0.20],
    [profile.photoCount >= 3, 0.15],
    [!!profile.bio && profile.bio.length >= 20, 0.15],
    [profile.promptCount >= 1, 0.10],
    [profile.interests.length >= 3, 0.10],
    [!!profile.occupation, 0.10],
    [!!profile.lifestyle.smoking, 0.05],
    [!!profile.lifestyle.drinking, 0.05],
    [!!profile.lifestyle.religion, 0.05],
    [!!profile.lifestyle.wantsChildren, 0.05],
  ];
  for (const [cond, weight] of checks) {
    if (cond) score += weight;
  }
  return score;
}

// ─── Aggregated activity score ────────────────────────────────────────────────

export interface ActivityResult {
  total: number;
  recency: number;
  responseRate: number;
  profileCompleteness: number;
}

export function scoreActivity(
  profile: UserProfile,
  activity: UserActivityData,
): ActivityResult {
  const w = SUB_WEIGHTS.activity;

  const recency            = scoreRecency(profile.lastActiveAt);
  const responseRate       = scoreResponseRate(activity);
  const profileCompleteness = scoreProfileCompleteness(profile);

  const total =
    recency             * (w.recency             / 0.25) +
    responseRate        * (w.responseRate        / 0.25) +
    profileCompleteness * (w.profileCompleteness / 0.25);

  return {
    total:             clamp(total),
    recency:           clamp(recency),
    responseRate:      clamp(responseRate),
    profileCompleteness: clamp(profileCompleteness),
  };
}

function clamp(n: number): number {
  return Math.max(0, Math.min(1, n));
}
