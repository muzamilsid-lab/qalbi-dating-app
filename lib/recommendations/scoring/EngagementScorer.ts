import { UserActivityData, SUB_WEIGHTS } from '../types';

// ─── Collaborative filter — how often similar users liked this candidate (0.08)
//     Passed in as a pre-computed value (0–1) from Redis attractiveness rank

function scoreCollaborativeFilter(attractivenessRank: number): number {
  // attractivenessRank: percentile 0–1 from global sorted set
  return attractivenessRank;
}

// ─── Like-back rate — of people this candidate likes, how many like back (0.07)

function scoreLikeBackRate(activity: UserActivityData): number {
  const { totalLikesSent, likesReceivedBack } = activity;
  if (totalLikesSent === 0) return 0.5;
  return Math.min(1, likesReceivedBack / totalLikesSent);
}

// ─── Mutual connections — passed in as pre-computed count (0.05) ─────────────

function scoreMutualConnections(mutualCount: number): number {
  // Saturates at 5 mutual connections
  return Math.min(1, mutualCount / 5);
}

// ─── Aggregated engagement score ─────────────────────────────────────────────

export interface EngagementResult {
  total: number;
  collaborativeFilter: number;
  likeBackRate: number;
  mutualConnections: number;
}

export function scoreEngagement(
  activity: UserActivityData,
  attractivenessRank: number,   // 0–1 percentile from Redis
  mutualConnectionCount: number,
): EngagementResult {
  const w = SUB_WEIGHTS.engagement;

  const collaborativeFilter = scoreCollaborativeFilter(attractivenessRank);
  const likeBackRate        = scoreLikeBackRate(activity);
  const mutualConnections   = scoreMutualConnections(mutualConnectionCount);

  const total =
    collaborativeFilter * (w.collaborativeFilter / 0.20) +
    likeBackRate        * (w.likeBackRate        / 0.20) +
    mutualConnections   * (w.mutualConnections   / 0.20);

  return {
    total:               clamp(total),
    collaborativeFilter: clamp(collaborativeFilter),
    likeBackRate:        clamp(likeBackRate),
    mutualConnections:   clamp(mutualConnections),
  };
}

function clamp(n: number): number {
  return Math.max(0, Math.min(1, n));
}
