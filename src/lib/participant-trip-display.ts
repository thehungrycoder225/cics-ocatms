import type { ParticipantStopSummary } from "@/lib/participant-journey";

type RecordedLocation = Pick<
  ParticipantStopSummary,
  "lastAccuracyM" | "lastGpsAcquiredAt" | "lastLocationReceivedAt"
>;

export function formatRecordedLocation(stop: RecordedLocation): string {
  const parts = [
    stop.lastGpsAcquiredAt
      ? `GPS acquired ${new Date(stop.lastGpsAcquiredAt).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}`
      : "GPS acquisition time unavailable",
    stop.lastAccuracyM !== null ? `Accuracy ±${Math.round(stop.lastAccuracyM)} m` : "Accuracy unavailable",
    stop.lastLocationReceivedAt
      ? `Server received ${new Date(stop.lastLocationReceivedAt).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}`
      : "Server receipt time unavailable",
  ];

  if (!stop.lastGpsAcquiredAt && stop.lastAccuracyM === null && !stop.lastLocationReceivedAt) {
    return "Not reported. This is not a live location.";
  }
  return `${parts.join(" · ")}. This is not a live location.`;
}
