import assert from "node:assert/strict";
import test from "node:test";
import {
  milestoneEvidenceLabel,
  orderParticipantStops,
  participantTimelineState,
} from "../src/lib/participant-timeline-state.ts";

const stop = {
  status: "NOT_STARTED",
  arrivalReviewStatus: null,
  checkoutReviewStatus: null,
  arrivalReviewFlags: [],
  checkoutReviewFlags: [],
};

test("timeline sorts by itinerary day and sequence without mutating input", () => {
  const stops = [
    { id: "c", day: 2, sequence: 1 },
    { id: "b", day: 1, sequence: 2 },
    { id: "a", day: 1, sequence: 1 },
  ];
  assert.deepEqual(orderParticipantStops(stops).map((item) => item.id), ["a", "b", "c"]);
  assert.deepEqual(stops.map((item) => item.id), ["c", "b", "a"]);
});

test("timeline separates submitted and verified session states", () => {
  assert.equal(participantTimelineState({ ...stop, status: "ARRIVAL_SUBMITTED" }).label, "Arrival submitted");
  assert.equal(participantTimelineState({ ...stop, status: "CHECKED_IN" }).label, "Checked in");
  assert.equal(participantTimelineState({ ...stop, status: "CHECKOUT_SUBMITTED" }).label, "Check-out submitted");
  assert.equal(participantTimelineState({ ...stop, status: "CHECKED_OUT" }).label, "Checked out");
});

test("flags and review decisions surface exceptions without inventing them", () => {
  assert.equal(participantTimelineState(stop).hasException, false);
  assert.equal(participantTimelineState({ ...stop, arrivalReviewFlags: ["LOW_ACCURACY"] }).hasException, true);
  assert.equal(participantTimelineState({ ...stop, checkoutReviewStatus: "FLAGGED_FOR_REVIEW" }).hasException, true);
});

test("evidence state distinguishes an unsubmitted milestone from missing evidence", () => {
  assert.equal(milestoneEvidenceLabel(null, null), "Not submitted");
  assert.equal(milestoneEvidenceLabel("2026-11-08T10:00:00Z", null), "No evidence attached");
  assert.equal(milestoneEvidenceLabel("2026-11-08T10:00:00Z", "evidence-1"), "Evidence attached");
});
