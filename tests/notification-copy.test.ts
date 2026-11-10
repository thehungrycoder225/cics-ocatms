import assert from "node:assert/strict";
import test from "node:test";
import { formatMilestoneNotification } from "../src/lib/notification-copy.ts";

test("arrival notifications identify the submitted event without implying verification", () => {
  const notification = formatMilestoneNotification({
    kind: "ARRIVAL",
    participantName: "Participant A",
    activityTitle: "Approved activity",
    destination: "Approved destination",
    receivedAt: "2026-11-10T01:00:00.000Z",
    validationStatus: "PENDING",
  });

  assert.match(notification.title, /submitted arrival check-in/);
  assert.match(notification.message, /Approved activity · Approved destination/);
  assert.equal(notification.status, "Pending review");
  assert.doesNotMatch(notification.title, /verified|arrived at/i);
});

test("checkout notifications preserve the checkout milestone and flagged state", () => {
  const notification = formatMilestoneNotification({
    kind: "CHECKOUT",
    participantName: "Participant B",
    activityTitle: "Approved activity",
    destination: "Approved destination",
    receivedAt: "2026-11-10T02:00:00.000Z",
    validationStatus: "FLAGGED_FOR_REVIEW",
  });

  assert.match(notification.title, /submitted check-out/);
  assert.equal(notification.status, "Flagged for review");
  assert.match(notification.receivedAt, /2026/);
});
