import assert from "node:assert/strict";
import test from "node:test";
import { getMilestoneState } from "../src/lib/monitoring-state.ts";
import {
  buildMonitoringBreakdowns,
  buildMonitoringMetrics,
  filterMonitoringRecords,
  isMonitoringException,
} from "../src/lib/monitoring-state.ts";
import type { MonitoringActivity, MonitoringRecord } from "../src/lib/monitoring.ts";

function monitoringRecord(overrides: Partial<MonitoringRecord> = {}): MonitoringRecord {
  return {
    activityId: "activity-1",
    activityTitle: "Example",
    activityStatus: "ONGOING",
    participantId: "participant-1",
    participantName: "Participant",
    collegeName: "College",
    stopId: "stop-1",
    destination: "Approved destination",
    departureLocation: null,
    travelMode: "DRIVE",
    day: 1,
    sequence: 1,
    plannedArrival: null,
    sessionId: null,
    tripStatus: "NOT_STARTED",
    etaAt: null,
    lastLatitude: null,
    lastLongitude: null,
    lastAccuracyM: null,
    gpsAcquiredAt: null,
    lastReportedAt: null,
    lastReportSource: null,
    fixAgeSeconds: null,
    arrivalAt: null,
    arrivalCheckInId: null,
    arrivalStatus: null,
    arrivalGeofenceStatus: null,
    arrivalLatitude: null,
    arrivalLongitude: null,
    arrivalAccuracyM: null,
    arrivalFlags: [],
    arrivalEvidenceId: null,
    arrivalReviewNote: null,
    checkoutAt: null,
    checkoutCheckInId: null,
    checkoutStatus: null,
    checkoutGeofenceStatus: null,
    checkoutLatitude: null,
    checkoutLongitude: null,
    checkoutAccuracyM: null,
    checkoutFlags: [],
    checkoutEvidenceId: null,
    checkoutReviewNote: null,
    dwellSeconds: null,
    dwellProvisional: false,
    overdueArrival: false,
    ...overrides,
  }

;
}

test("monitoring distinguishes not started, in-transit, arrival awaiting checkout, and checkout", () => {
  const record = {
    sessionId: null,
    tripStatus: "NOT_STARTED",
    arrivalAt: null,
    checkoutAt: null,
  };
  assert.equal(getMilestoneState(record), "NOT_STARTED");
  assert.equal(getMilestoneState({ ...record, sessionId: "session-1", tripStatus: "IN_TRANSIT" }), "IN_TRANSIT");
  assert.equal(getMilestoneState({
    ...record,
    sessionId: "session-1",
    tripStatus: "ARRIVAL_SUBMITTED",
    arrivalAt: "2026-11-07T10:00:00.000Z",
  }), "ARRIVAL_SUBMITTED");
  assert.equal(getMilestoneState({
    ...record,
    sessionId: "session-1",
    tripStatus: "CHECKED_IN",
    arrivalAt: "2026-11-07T10:00:00.000Z",
  }), "CHECKOUT_PENDING");
  assert.equal(getMilestoneState({
    ...record,
    sessionId: "session-1",
    tripStatus: "CHECKOUT_SUBMITTED",
    arrivalAt: "2026-11-07T10:00:00.000Z",
    checkoutAt: "2026-11-07T11:00:00.000Z",
  }), "CHECKOUT_SUBMITTED");
  assert.equal(getMilestoneState({
    ...record,
    sessionId: "session-1",
    tripStatus: "CHECKED_OUT",
    arrivalAt: "2026-11-07T10:00:00.000Z",
    checkoutAt: "2026-11-07T11:00:00.000Z",
  }), "CHECKED_OUT");
});

test("monitoring KPIs count only due milestones and keep pending reviews separate", () => {
  const metrics = buildMonitoringMetrics(
    [{
      id: "activity-1",
      title: "Current activity",
      dataClassification: "OPERATIONAL",
      venue: null,
      startDate: "2026-11-08",
      endDate: "2026-11-13",
      status: "ONGOING",
      approvalStatus: "APPROVED",
      colleges: ["College"],
      participantCount: 2,
    }],
    [
      monitoringRecord({
        plannedArrival: "2026-11-07T10:00:00.000Z",
        sessionId: "session-1",
        tripStatus: "IN_TRANSIT",
        arrivalAt: "2026-11-07T10:05:00.000Z",
        arrivalStatus: "VERIFIED",
        checkoutStatus: "PENDING",
        overdueArrival: false,
      }),
      monitoringRecord({
        participantId: "participant-2",
        stopId: "stop-2",
        plannedArrival: "2026-11-08T12:00:00.000Z",
        arrivalFlags: ["LOW_ACCURACY"],
      }),
    ],
    new Date("2026-11-07T16:00:00.000Z"),
  );
  assert.deepEqual(metrics, {
    activeActivities: 1,
    participantsInTransit: 1,
    verifiedMilestones: 1,
    expectedMilestones: 2,
    pendingReviews: 1,
    overdueArrivals: 0,
    evidenceExceptions: 1,
  });
});

test("exception filtering keeps overdue, flagged, and checkout-pending stops without hiding clean records", () => {
  assert.equal(isMonitoringException(monitoringRecord()), false);
  assert.equal(isMonitoringException(monitoringRecord({
    arrivalAt: "2026-11-07T10:00:00.000Z",
  })), true);
  assert.equal(isMonitoringException(monitoringRecord({
    arrivalFlags: ["OUTSIDE_GEOFENCE"],
  })), true);
  assert.equal(isMonitoringException(monitoringRecord({
    overdueArrival: true,
  })), true);
});

