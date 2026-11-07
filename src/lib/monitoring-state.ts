import type { MonitoringRecord } from "@/lib/monitoring";
import type { MonitoringActivity, MonitoringMetrics } from "@/lib/monitoring";

export function getMilestoneState(record: Pick<
  MonitoringRecord,
  "sessionId" | "tripStatus" | "arrivalAt" | "checkoutAt"
>): string {
  if (!record.sessionId) return "NOT_STARTED";
  if (record.tripStatus === "CHECKED_OUT") return "CHECKED_OUT";
  if (record.checkoutAt) return "CHECKOUT_SUBMITTED";
  if (record.tripStatus === "ARRIVAL_SUBMITTED") return "ARRIVAL_SUBMITTED";
  if (record.tripStatus === "CHECKED_IN" || record.arrivalAt) return "CHECKOUT_PENDING";
  return record.tripStatus;
}

export function buildMonitoringMetrics(
  activities: MonitoringActivity[],
  records: MonitoringRecord[],
  now: Date,
  period: { dateFrom?: string; dateTo?: string } = {},
): MonitoringMetrics {
  const dateParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => dateParts.find((value) => value.type === type)?.value ?? "";
  const localToday = `${part("year")}-${part("month")}-${part("day")}`;
  const periodStart = period.dateFrom
    ? Date.parse(`${period.dateFrom}T00:00:00+08:00`)
    : Number.NEGATIVE_INFINITY;
  const periodEnd = period.dateTo
    ? Date.parse(`${period.dateTo}T23:59:59.999+08:00`)
    : Number.POSITIVE_INFINITY;
  const dueStops = records.filter((record) => {
    if (!record.plannedArrival) return false;
    const plannedArrival = Date.parse(record.plannedArrival);
    return plannedArrival <= now.getTime() && plannedArrival >= periodStart && plannedArrival <= periodEnd;
  });
  const expectedMilestones = dueStops.reduce(
    (count, record) => count + 1 + (record.arrivalAt ? 1 : 0),
    0,
  );
  const verifiedMilestones = dueStops.reduce(
    (count, record) =>
      count +
      (record.arrivalStatus === "VERIFIED" ? 1 : 0) +
      (record.arrivalAt && record.checkoutStatus === "VERIFIED" ? 1 : 0),
    0,
  );
  const currentActivities = activities.filter(
    (activity) =>
      activity.status !== "COMPLETED" &&
      activity.startDate <= localToday &&
      activity.endDate >= localToday,
  );
  const inTransitParticipants = new Set(
    records
      .filter((record) => record.tripStatus === "IN_TRANSIT")
      .map((record) => record.participantId),
  );
  const evidenceExceptions = records.filter((record) =>
    [...record.arrivalFlags, ...record.checkoutFlags].some((flag) =>
      ["OUTSIDE_GEOFENCE", "LOW_ACCURACY", "DELAYED_FIX", "MISSING_EVIDENCE"].includes(flag),
    ),
  ).length;

  return {
    activeActivities: currentActivities.length,
    participantsInTransit: inTransitParticipants.size,
    verifiedMilestones,
    expectedMilestones,
    pendingReviews: records.reduce(
      (count, record) =>
        count +
        (record.arrivalStatus === "PENDING" || record.arrivalStatus === "FLAGGED_FOR_REVIEW" ? 1 : 0) +
        (record.checkoutStatus === "PENDING" || record.checkoutStatus === "FLAGGED_FOR_REVIEW" ? 1 : 0),
      0,
    ),
    overdueArrivals: records.filter((record) => record.overdueArrival).length,
    evidenceExceptions,
  };
}

export function isMonitoringException(record: MonitoringRecord): boolean {
  const evidenceExceptionFlags = [
    ...record.arrivalFlags,
    ...record.checkoutFlags,
  ].some((flag) =>
    ["OUTSIDE_GEOFENCE", "LOW_ACCURACY", "DELAYED_FIX", "MISSING_EVIDENCE"].includes(flag),
  );
  return Boolean(
    record.overdueArrival ||
    (record.arrivalAt && !record.checkoutAt) ||
    evidenceExceptionFlags ||
    record.arrivalStatus === "FLAGGED_FOR_REVIEW" ||
    record.checkoutStatus === "FLAGGED_FOR_REVIEW",
  );
}

