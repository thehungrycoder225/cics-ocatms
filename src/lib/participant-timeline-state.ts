import type { ParticipantStopSummary } from "@/lib/participant-journey";

type TimelineStop = Pick<
  ParticipantStopSummary,
  "status" | "arrivalReviewFlags" | "checkoutReviewFlags" |
  "arrivalReviewStatus" | "checkoutReviewStatus"
>;

export function orderParticipantStops<T extends Pick<ParticipantStopSummary, "day" | "sequence">>(stops: T[]) {
  return [...stops].sort((a, b) => a.day - b.day || a.sequence - b.sequence);
}

export function participantTimelineState(stop: TimelineStop) {
  const hasException =
    stop.arrivalReviewFlags.length > 0 ||
    stop.checkoutReviewFlags.length > 0 ||
    stop.arrivalReviewStatus === "FLAGGED_FOR_REVIEW" ||
    stop.checkoutReviewStatus === "FLAGGED_FOR_REVIEW";
  const labels: Record<string, string> = {
    NOT_STARTED: "Not started",
    IN_TRANSIT: "In transit",
    ARRIVAL_SUBMITTED: "Arrival submitted",
    CHECKED_IN: "Checked in",
    CHECKOUT_SUBMITTED: "Check-out submitted",
    CHECKED_OUT: "Checked out",
    INTERRUPTED: "Interrupted",
  };
  const label = labels[stop.status] ?? stop.status.replaceAll("_", " ").toLowerCase();

  return { label, hasException };
}

export function milestoneEvidenceLabel(
  submittedAt: string | null,
  evidenceId: string | null,
) {
  if (!submittedAt) return "Not submitted";
  return evidenceId ? "Evidence attached" : "No evidence attached";
}