test("monitoring status filters distinguish missing milestones and evidence states", () => {
  const records = [
    monitoringRecord({
      sessionId: "session-1",
      tripStatus: "IN_TRANSIT",
      arrivalAt: "2026-11-08T02:00:00.000Z",
      arrivalStatus: "PENDING",
      arrivalEvidenceId: "evidence-1",
    }),
    monitoringRecord({
      participantId: "participant-2",
      stopId: "stop-2",
      sessionId: "session-2",
      tripStatus: "CHECKED_OUT",
      arrivalAt: "2026-11-08T02:00:00.000Z",
      arrivalStatus: "VERIFIED",
      checkoutAt: "2026-11-08T03:00:00.000Z",
      checkoutStatus: "FLAGGED_FOR_REVIEW",
      checkoutFlags: ["MISSING_EVIDENCE"],
    }),
  ];

  assert.deepEqual(filterMonitoringRecords(records, { travelStatus: "IN_TRANSIT" }).map((record) => record.stopId), ["stop-1"]);
  assert.deepEqual(filterMonitoringRecords(records, { arrivalStatus: "NOT_SUBMITTED" }), []);
  assert.deepEqual(filterMonitoringRecords(records, { checkoutStatus: "NOT_SUBMITTED" }).map((record) => record.stopId), ["stop-1"]);
  assert.deepEqual(filterMonitoringRecords(records, { evidenceStatus: "WITH_EVIDENCE" }).map((record) => record.stopId), ["stop-1"]);
  assert.deepEqual(filterMonitoringRecords(records, { evidenceStatus: "MISSING_EVIDENCE" }).map((record) => record.stopId), ["stop-2"]);
  assert.deepEqual(
    filterMonitoringRecords(records, { arrivalStatus: "VERIFIED", checkoutStatus: "FLAGGED_FOR_REVIEW" }).map((record) => record.stopId),
    ["stop-2"],
  );
});

test("monitoring chart summaries use scoped records and count unique participants per college", () => {
  const activities: MonitoringActivity[] = [{
    id: "activity-1",
    title: "Current activity",
    dataClassification: "OPERATIONAL",
    venue: null,
    startDate: "2026-11-08",
    endDate: "2026-11-13",
    status: "ONGOING",
    approvalStatus: "APPROVED",
    colleges: ["College A"],
    participantCount: 2,
  }];
  const records = [
    monitoringRecord({
      sessionId: "session-1",
      tripStatus: "IN_TRANSIT",
      collegeName: "College A",
      arrivalFlags: ["LOW_ACCURACY"],
    }),
    monitoringRecord({
      stopId: "stop-2",
      sessionId: "session-2",
      tripStatus: "IN_TRANSIT",
      collegeName: "College A",
      arrivalFlags: ["LOW_ACCURACY"],
    }),
    monitoringRecord({
      participantId: "participant-2",
      stopId: "stop-3",
      collegeName: "College B",
      arrivalFlags: ["MISSING_EVIDENCE"],
    }),
  ];
  const breakdowns = buildMonitoringBreakdowns(
    activities,
    records,
    {
      activeActivities: 1,
      participantsInTransit: 1,
      verifiedMilestones: 1,
      expectedMilestones: 2,
      pendingReviews: 0,
      overdueArrivals: 0,
      evidenceExceptions: 2,
    },
  );

  assert.deepEqual(breakdowns.activityStatus, [{ label: "ONGOING", count: 1 }]);
  assert.deepEqual(breakdowns.activityTrend, [{ label: "2026-11", count: 1 }]);
  assert.deepEqual(breakdowns.collegeParticipation, [
    { label: "College A", count: 1 },
    { label: "College B", count: 1 },
  ]);
  assert.deepEqual(breakdowns.travelProgress, [
    { label: "IN TRANSIT", count: 2 },
    { label: "NOT STARTED", count: 1 },
  ]);
  assert.deepEqual(breakdowns.checkInCompliance, [
    { label: "Verified milestones", count: 1 },
    { label: "Not yet verified", count: 1 },
  ]);
  assert.deepEqual(breakdowns.evidenceExceptions, [
    { label: "Low GPS accuracy", count: 2 },
    { label: "Missing evidence", count: 1 },
  ]);
});

test("monitoring compliance honors Manila calendar date filters", () => {
  const metrics = buildMonitoringMetrics(
    [],
    [
      monitoringRecord({
        plannedArrival: "2026-11-06T16:30:00.000Z",
        arrivalAt: "2026-11-06T16:40:00.000Z",
        arrivalStatus: "VERIFIED",
      }),
      monitoringRecord({
        participantId: "participant-2",
        stopId: "stop-2",
        plannedArrival: "2026-11-07T16:30:00.000Z",
        arrivalAt: "2026-11-07T16:40:00.000Z",
        arrivalStatus: "VERIFIED",
      }),
    ],
    new Date("2026-11-07T17:00:00.000Z"),
    { dateFrom: "2026-11-08", dateTo: "2026-11-08" },
  );
  assert.equal(metrics.expectedMilestones, 2);
  assert.equal(metrics.verifiedMilestones, 1);
});
