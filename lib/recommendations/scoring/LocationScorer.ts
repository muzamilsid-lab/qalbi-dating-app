import { UserProfile, SUB_WEIGHTS } from '../types';
import { haversineKm } from './CompatibilityScorer';

// ─── Distance score (0.06) ────────────────────────────────────────────────────
//     Soft decay — score 1.0 at 0 km, 0.5 at half maxDist, ~0 at maxDist

function scoreDistance(
  viewer: UserProfile,
  candidate: UserProfile,
): number {
  const distKm  = haversineKm(viewer.lat, viewer.lng, candidate.lat, candidate.lng);
  const maxDist = viewer.preferences.maxDistanceKm;

  if (distKm <= 0) return 1;
  if (distKm >= maxDist) return 0;

  // Smooth exponential decay
  return Math.exp(-3 * (distKm / maxDist));
}

// ─── City bonus (0.02) ────────────────────────────────────────────────────────

function scoreCityBonus(viewer: UserProfile, candidate: UserProfile): number {
  return viewer.city.toLowerCase() === candidate.city.toLowerCase() ? 1 : 0;
}

// ─── Visited location match (0.02) ───────────────────────────────────────────
//     visitedCities: list of city strings viewer has tagged themselves as visiting

function scoreVisitedLocationMatch(
  candidate: UserProfile,
  viewerVisitedCities: string[],
): number {
  if (viewerVisitedCities.length === 0) return 0;
  const normalised = viewerVisitedCities.map(c => c.toLowerCase());
  return normalised.includes(candidate.city.toLowerCase()) ? 1 : 0;
}

// ─── Aggregated location score ────────────────────────────────────────────────

export interface LocationResult {
  total: number;
  distanceScore: number;
  cityBonus: number;
  visitedLocationMatch: number;
}

export function scoreLocation(
  viewer: UserProfile,
  candidate: UserProfile,
  viewerVisitedCities: string[] = [],
): LocationResult {
  const w = SUB_WEIGHTS.location;

  const distanceScore        = scoreDistance(viewer, candidate);
  const cityBonus            = scoreCityBonus(viewer, candidate);
  const visitedLocationMatch = scoreVisitedLocationMatch(candidate, viewerVisitedCities);

  const total =
    distanceScore        * (w.distanceScore        / 0.10) +
    cityBonus            * (w.cityBonus            / 0.10) +
    visitedLocationMatch * (w.visitedLocationMatch / 0.10);

  return {
    total:               clamp(total),
    distanceScore:       clamp(distanceScore),
    cityBonus:           clamp(cityBonus),
    visitedLocationMatch: clamp(visitedLocationMatch),
  };
}

function clamp(n: number): number {
  return Math.max(0, Math.min(1, n));
}
