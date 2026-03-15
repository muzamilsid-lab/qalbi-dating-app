import { UserProfile, SUB_WEIGHTS } from '../types';

// ─── Preference match (0.15) ──────────────────────────────────────────────────

function scorePreferenceMatch(viewer: UserProfile, candidate: UserProfile): number {
  const prefs = viewer.preferences;

  // Gender match
  const genderOk =
    prefs.interestedIn === 'everyone' ||
    (prefs.interestedIn === 'men'   && candidate.gender === 'man')  ||
    (prefs.interestedIn === 'women' && candidate.gender === 'woman');

  if (!genderOk) return 0;

  // Age match (hard gate then partial penalty)
  if (candidate.age < prefs.ageMin || candidate.age > prefs.ageMax) return 0;

  // Candidate's interest in viewer gender
  const candPrefs = candidate.preferences;
  const viewerGenderOk =
    candPrefs.interestedIn === 'everyone' ||
    (candPrefs.interestedIn === 'men'   && viewer.gender === 'man')  ||
    (candPrefs.interestedIn === 'women' && viewer.gender === 'woman');

  if (!viewerGenderOk) return 0;

  // Viewer age in candidate's range
  const viewerAgeOk =
    viewer.age >= candPrefs.ageMin && viewer.age <= candPrefs.ageMax;

  if (!viewerAgeOk) return 0;

  // Distance gate (scored separately in LocationScorer but hard-gate here)
  const distKm = haversineKm(viewer.lat, viewer.lng, candidate.lat, candidate.lng);
  if (distKm > prefs.maxDistanceKm) return 0;

  return 1.0;
}

// ─── Lifestyle alignment (0.10) ───────────────────────────────────────────────

type LifestyleKey = 'smoking' | 'drinking' | 'wantsChildren';

function scoreLifestyleAlignment(viewer: UserProfile, candidate: UserProfile): number {
  const attrs: LifestyleKey[] = ['smoking', 'drinking', 'wantsChildren'];
  let matched = 0;
  let compared = 0;

  for (const key of attrs) {
    const viewerPref = viewer.preferences[key];
    const candValue  = candidate.lifestyle[key];

    if (!viewerPref || !candValue) continue; // missing = no opinion
    compared++;

    if (viewerPref === candValue) {
      matched++;
    } else {
      // Partial credit for 'sometimes'
      const both = [viewerPref, candValue];
      if (both.includes('sometimes') && (both.includes('yes') || both.includes('no'))) {
        matched += 0.5;
      }
    }
  }

  if (compared === 0) return 0.5; // neutral if no lifestyle data
  return matched / compared;
}

// ─── Interest overlap — Jaccard (0.10) ────────────────────────────────────────

function scoreInterestOverlap(viewer: UserProfile, candidate: UserProfile): number {
  const a = new Set(viewer.interests.map(s => s.toLowerCase()));
  const b = new Set(candidate.interests.map(s => s.toLowerCase()));

  if (a.size === 0 && b.size === 0) return 0.5;

  let intersection = 0;
  a.forEach(item => { if (b.has(item)) intersection++; });

  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

// ─── Haversine distance ───────────────────────────────────────────────────────

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

// ─── Aggregated compatibility score ──────────────────────────────────────────

export interface CompatibilityResult {
  total: number;
  preferenceMatch: number;
  lifestyleAlignment: number;
  interestOverlap: number;
}

export function scoreCompatibility(
  viewer: UserProfile,
  candidate: UserProfile,
): CompatibilityResult {
  const w = SUB_WEIGHTS.compatibility;

  const preferenceMatch    = scorePreferenceMatch(viewer, candidate);
  const lifestyleAlignment = scoreLifestyleAlignment(viewer, candidate);
  const interestOverlap    = scoreInterestOverlap(viewer, candidate);

  const total =
    preferenceMatch    * (w.preferenceMatch    / 0.35) +
    lifestyleAlignment * (w.lifestyleAlignment / 0.35) +
    interestOverlap    * (w.interestOverlap    / 0.35);

  return {
    total: clamp(total),
    preferenceMatch:    clamp(preferenceMatch),
    lifestyleAlignment: clamp(lifestyleAlignment),
    interestOverlap:    clamp(interestOverlap),
  };
}

function clamp(n: number): number {
  return Math.max(0, Math.min(1, n));
}
