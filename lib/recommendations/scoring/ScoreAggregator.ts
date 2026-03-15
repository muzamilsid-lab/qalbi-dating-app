import { UserProfile, UserActivityData, ScoreBreakdown, WEIGHTS } from '../types';
import { scoreCompatibility } from './CompatibilityScorer';
import { scoreActivity }      from './ActivityScorer';
import { scoreEngagement }    from './EngagementScorer';
import { scoreFreshness }     from './FreshnessScorer';
import { scoreLocation }      from './LocationScorer';

export interface AggregationInput {
  viewer: UserProfile;
  candidate: UserProfile;
  candidateActivity: UserActivityData;
  /** 0–1 percentile rank in global attractiveness sorted set */
  attractivenessRank: number;
  /** Number of mutual connections/matches */
  mutualConnectionCount: number;
  /** Hours since this candidate was last shown to the viewer (null = never) */
  lastImpressionHoursAgo: number | null;
  /** Cities the viewer has tagged as visited */
  viewerVisitedCities?: string[];
}

export function aggregateScore(input: AggregationInput): ScoreBreakdown {
  const {
    viewer,
    candidate,
    candidateActivity,
    attractivenessRank,
    mutualConnectionCount,
    lastImpressionHoursAgo,
    viewerVisitedCities = [],
  } = input;

  const compatibility = scoreCompatibility(viewer, candidate);
  const activity      = scoreActivity(candidate, candidateActivity);
  const engagement    = scoreEngagement(candidateActivity, attractivenessRank, mutualConnectionCount);
  const freshness     = scoreFreshness(candidate, lastImpressionHoursAgo);
  const location      = scoreLocation(viewer, candidate, viewerVisitedCities);

  // If hard preference gate returned 0, early-exit with zero score
  if (compatibility.preferenceMatch === 0) {
    return zeroScore();
  }

  const finalScore = Math.round(
    (compatibility.total * WEIGHTS.compatibility +
     activity.total      * WEIGHTS.activity      +
     engagement.total    * WEIGHTS.engagement     +
     freshness.total     * WEIGHTS.freshness      +
     location.total      * WEIGHTS.location) * 100
  );

  return {
    compatibility: {
      total:              compatibility.total,
      preferenceMatch:    compatibility.preferenceMatch,
      lifestyleAlignment: compatibility.lifestyleAlignment,
      interestOverlap:    compatibility.interestOverlap,
    },
    activity: {
      total:               activity.total,
      recency:             activity.recency,
      responseRate:        activity.responseRate,
      profileCompleteness: activity.profileCompleteness,
    },
    engagement: {
      total:               engagement.total,
      collaborativeFilter: engagement.collaborativeFilter,
      likeBackRate:        engagement.likeBackRate,
      mutualConnections:   engagement.mutualConnections,
    },
    freshness: {
      total:             freshness.total,
      newProfileBoost:   freshness.newProfileBoost,
      recentUpdateBoost: freshness.recentUpdateBoost,
      rotationScore:     freshness.rotationScore,
    },
    location: {
      total:                location.total,
      distanceScore:        location.distanceScore,
      cityBonus:            location.cityBonus,
      visitedLocationMatch: location.visitedLocationMatch,
    },
    finalScore,
  };
}

function zeroScore(): ScoreBreakdown {
  const sub = { total: 0, preferenceMatch: 0, lifestyleAlignment: 0, interestOverlap: 0,
    recency: 0, responseRate: 0, profileCompleteness: 0,
    collaborativeFilter: 0, likeBackRate: 0, mutualConnections: 0,
    newProfileBoost: 0, recentUpdateBoost: 0, rotationScore: 0,
    distanceScore: 0, cityBonus: 0, visitedLocationMatch: 0 };
  return {
    compatibility: { total: 0, preferenceMatch: 0, lifestyleAlignment: 0, interestOverlap: 0 },
    activity:      { total: 0, recency: 0, responseRate: 0, profileCompleteness: 0 },
    engagement:    { total: 0, collaborativeFilter: 0, likeBackRate: 0, mutualConnections: 0 },
    freshness:     { total: 0, newProfileBoost: 0, recentUpdateBoost: 0, rotationScore: 0 },
    location:      { total: 0, distanceScore: 0, cityBonus: 0, visitedLocationMatch: 0 },
    finalScore: 0,
  };
}
