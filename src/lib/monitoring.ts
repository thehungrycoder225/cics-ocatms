import { z } from "zod";
import { AuthorizationError } from "@/lib/authorization";
import type { AuthenticatedIdentity } from "@/lib/authorization";
import { getDb } from "@/lib/db";
import { getMonitoringAccess, hasMonitoringRole } from "@/lib/monitoring-access";
import {
  buildMonitoringMetrics,
  filterMonitoringRecords,
  isMonitoringException,
} from "@/lib/monitoring-state";

const uuid = z.string().uuid();

export const monitoringFilterSchema = z.object({
  collegeId: uuid.optional(),
  activityId: uuid.optional(),
  activityStatus: z.enum(["UPCOMING", "ONGOING", "COMPLETED"]).optional(),
  dateFrom: z.iso.date().optional(),
  dateTo: z.iso.date().optional(),
  participant: z.string().trim().max(100).optional(),
  participantId: uuid.optional(),
  exceptionsOnly: z.enum(["true", "false"]).optional(),
  travelStatus: z.enum([
    "NOT_STARTED",
    "IN_TRANSIT",
    "ARRIVAL_SUBMITTED",
    "CHECKED_IN",
    "CHECKOUT_SUBMITTED",
    "CHECKED_OUT",
    "INTERRUPTED",
    "CANCELLED",
  ]).optional(),
  arrivalStatus: z.enum(["NOT_SUBMITTED", "PENDING", "VERIFIED", "FLAGGED_FOR_REVIEW"]).optional(),
  checkoutStatus: z.enum(["NOT_SUBMITTED", "PENDING", "VERIFIED", "FLAGGED_FOR_REVIEW"]).optional(),
  evidenceStatus: z.enum(["WITH_EVIDENCE", "MISSING_EVIDENCE"]).optional(),
  includeSynthetic: z.enum(["true", "false"]).optional(),
}).refine(
  (filters) => !filters.dateFrom || !filters.dateTo || filters.dateFrom <= filters.dateTo,
  { message: "Start date must be on or before end date." },
);

export type MonitoringFilters = z.infer<typeof monitoringFilterSchema>;

export interface MonitoringActivity {
  id: string;
  title: string;
  dataClassification: "OPERATIONAL" | "SYNTHETIC_TEST";
  venue: string | null;
  startDate: string;
  endDate: string;
  status: string;
  approvalStatus: string;
  colleges: string[];
  participantCount: number;
}

export interface MonitoringCollege {
  id: string;
  name: string;
}

export interface MonitoringParticipant {
  id: string;
  name: string;
}

export interface MonitoringRecord {
  activityId: string;
  activityTitle: string;
  activityStatus: string;
  participantId: string;
  participantName: string;
  collegeName: string | null;
  stopId: string;
  destination: string;
  departureLocation: string | null;
  travelMode: string;
  day: number;
  sequence: number;
  plannedArrival: string | null;
  sessionId: string | null;
  tripStatus: string;
  etaAt: string | null;
  lastLatitude: number | null;
  lastLongitude: number | null;
  lastAccuracyM: number | null;
  gpsAcquiredAt: string | null;
  lastReportedAt: string | null;
  lastReportSource: string | null;
  fixAgeSeconds: number | null;
  arrivalAt: string | null;
  arrivalCheckInId: string | null;
  arrivalStatus: string | null;
  arrivalGeofenceStatus: string | null;
  arrivalLatitude: number | null;
  arrivalLongitude: number | null;
  arrivalAccuracyM: number | null;
  arrivalFlags: string[];
  arrivalEvidenceId: string | null;
  arrivalReviewNote: string | null;
  checkoutAt: string | null;
  checkoutCheckInId: string | null;
  checkoutStatus: string | null;
  checkoutGeofenceStatus: string | null;
  checkoutLatitude: number | null;
  checkoutLongitude: number | null;
  checkoutAccuracyM: number | null;
  checkoutFlags: string[];
  checkoutEvidenceId: string | null;
  checkoutReviewNote: string | null;
  dwellSeconds: number | null;
  dwellProvisional: boolean;
  overdueArrival: boolean;
}

export interface MonitoringMetrics {
  activeActivities: number;
  participantsInTransit: number;
  verifiedMilestones: number;
  expectedMilestones: number;
  pendingReviews: number;
  overdueArrivals: number;
  evidenceExceptions: number;
}

