import { getDb } from "@/lib/db";

export interface ParticipantActivity {
  id: string;
  title: string;
  venue: string | null;
  startDate: string;
  endDate: string;
  approvalStatus: string;
  stops: ParticipantStopSummary[];
}

export interface ParticipantStopSummary {
  id: string;
  activityId: string;
  activityTitle: string;
  destination: string;
  departureLocation: string | null;
  day: number;
  sequence: number;
  geofenceRadiusM: number;
  plannedArrival: string | null;
  travelMode: string;
  status: string;
  sessionId: string | null;
  etaAt: string | null;
  etaStatus: string | null;
  arrivalAt: string | null;
  arrivalReviewStatus: string | null;
  arrivalReviewFlags: string[];
  checkoutAt: string | null;
  checkoutReviewStatus: string | null;
  checkoutReviewFlags: string[];
  arrivalEvidenceId: string | null;
  checkoutEvidenceId: string | null;
  lastAccuracyM: number | null;
  lastGpsAcquiredAt: string | null;
  lastLocationReceivedAt: string | null;
  dwellSeconds: number | null;
  dwellProvisional: boolean;
}

interface ParticipantStopRow {
  id: string;
  activity_id: string;
  activity_title: string;
  destination: string;
  departure_location: string | null;
  itinerary_day: number;
  stop_sequence: number;
  geofence_radius_m: number;
  planned_arrival: Date | null;
  travel_mode: string;
  status: string | null;
  session_id: string | null;
  eta_at: Date | null;
  eta_status: string | null;
  arrival_at: Date | null;
  arrival_review_status: string | null;
  arrival_review_flags: string[];
  checkout_at: Date | null;
  checkout_review_status: string | null;
  checkout_review_flags: string[];
  arrival_evidence_id: string | null;
  checkout_evidence_id: string | null;
  last_accuracy_m: number | null;
  last_gps_acquired_at: Date | null;
  last_location_received_at: Date | null;
  dwell_seconds: number | null;
  dwell_provisional: boolean;
}

function mapStop(row: ParticipantStopRow): ParticipantStopSummary {
  return {
    id: row.id,
    activityId: row.activity_id,
    activityTitle: row.activity_title,
    destination: row.destination,
    departureLocation: row.departure_location,
    day: row.itinerary_day,
    sequence: row.stop_sequence,
    geofenceRadiusM: row.geofence_radius_m,
    plannedArrival: row.planned_arrival?.toISOString() ?? null,
    travelMode: row.travel_mode,
    status: row.status ?? "NOT_STARTED",
    sessionId: row.session_id,
    etaAt: row.eta_at?.toISOString() ?? null,
    etaStatus: row.eta_status,
    arrivalAt: row.arrival_at?.toISOString() ?? null,
    arrivalReviewStatus: row.arrival_review_status,
    arrivalReviewFlags: row.arrival_review_flags ?? [],
    checkoutAt: row.checkout_at?.toISOString() ?? null,
    checkoutReviewStatus: row.checkout_review_status,
    checkoutReviewFlags: row.checkout_review_flags ?? [],
    arrivalEvidenceId: row.arrival_evidence_id,
    checkoutEvidenceId: row.checkout_evidence_id,
    lastAccuracyM: row.last_accuracy_m,
    lastGpsAcquiredAt: row.last_gps_acquired_at?.toISOString() ?? null,
    lastLocationReceivedAt: row.last_location_received_at?.toISOString() ?? null,
    dwellSeconds: row.dwell_seconds,
    dwellProvisional: row.dwell_provisional,
  };
}

const stopSelect = `
  SELECT
    s.id,
    s.activity_id,
    a.title AS activity_title,
    s.destination,
    to_jsonb(s)->>'departure_location' AS departure_location,
    s.itinerary_day,
    s.stop_sequence,
    s.geofence_radius_m,
    s.planned_arrival,
    s.travel_mode,
    ts.status::text AS status,
    ts.id AS session_id,
    ts.eta_at,
    ts.eta_status,
    arrival.server_received_at AS arrival_at,
    arrival.validation_status::text AS arrival_review_status,
    arrival.review_flags AS arrival_review_flags,
    departure.server_received_at AS checkout_at,
    departure.validation_status::text AS checkout_review_status,
    departure.review_flags AS checkout_review_flags,
    arrival_evidence.id AS arrival_evidence_id,
    departure_evidence.id AS checkout_evidence_id,
    ts.last_accuracy_m,
    ts.last_gps_acquired_at,
    ts.last_location_received_at,
    CASE
      WHEN arrival.server_received_at IS NOT NULL AND departure.server_received_at IS NOT NULL
      THEN GREATEST(0, EXTRACT(EPOCH FROM (departure.server_received_at - arrival.server_received_at)))::int
      ELSE NULL
    END AS dwell_seconds,
    CASE
      WHEN departure.server_received_at IS NULL THEN false
      WHEN arrival.validation_status <> 'VERIFIED' OR departure.validation_status <> 'VERIFIED' THEN true
      ELSE false
    END AS dwell_provisional
  FROM itinerary_stop s
  JOIN activity a ON a.id = s.activity_id AND a.data_classification = 'OPERATIONAL'
  JOIN participation p ON p.activity_id = a.id
    AND p.user_id = $1::uuid
    AND p.assignment_status = 'ASSIGNED'
  LEFT JOIN LATERAL (
    SELECT t.* FROM travel_session t
    WHERE t.itinerary_stop_id = s.id AND t.participation_id = p.id
    ORDER BY t.started_at DESC LIMIT 1
  ) ts ON true
  LEFT JOIN check_in arrival ON arrival.travel_session_id = ts.id AND arrival.kind = 'ARRIVAL'
  LEFT JOIN check_in departure ON departure.travel_session_id = ts.id AND departure.kind = 'CHECKOUT'
  LEFT JOIN evidence arrival_evidence ON arrival_evidence.check_in_id = arrival.id
  LEFT JOIN evidence departure_evidence ON departure_evidence.check_in_id = departure.id
`;

