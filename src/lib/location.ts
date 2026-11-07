import { z } from "zod";

export const locationFixSchema = z.object({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  accuracyM: z.number().finite().positive().max(10_000),
  gpsAcquiredAt: z.string().datetime({ offset: true }),
});

export type LocationFix = z.infer<typeof locationFixSchema>;

const futureToleranceMs = 30_000;

export class LocationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LocationValidationError";
  }
}

export function getGpsAgeMs(gpsAcquiredAt: string, receivedAtMs: number): number {
  return receivedAtMs - new Date(gpsAcquiredAt).getTime();
}

export function validateFreshLocation(fix: LocationFix, receivedAtMs: number): void {
  const ageMs = getGpsAgeMs(fix.gpsAcquiredAt, receivedAtMs);
  if (ageMs < -futureToleranceMs) {
    throw new LocationValidationError("GPS acquisition time cannot be in the future.");
  }
  if (ageMs > 120_000) {
    throw new LocationValidationError("GPS fix is stale. Please request a fresh location and try again.");
  }
}

export function getReviewFlags(
  accuracyM: number,
  geofenceStatus: "INSIDE" | "OUTSIDE" | "UNCERTAIN",
  evidencePresent: boolean,
  receivedAtMs: number,
  gpsAcquiredAt: string,
): string[] {
  const flags: string[] = [];
  const maxAccuracy = Number(process.env.GPS_MAX_ACCURACY_M ?? "100");
  if (!Number.isFinite(maxAccuracy) || maxAccuracy <= 0) {
    throw new Error("GPS_MAX_ACCURACY_M must be a positive number.");
  }

  if (accuracyM > maxAccuracy) flags.push("LOW_ACCURACY");
  if (geofenceStatus === "OUTSIDE") flags.push("OUTSIDE_GEOFENCE");
  if (geofenceStatus === "UNCERTAIN") flags.push("GEOFENCE_UNCERTAIN");
  if (!evidencePresent) flags.push("MISSING_EVIDENCE");
  if (getGpsAgeMs(gpsAcquiredAt, receivedAtMs) > 30_000) flags.push("DELAYED_FIX");
  return flags;
}

export function classifyGeofence(
  distanceM: number,
  accuracyM: number,
  radiusM: number,
): "INSIDE" | "OUTSIDE" | "UNCERTAIN" {
  if (distanceM + accuracyM <= radiusM) return "INSIDE";
  if (distanceM - accuracyM > radiusM) return "OUTSIDE";
  return "UNCERTAIN";
}