export interface MonitoringDashboardData {
  filters: MonitoringFilters;
  overdueToleranceMinutes: number;
  metrics: MonitoringMetrics;
  availableColleges: MonitoringCollege[];
  availableParticipants: MonitoringParticipant[];
  availableActivities: MonitoringActivity[];
  activities: MonitoringActivity[];
  records: MonitoringRecord[];
}

interface ActivityRow {
  id: string;
  title: string;
  data_classification: "OPERATIONAL" | "SYNTHETIC_TEST";
  venue: string | null;
  start_date: string;
  end_date: string;
  status: string;
  approval_status: string;
  colleges: string[] | null;
  participant_count: number;
}

interface MonitoringRow {
  activity_id: string;
  activity_title: string;
  activity_status: string;
  participant_id: string;
  participant_name: string;
  college_name: string | null;
  stop_id: string;
  destination: string;
  departure_location: string | null;
  travel_mode: string;
  itinerary_day: number;
  stop_sequence: number;
  planned_arrival: Date | null;
  session_id: string | null;
  trip_status: string | null;
  eta_at: Date | null;
  last_latitude: number | null;
  last_longitude: number | null;
  last_accuracy_m: number | null;
  gps_acquired_at: Date | null;
  last_reported_at: Date | null;
  last_report_source: string | null;
  fix_age_seconds: number | null;
  arrival_at: Date | null;
  arrival_check_in_id: string | null;
  arrival_status: string | null;
  arrival_geofence_status: string | null;
  arrival_latitude: number | null;
  arrival_longitude: number | null;
  arrival_accuracy_m: number | null;
  arrival_flags: string[] | null;
  arrival_evidence_id: string | null;
  arrival_review_note: string | null;
  checkout_at: Date | null;
  checkout_check_in_id: string | null;
  checkout_status: string | null;
  checkout_geofence_status: string | null;
  checkout_latitude: number | null;
  checkout_longitude: number | null;
  checkout_accuracy_m: number | null;
  checkout_flags: string[] | null;
  checkout_evidence_id: string | null;
  checkout_review_note: string | null;
  dwell_seconds: number | null;
  dwell_provisional: boolean;
  overdue_arrival: boolean;
}

export function getOverdueToleranceMinutes(): number {
  const value = Number(process.env.CHECKIN_OVERDUE_TOLERANCE_MINUTES ?? "30");
  if (!Number.isInteger(value) || value < 0 || value > 1440) {
    throw new Error("CHECKIN_OVERDUE_TOLERANCE_MINUTES must be an integer from 0 to 1440.");
  }
  return value;
}