export function filterMonitoringRecords(
  records: MonitoringRecord[],
  filters: {
    travelStatus?: string;
    arrivalStatus?: string;
    checkoutStatus?: string;
    evidenceStatus?: "WITH_EVIDENCE" | "MISSING_EVIDENCE";
  },
): MonitoringRecord[] {
  return records.filter((record) => {
    if (filters.travelStatus && record.tripStatus !== filters.travelStatus) return false;
    if (filters.arrivalStatus && (record.arrivalStatus ?? "NOT_SUBMITTED") !== filters.arrivalStatus) return false;
    if (filters.checkoutStatus && (record.checkoutStatus ?? "NOT_SUBMITTED") !== filters.checkoutStatus) return false;

    if (filters.evidenceStatus === "WITH_EVIDENCE") {
      return Boolean(record.arrivalEvidenceId || record.checkoutEvidenceId);
    }
    if (filters.evidenceStatus === "MISSING_EVIDENCE") {
      const submittedWithoutEvidence =
        (record.arrivalAt && !record.arrivalEvidenceId) ||
        (record.checkoutAt && !record.checkoutEvidenceId);
      return Boolean(
        submittedWithoutEvidence ||
        [...record.arrivalFlags, ...record.checkoutFlags].includes("MISSING_EVIDENCE"),
      );
    }
    return true;
  });
}

export interface MonitoringBreakdownItem {
  label: string;
  count: number;
}

export interface MonitoringBreakdowns {
  activityStatus: MonitoringBreakdownItem[];
  activityTrend: MonitoringBreakdownItem[];
  collegeParticipation: MonitoringBreakdownItem[];
  travelProgress: MonitoringBreakdownItem[];
  checkInCompliance: MonitoringBreakdownItem[];
  evidenceExceptions: MonitoringBreakdownItem[];
}

function sortedBreakdown(counts: Map<string, number>): MonitoringBreakdownItem[] {
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

export function buildMonitoringBreakdowns(
  activities: MonitoringActivity[],
  records: MonitoringRecord[],
  metrics: MonitoringMetrics,
): MonitoringBreakdowns {
  const activityStatus = new Map<string, number>();
  const activityTrend = new Map<string, number>();
  const collegeParticipants = new Map<string, Set<string>>();
  const travelProgress = new Map<string, number>();
  const exceptionCounts = new Map<string, number>();

  for (const activity of activities) {
    activityStatus.set(activity.status, (activityStatus.get(activity.status) ?? 0) + 1);
    const month = activity.startDate.slice(0, 7);
    activityTrend.set(month, (activityTrend.get(month) ?? 0) + 1);
  }

  for (const record of records) {
    const progress = getMilestoneState(record).replaceAll("_", " ");
    travelProgress.set(progress, (travelProgress.get(progress) ?? 0) + 1);

    if (record.collegeName) {
      const participants = collegeParticipants.get(record.collegeName) ?? new Set<string>();
      participants.add(record.participantId);
      collegeParticipants.set(record.collegeName, participants);
    }

    const flags = new Set([...record.arrivalFlags, ...record.checkoutFlags]);
    for (const [flag, label] of [
      ["OUTSIDE_GEOFENCE", "Outside geofence"],
      ["LOW_ACCURACY", "Low GPS accuracy"],
      ["DELAYED_FIX", "Delayed GPS fix"],
      ["MISSING_EVIDENCE", "Missing evidence"],
    ]) {
      if (flags.has(flag)) exceptionCounts.set(label, (exceptionCounts.get(label) ?? 0) + 1);
    }
    if (record.arrivalStatus === "FLAGGED_FOR_REVIEW" || record.checkoutStatus === "FLAGGED_FOR_REVIEW") {
      exceptionCounts.set("Flagged for review", (exceptionCounts.get("Flagged for review") ?? 0) + 1);
    }
  }

  const collegeParticipation = [...collegeParticipants.entries()]
    .map(([label, participants]) => ({ label, count: participants.size }))
    .sort((left, right) => left.label.localeCompare(right.label));
  const activityTrendItems = [...activityTrend.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => left.label.localeCompare(right.label));

  return {
    activityStatus: sortedBreakdown(activityStatus),
    activityTrend: activityTrendItems,
    collegeParticipation,
    travelProgress: sortedBreakdown(travelProgress),
    checkInCompliance: [
      { label: "Verified milestones", count: metrics.verifiedMilestones },
      { label: "Not yet verified", count: Math.max(0, metrics.expectedMilestones - metrics.verifiedMilestones) },
    ].filter((item) => item.count > 0),
    evidenceExceptions: sortedBreakdown(exceptionCounts),
  };
}