export async function listParticipantActivities(participantId: string): Promise<ParticipantActivity[]> {
  const db = getDb();
  const activities = await db<
    {
      id: string;
      title: string;
      venue: string | null;
      start_date: string;
      end_date: string;
      approval_status: string;
    }[]
  >`
    SELECT DISTINCT a.id, a.title, a.venue, a.start_date::text, a.end_date::text, a.approval_status::text
    FROM activity a
    JOIN participation p ON p.activity_id = a.id
    WHERE p.user_id = ${participantId}::uuid
      AND a.data_classification = 'OPERATIONAL'
      AND p.assignment_status = 'ASSIGNED'
      AND (
        a.approval_status = 'APPROVED'
        OR EXISTS (
          SELECT 1
          FROM travel_session ts
          WHERE ts.participation_id = p.id
        )
      )
    ORDER BY a.start_date::text DESC, a.title
    LIMIT 100
  `;

  const results: ParticipantActivity[] = [];
  for (const activity of activities) {
    const stopRows = await db.unsafe<ParticipantStopRow[]>(
      `${stopSelect}
       WHERE s.activity_id = $2::uuid
         AND s.is_active
         AND (a.approval_status = 'APPROVED' OR ts.id IS NOT NULL)
       ORDER BY s.itinerary_day, s.stop_sequence`,
      [participantId, activity.id],
    );
    results.push({
      id: activity.id,
      title: activity.title,
      venue: activity.venue,
      startDate: activity.start_date,
      endDate: activity.end_date,
      approvalStatus: activity.approval_status,
      stops: stopRows.map(mapStop),
    });
  }
  await db`
    INSERT INTO audit_log (actor_id, action, resource_type, details)
    VALUES (
      ${participantId}::uuid,
      'PARTICIPANT_JOURNEY_READ',
      'activity',
      ${JSON.stringify({ activityCount: results.length })}::text::jsonb
    )
  `;
  return results;
}

export async function getParticipantActivity(
  participantId: string,
  activityId: string,
): Promise<ParticipantActivity | null> {
  const db = getDb();
  const [activity] = await db<
    {
      id: string;
      title: string;
      venue: string | null;
      start_date: string;
      end_date: string;
      approval_status: string;
    }[]
  >`
    SELECT a.id, a.title, a.venue, a.start_date::text, a.end_date::text, a.approval_status::text
    FROM activity a
    JOIN participation p ON p.activity_id = a.id
    WHERE a.id = ${activityId}::uuid
      AND a.data_classification = 'OPERATIONAL'
      AND p.user_id = ${participantId}::uuid
      AND p.assignment_status = 'ASSIGNED'
      AND (
        a.approval_status = 'APPROVED'
        OR EXISTS (
          SELECT 1
          FROM travel_session ts
          WHERE ts.participation_id = p.id
        )
      )
    LIMIT 1
  `;
  if (!activity) return null;

  const stopRows = await db.unsafe<ParticipantStopRow[]>(
    `${stopSelect}
     WHERE s.activity_id = $2::uuid
       AND s.is_active
       AND (a.approval_status = 'APPROVED' OR ts.id IS NOT NULL)
     ORDER BY s.itinerary_day, s.stop_sequence`,
    [participantId, activity.id],
  );
  await db`
    INSERT INTO audit_log (actor_id, action, resource_type, resource_id)
    VALUES (${participantId}::uuid, 'PARTICIPANT_ACTIVITY_READ', 'activity', ${activityId})
  `;
  return {
    id: activity.id,
    title: activity.title,
    venue: activity.venue,
    startDate: activity.start_date,
    endDate: activity.end_date,
    approvalStatus: activity.approval_status,
    stops: stopRows.map(mapStop),
  };
}

export async function getParticipantStop(
  participantId: string,
  stopId: string,
): Promise<ParticipantStopSummary | null> {
  const db = getDb();
  const rows = await db.unsafe<ParticipantStopRow[]>(
    `${stopSelect}
     WHERE s.id = $2::uuid
       AND s.is_active
       AND (a.approval_status = 'APPROVED' OR ts.id IS NOT NULL)
     LIMIT 1`,
    [participantId, stopId],
  );
  if (rows[0]) {
    await db`
      INSERT INTO audit_log (actor_id, action, resource_type, resource_id)
      VALUES (${participantId}::uuid, 'ITINERARY_STOP_READ', 'itinerary_stop', ${stopId})
    `;
  }
  return rows[0] ? mapStop(rows[0]) : null;
}