export async function getMonitoringDashboard(
  identity: AuthenticatedIdentity,
  filters: MonitoringFilters,
): Promise<MonitoringDashboardData> {
  if (!hasMonitoringRole(identity)) {
    throw new AuthorizationError("Monitoring is available only to authorized Dean or VPSAS accounts.", 403);
  }
  const db = getDb();
  const scope = getMonitoringAccess(identity);
  const vpsas = scope.isVpsas;
  const colleges = scope.deanCollegeIds;
  const toleranceMinutes = getOverdueToleranceMinutes();
  const participantSearch = filters.participant?.trim() || null;
  const includeSynthetic = filters.includeSynthetic === "true";

  const activityRows = await db<ActivityRow[]>`
    SELECT
      a.id,
      a.title,
      a.data_classification,
      a.venue,
      a.start_date::text AS start_date,
      a.end_date::text AS end_date,
      a.status::text AS status,
      a.approval_status::text AS approval_status,
      ARRAY(
        SELECT DISTINCT c.name
        FROM activity_college ac2
        JOIN college c ON c.id = ac2.college_id
        WHERE ac2.activity_id = a.id
          AND (${vpsas} OR ac2.college_id = ANY(${colleges}::uuid[]))
        ORDER BY c.name
      ) AS colleges,
      (
        SELECT COUNT(DISTINCT p.user_id)::int
        FROM participation p
        JOIN app_user u ON u.id = p.user_id
        WHERE p.activity_id = a.id
          AND p.assignment_status = 'ASSIGNED'
          AND (${filters.participantId ?? null}::uuid IS NULL OR u.id = ${filters.participantId ?? null}::uuid)
          AND (${participantSearch}::text IS NULL OR u.full_name ILIKE ${participantSearch ? `%${participantSearch}%` : null})
          AND (
            (${vpsas} AND (${filters.collegeId ?? null}::uuid IS NULL OR u.college_id = ${filters.collegeId ?? null}::uuid))
            OR (NOT ${vpsas} AND u.college_id = ANY(${colleges}::uuid[]))
          )
      ) AS participant_count
    FROM activity a
    WHERE
      (${includeSynthetic} OR a.data_classification = 'OPERATIONAL')
      AND
      (${vpsas} OR EXISTS (
        SELECT 1 FROM activity_college ac
        WHERE ac.activity_id = a.id AND ac.college_id = ANY(${colleges}::uuid[])
      ))
      AND (${filters.collegeId ?? null}::uuid IS NULL OR EXISTS (
        SELECT 1 FROM activity_college ac
        WHERE ac.activity_id = a.id AND ac.college_id = ${filters.collegeId ?? null}::uuid
      ))
      AND (${filters.activityId ?? null}::uuid IS NULL OR a.id = ${filters.activityId ?? null}::uuid)
      AND (${filters.activityStatus ?? null}::text IS NULL OR a.status::text = ${filters.activityStatus ?? null}::text)
      AND (${filters.dateFrom ?? null}::date IS NULL OR a.end_date >= ${filters.dateFrom ?? null}::date)
      AND (${filters.dateTo ?? null}::date IS NULL OR a.start_date <= ${filters.dateTo ?? null}::date)
      AND ((${participantSearch}::text IS NULL AND ${filters.participantId ?? null}::uuid IS NULL) OR EXISTS (
        SELECT 1
        FROM participation p
        JOIN app_user u ON u.id = p.user_id
        WHERE p.activity_id = a.id
          AND p.assignment_status = 'ASSIGNED'
          AND (${filters.participantId ?? null}::uuid IS NULL OR u.id = ${filters.participantId ?? null}::uuid)
          AND (
            (${vpsas} AND (${filters.collegeId ?? null}::uuid IS NULL OR u.college_id = ${filters.collegeId ?? null}::uuid))
            OR (NOT ${vpsas} AND u.college_id = ANY(${colleges}::uuid[]))
          )
          AND (${participantSearch}::text IS NULL OR u.full_name ILIKE ${participantSearch ? `%${participantSearch}%` : null})
      ))
    ORDER BY a.start_date DESC, a.title
  `;

  const availableColleges = await db<MonitoringCollege[]>`
    SELECT id, name
    FROM college
    WHERE ${vpsas} OR id = ANY(${colleges}::uuid[])
    ORDER BY name
  `;

  const availableParticipants = await db<MonitoringParticipant[]>`
    SELECT u.id, u.full_name AS name
    FROM app_user u
    WHERE (u.status = 'ACTIVE' OR (${includeSynthetic} AND EXISTS (
        SELECT 1
        FROM participation p
        JOIN activity a ON a.id = p.activity_id
        WHERE p.user_id = u.id AND a.data_classification = 'SYNTHETIC_TEST'
      )))
      AND EXISTS (SELECT 1 FROM role_assignment r WHERE r.user_id = u.id AND r.role = 'PARTICIPANT')
      AND (${vpsas} OR u.college_id = ANY(${colleges}::uuid[]))
      AND (${filters.activityId ?? null}::uuid IS NULL OR EXISTS (
        SELECT 1 FROM participation p
        JOIN activity_college ac ON ac.activity_id = p.activity_id AND ac.college_id = u.college_id
        WHERE p.user_id = u.id AND p.activity_id = ${filters.activityId ?? null}::uuid
          AND p.assignment_status = 'ASSIGNED'
      ))
    ORDER BY u.full_name, u.id
  `;

  const rows = await db<MonitoringRow[]>`
    SELECT
      a.id AS activity_id,
      a.title AS activity_title,
      a.status::text AS activity_status,
      u.id AS participant_id,
      u.full_name AS participant_name,
      c.name AS college_name,
      s.id AS stop_id,
      s.destination,
      to_jsonb(s)->>'departure_location' AS departure_location,
      s.travel_mode,
      s.itinerary_day,
      s.stop_sequence,
      s.planned_arrival,
      ts.id AS session_id,
      ts.status::text AS trip_status,
      ts.eta_at,
      CASE
        WHEN checkout.server_received_at >= GREATEST(
          COALESCE(arrival.server_received_at, '-infinity'::timestamptz),
          COALESCE(ts.last_location_received_at, '-infinity'::timestamptz)
        ) THEN ST_Y(checkout.location::geometry)
        WHEN arrival.server_received_at >= COALESCE(ts.last_location_received_at, '-infinity'::timestamptz)
          THEN ST_Y(arrival.location::geometry)
        ELSE ST_Y(ts.last_location::geometry)
      END AS last_latitude,
      CASE
        WHEN checkout.server_received_at >= GREATEST(
          COALESCE(arrival.server_received_at, '-infinity'::timestamptz),
          COALESCE(ts.last_location_received_at, '-infinity'::timestamptz)
        ) THEN ST_X(checkout.location::geometry)
        WHEN arrival.server_received_at >= COALESCE(ts.last_location_received_at, '-infinity'::timestamptz)
          THEN ST_X(arrival.location::geometry)
        ELSE ST_X(ts.last_location::geometry)
      END AS last_longitude,
      CASE
        WHEN checkout.server_received_at >= GREATEST(
          COALESCE(arrival.server_received_at, '-infinity'::timestamptz),
          COALESCE(ts.last_location_received_at, '-infinity'::timestamptz)
        ) THEN checkout.accuracy_m
        WHEN arrival.server_received_at >= COALESCE(ts.last_location_received_at, '-infinity'::timestamptz)
          THEN arrival.accuracy_m
        ELSE ts.last_accuracy_m
      END AS last_accuracy_m,
      CASE
        WHEN checkout.server_received_at >= GREATEST(
          COALESCE(arrival.server_received_at, '-infinity'::timestamptz),
          COALESCE(ts.last_location_received_at, '-infinity'::timestamptz)
        ) THEN checkout.gps_acquired_at
        WHEN arrival.server_received_at >= COALESCE(ts.last_location_received_at, '-infinity'::timestamptz)
          THEN arrival.gps_acquired_at
        ELSE ts.last_gps_acquired_at
      END AS gps_acquired_at,
      GREATEST(arrival.server_received_at, checkout.server_received_at, ts.last_location_received_at)
        AS last_reported_at,
      CASE
        WHEN checkout.server_received_at >= GREATEST(
          COALESCE(arrival.server_received_at, '-infinity'::timestamptz),
          COALESCE(ts.last_location_received_at, '-infinity'::timestamptz)
        ) THEN 'CHECKOUT'
        WHEN arrival.server_received_at >= COALESCE(ts.last_location_received_at, '-infinity'::timestamptz)
          THEN 'ARRIVAL'
        WHEN ts.last_location_received_at = ts.started_at THEN 'START_TRAVEL'
        WHEN ts.last_location_received_at IS NOT NULL THEN 'LOCATION_UPDATE'
        ELSE NULL
      END AS last_report_source,
      GREATEST(0, EXTRACT(EPOCH FROM (
        clock_timestamp() - GREATEST(arrival.server_received_at, checkout.server_received_at, ts.last_location_received_at)
      )))::int AS fix_age_seconds,
      arrival.server_received_at AS arrival_at,
      arrival.id AS arrival_check_in_id,
      arrival.validation_status::text AS arrival_status,
      arrival.geofence_status::text AS arrival_geofence_status,
      ST_Y(arrival.location::geometry) AS arrival_latitude,
      ST_X(arrival.location::geometry) AS arrival_longitude,
      arrival.accuracy_m AS arrival_accuracy_m,
      arrival.review_flags AS arrival_flags,
      arrival_evidence.id AS arrival_evidence_id,
      arrival_review.note AS arrival_review_note,
      checkout.server_received_at AS checkout_at,
      checkout.id AS checkout_check_in_id,
      checkout.validation_status::text AS checkout_status,
      checkout.geofence_status::text AS checkout_geofence_status,
      ST_Y(checkout.location::geometry) AS checkout_latitude,
      ST_X(checkout.location::geometry) AS checkout_longitude,
      checkout.accuracy_m AS checkout_accuracy_m,
      checkout.review_flags AS checkout_flags,
      checkout_evidence.id AS checkout_evidence_id,
      checkout_review.note AS checkout_review_note,
      CASE WHEN arrival.server_received_at IS NOT NULL AND checkout.server_received_at IS NOT NULL
        THEN GREATEST(0, EXTRACT(EPOCH FROM (checkout.server_received_at - arrival.server_received_at)))::int
        ELSE NULL
      END AS dwell_seconds,
      (
        checkout.server_received_at IS NOT NULL
        AND (arrival.validation_status <> 'VERIFIED' OR checkout.validation_status <> 'VERIFIED')
      ) AS dwell_provisional,
      (
        s.planned_arrival IS NOT NULL
        AND clock_timestamp() > s.planned_arrival + (${toleranceMinutes} * interval '1 minute')
        AND arrival.id IS NULL
      ) AS overdue_arrival
    FROM activity a
    JOIN participation p ON p.activity_id = a.id AND p.assignment_status = 'ASSIGNED'
    JOIN app_user u ON u.id = p.user_id
    LEFT JOIN college c ON c.id = u.college_id
    JOIN itinerary_stop s ON s.activity_id = a.id AND s.is_active
    LEFT JOIN LATERAL (
      SELECT t.*
      FROM travel_session t
      WHERE t.itinerary_stop_id = s.id AND t.participation_id = p.id
      ORDER BY t.started_at DESC
      LIMIT 1
    ) ts ON true
    LEFT JOIN check_in arrival ON arrival.travel_session_id = ts.id AND arrival.kind = 'ARRIVAL'
    LEFT JOIN check_in checkout ON checkout.travel_session_id = ts.id AND checkout.kind = 'CHECKOUT'
    LEFT JOIN evidence arrival_evidence ON arrival_evidence.check_in_id = arrival.id
    LEFT JOIN evidence checkout_evidence ON checkout_evidence.check_in_id = checkout.id
    LEFT JOIN LATERAL (
      SELECT r.note FROM check_in_review r
      WHERE r.check_in_id = arrival.id
      ORDER BY r.reviewed_at DESC LIMIT 1
    ) arrival_review ON true
    LEFT JOIN LATERAL (
      SELECT r.note FROM check_in_review r
      WHERE r.check_in_id = checkout.id
      ORDER BY r.reviewed_at DESC LIMIT 1
    ) checkout_review ON true
    WHERE
      (${includeSynthetic} OR a.data_classification = 'OPERATIONAL')
      AND
      (${vpsas} OR EXISTS (
        SELECT 1 FROM activity_college ac
        WHERE ac.activity_id = a.id AND ac.college_id = ANY(${colleges}::uuid[])
      ))
      AND (${filters.collegeId ?? null}::uuid IS NULL OR EXISTS (
        SELECT 1 FROM activity_college ac
        WHERE ac.activity_id = a.id AND ac.college_id = ${filters.collegeId ?? null}::uuid
      ))
      AND (${filters.activityId ?? null}::uuid IS NULL OR a.id = ${filters.activityId ?? null}::uuid)
      AND (${filters.activityStatus ?? null}::text IS NULL OR a.status::text = ${filters.activityStatus ?? null}::text)
      AND (${filters.dateFrom ?? null}::date IS NULL OR a.end_date >= ${filters.dateFrom ?? null}::date)
      AND (${filters.dateTo ?? null}::date IS NULL OR a.start_date <= ${filters.dateTo ?? null}::date)
      AND (
        (${vpsas} AND (${filters.collegeId ?? null}::uuid IS NULL OR u.college_id = ${filters.collegeId ?? null}::uuid))
        OR (NOT ${vpsas} AND u.college_id = ANY(${colleges}::uuid[]))
      )
      AND (a.approval_status = 'APPROVED' OR ts.id IS NOT NULL)
      AND (${filters.participantId ?? null}::uuid IS NULL OR u.id = ${filters.participantId ?? null}::uuid)
      AND (${participantSearch}::text IS NULL OR u.full_name ILIKE ${participantSearch ? `%${participantSearch}%` : null})
    ORDER BY a.start_date DESC, a.title, u.full_name, s.itinerary_day, s.stop_sequence
  `;

  const activities: MonitoringActivity[] = activityRows.map((row) => ({
    id: row.id,
    title: row.title,
    dataClassification: row.data_classification,
    venue: row.venue,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
    approvalStatus: row.approval_status,
    colleges: row.colleges ?? [],
    participantCount: row.participant_count,
  }));
  const allRecords: MonitoringRecord[] = rows.map((row) => ({
    activityId: row.activity_id,
    activityTitle: row.activity_title,
    activityStatus: row.activity_status,
    participantId: row.participant_id,
    participantName: row.participant_name,
    collegeName: row.college_name,
    stopId: row.stop_id,
    destination: row.destination,
    departureLocation: row.departure_location,
    travelMode: row.travel_mode,
    day: row.itinerary_day,
    sequence: row.stop_sequence,
    plannedArrival: row.planned_arrival?.toISOString() ?? null,
    sessionId: row.session_id,
    tripStatus: row.trip_status ?? "NOT_STARTED",
    etaAt: row.eta_at?.toISOString() ?? null,
    lastLatitude: row.last_latitude,
    lastLongitude: row.last_longitude,
    lastAccuracyM: row.last_accuracy_m,
    gpsAcquiredAt: row.gps_acquired_at?.toISOString() ?? null,
    lastReportedAt: row.last_reported_at?.toISOString() ?? null,
    lastReportSource: row.last_report_source,
    fixAgeSeconds: row.fix_age_seconds,
    arrivalAt: row.arrival_at?.toISOString() ?? null,
    arrivalCheckInId: row.arrival_check_in_id,
    arrivalStatus: row.arrival_status,
    arrivalGeofenceStatus: row.arrival_geofence_status,
    arrivalLatitude: row.arrival_latitude,
    arrivalLongitude: row.arrival_longitude,
    arrivalAccuracyM: row.arrival_accuracy_m,
    arrivalFlags: row.arrival_flags ?? [],
    arrivalEvidenceId: row.arrival_evidence_id,
    arrivalReviewNote: row.arrival_review_note,
    checkoutAt: row.checkout_at?.toISOString() ?? null,
    checkoutCheckInId: row.checkout_check_in_id,
    checkoutStatus: row.checkout_status,
    checkoutGeofenceStatus: row.checkout_geofence_status,
    checkoutLatitude: row.checkout_latitude,
    checkoutLongitude: row.checkout_longitude,
    checkoutAccuracyM: row.checkout_accuracy_m,
    checkoutFlags: row.checkout_flags ?? [],
    checkoutEvidenceId: row.checkout_evidence_id,
    checkoutReviewNote: row.checkout_review_note,
    dwellSeconds: row.dwell_seconds,
    dwellProvisional: row.dwell_provisional,
    overdueArrival: row.overdue_arrival,
  }));

  const statusFilteredRecords = filterMonitoringRecords(allRecords, filters);
  const hasRecordStatusFilter = Boolean(
    filters.travelStatus || filters.arrivalStatus || filters.checkoutStatus || filters.evidenceStatus,
  );
  const filteredActivityIds = hasRecordStatusFilter
    ? new Set(statusFilteredRecords.map((record) => record.activityId))
    : null;
  const visibleActivities = filteredActivityIds
    ? activities.filter((activity) => filteredActivityIds.has(activity.id))
    : activities;
  const metrics = buildMonitoringMetrics(visibleActivities, statusFilteredRecords, new Date(), {
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
  });
  const visibleRecords = filters.exceptionsOnly === "true"
    ? statusFilteredRecords.filter(isMonitoringException)
    : statusFilteredRecords;

  await db`
    INSERT INTO audit_log (actor_id, action, resource_type, details)
    VALUES (
      ${identity.id}::uuid,
      'MONITORING_DASHBOARD_READ',
      'activity',
      ${JSON.stringify({
        activityCount: visibleActivities.length,
        recordCount: visibleRecords.length,
        matchedRecordCount: allRecords.length,
        role: vpsas ? "VPSAS" : "DEAN",
        filters,
      })}::text::jsonb
    )
  `;

  return {
    filters,
    overdueToleranceMinutes: toleranceMinutes,
    metrics,
    availableColleges,
    availableParticipants,
    availableActivities: activities,
    activities: visibleActivities,
    records: visibleRecords,
  };
}
