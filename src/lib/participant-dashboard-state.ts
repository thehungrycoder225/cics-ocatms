import type { ParticipantStopSummary } from "@/lib/participant-journey";

type SummaryStop = Pick<
  ParticipantStopSummary,
  "sessionId" | "status" | "checkoutAt" | "checkoutReviewStatus"
>;

export function summarizeParticipantJourney<T extends SummaryStop>(stops: T[]) {
  const activeStops = stops.filter(
    (stop) =>
      stop.sessionId !== null &&
      ["IN_TRANSIT", "ARRIVAL_SUBMITTED", "CHECKED_IN"].includes(stop.status),
  );

  return {
    visibleStops: stops.length,
    submittedCheckouts: stops.filter((stop) => stop.checkoutAt !== null).length,
    verifiedCheckouts: stops.filter(
      (stop) => stop.checkoutAt !== null && stop.checkoutReviewStatus === "VERIFIED",
    ).length,
    currentStop: activeStops.length === 1 ? activeStops[0] : null,
    hasMultipleActiveStops: activeStops.length > 1,
  };
}
