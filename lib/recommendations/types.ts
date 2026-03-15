// ─── User data shapes ─────────────────────────────────────────────────────────

export interface UserPreferences {
  interestedIn: 'men' | 'women' | 'everyone';
  ageMin: number;
  ageMax: number;
  maxDistanceKm: number;
  smoking?: 'yes' | 'no' | 'sometimes' | null;
  drinking?: 'yes' | 'no' | 'sometimes' | null;
  religion?: string | null;
  wantsChildren?: 'yes' | 'no' | 'open' | null;
}

export interface UserProfile {
  id: string;
  gender: 'man' | 'woman' | 'other';
  age: number;
  city: string;
  lat: number;
  lng: number;
  interests: string[];
  occupation?: string;
  bio?: string;
  photoCount: number;
  promptCount: number;
  preferences: UserPreferences;
  lifestyle: {
    smoking?: string;
    drinking?: string;
    religion?: string;
    wantsChildren?: string;
  };
  createdAt: Date;
  updatedAt: Date;
  lastActiveAt: Date;
  isVerified: boolean;
}

// ─── Score breakdown ──────────────────────────────────────────────────────────

export interface ScoreBreakdown {
  /** Weighted 0.35 */
  compatibility: {
    total: number;
    preferenceMatch: number;     // 0.15
    lifestyleAlignment: number;  // 0.10
    interestOverlap: number;     // 0.10
  };
  /** Weighted 0.25 */
  activity: {
    total: number;
    recency: number;
    responseRate: number;
    profileCompleteness: number;
  };
  /** Weighted 0.20 */
  engagement: {
    total: number;
    collaborativeFilter: number;
    likeBackRate: number;
    mutualConnections: number;
  };
  /** Weighted 0.10 */
  freshness: {
    total: number;
    newProfileBoost: number;
    recentUpdateBoost: number;
    rotationScore: number;
  };
  /** Weighted 0.10 */
  location: {
    total: number;
    distanceScore: number;
    cityBonus: number;
    visitedLocationMatch: number;
  };
  /** Final weighted composite 0–100 */
  finalScore: number;
}

export interface ScoredCandidate {
  candidateId: string;
  viewerId: string;
  score: ScoreBreakdown;
  computedAt: Date;
}

// ─── Activity data ────────────────────────────────────────────────────────────

export interface UserActivityData {
  userId: string;
  lastActiveAt: Date;
  messagesReceived: number;
  messagesReplied: number;
  totalLikesReceived: number;
  totalLikesSent: number;
  likesReceivedBack: number;   // of likes sent, how many liked back
  profileViewCount: number;
}

// ─── Redis keys ───────────────────────────────────────────────────────────────

export const RedisKeys = {
  /** Sorted set: score → candidateId for a viewer */
  discoverFeed:       (userId: string) => `discover:feed:${userId}`,
  /** Set of candidateIds already swiped by viewer */
  swipedSet:          (userId: string) => `discover:swiped:${userId}`,
  /** Hash: candidateId → ISO timestamp of last impression */
  impressions:        (userId: string) => `discover:impressions:${userId}`,
  /** String: impression count for fairness */
  impressionCount:    (userId: string) => `fairness:impressions:${userId}`,
  /** Sorted set: score → userId, global attractiveness ranking */
  attractiveness:     () => `fairness:attractiveness`,
  /** Hash: userId → response rate float */
  responseRate:       (userId: string) => `activity:response_rate:${userId}`,
  /** Hash: userId → like-back rate float */
  likeBackRate:       (userId: string) => `activity:like_back_rate:${userId}`,
  /** Sorted set: timestamp → userId, recently active users */
  recentlyActive:     () => `activity:recently_active`,
  /** Key: last daily compute run */
  lastComputeRun:     () => `jobs:last_compute_run`,
  /** Set: userIds currently being computed */
  computingSet:       () => `jobs:computing`,
} as const;

// ─── Discover API ─────────────────────────────────────────────────────────────

export interface DiscoverCursor {
  lastScore: number;
  lastId: string;
  offset: number;
}

export interface DiscoverProfile {
  id: string;
  name: string;
  age: number;
  city?: string;
  nationality?: string;
  bio?: string;
  photos: string[];
  interests: string[];
  verified: boolean;
  online: boolean;
  distance?: number;
  /** Debug: score breakdown (dev only) */
  _score?: number;
}

export interface DiscoverResponse {
  profiles: DiscoverProfile[];
  nextCursor: string | null;
  hasMore: boolean;
  total: number;
  fromCache: boolean;
}

// ─── Scoring weights (must sum to 1.0) ───────────────────────────────────────

export const WEIGHTS = {
  compatibility: 0.35,
  activity:      0.25,
  engagement:    0.20,
  freshness:     0.10,
  location:      0.10,
} as const;

export const SUB_WEIGHTS = {
  compatibility: { preferenceMatch: 0.15, lifestyleAlignment: 0.10, interestOverlap: 0.10 },
  activity:      { recency: 0.10, responseRate: 0.08, profileCompleteness: 0.07 },
  engagement:    { collaborativeFilter: 0.08, likeBackRate: 0.07, mutualConnections: 0.05 },
  freshness:     { newProfileBoost: 0.04, recentUpdateBoost: 0.03, rotationScore: 0.03 },
  location:      { distanceScore: 0.06, cityBonus: 0.02, visitedLocationMatch: 0.02 },
} as const;
