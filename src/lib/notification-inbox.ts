import { AuthorizationError, type AuthenticatedIdentity } from "@/lib/authorization";
import { getDb } from "@/lib/db";
import { getMonitoringAccess, hasMonitoringRole } from "@/lib/monitoring-access";

interface NotificationRow {
  id: string;
  kind: "ARRIVAL" | "CHECKOUT";
  activity_title: string;
  participant_name: string;
  destination: string;
  received_at: Date;
  validation_status: "PENDING" | "FLAGGED_FOR_REVIEW" | "VERIFIED";
  read_at: Date | null;
  unread_count: number;
}

export async function getNotificationInbox(identity: AuthenticatedIdentity) {
  if (!hasMonitoringRole(identity)) {
    throw new AuthorizationError("Notifications require an authorized Dean or VPSAS role.", 403);
  }

  const access = getMonitoringAccess(identity);
  const db = getDb();
  const rows = await db<NotificationRow[]>`
    SELECT
      n.id,
      ci.kind::text AS kind,
      a.title AS activity_title,
      participant.full_name AS participant_name,
      s.destination,
      ci.server_received_at AS received_at,
      ci.validation_status::text AS validation_status,
      n.read_at,
      (COUNT(*) FILTER (WHERE n.read_at IS NULL) OVER ())::int AS unread_count
    FROM app_notification n
    JOIN check_in ci ON ci.id = n.check_in_id
    JOIN travel_session ts ON ts.id = ci.travel_session_id
    JOIN participation p ON p.id = ts.participation_id
    JOIN app_user participant ON participant.id = p.user_id
    JOIN itinerary_stop s ON s.id = ts.itinerary_stop_id
    JOIN activity a ON a.id = s.activity_id
    WHERE n.recipient_id = ${identity.id}::uuid
      AND (
        ${access.isVpsas}
        OR (
          participant.college_id = ANY(${access.deanCollegeIds}::uuid[])
          AND EXISTS (
            SELECT 1
            FROM activity_college ac
            WHERE ac.activity_id = a.id
              AND ac.college_id = participant.college_id
          )
        )
      )
    ORDER BY n.created_at DESC
    LIMIT 50
  `;

  return {
    notifications: rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      activityTitle: row.activity_title,
      participantName: row.participant_name,
      destination: row.destination,
      receivedAt: row.received_at.toISOString(),
      validationStatus: row.validation_status,
      readAt: row.read_at?.toISOString() ?? null,
    })),
    unreadCount: rows[0]?.unread_count ?? 0,
  };
}

export async function markNotificationRead(
  identity: AuthenticatedIdentity,
  notificationId: string,
) {
  if (!hasMonitoringRole(identity)) {
    throw new AuthorizationError("Notifications require an authorized Dean or VPSAS role.", 403);
  }

  const access = getMonitoringAccess(identity);
  const [notification] = await getDb()<{
    id: string;
    read_at: Date | null;
  }[]>`
    UPDATE app_notification n
    SET read_at = COALESCE(n.read_at, now())
    FROM check_in ci
    JOIN travel_session ts ON ts.id = ci.travel_session_id
    JOIN participation p ON p.id = ts.participation_id
    JOIN app_user participant ON participant.id = p.user_id
    JOIN itinerary_stop s ON s.id = ts.itinerary_stop_id
    JOIN activity a ON a.id = s.activity_id
    WHERE n.id = ${notificationId}::uuid
      AND n.recipient_id = ${identity.id}::uuid
      AND ci.id = n.check_in_id
      AND (
        ${access.isVpsas}
        OR (
          participant.college_id = ANY(${access.deanCollegeIds}::uuid[])
          AND EXISTS (
            SELECT 1
            FROM activity_college ac
            WHERE ac.activity_id = a.id
              AND ac.college_id = participant.college_id
          )
        )
      )
    RETURNING n.id, n.read_at
  `;

  return notification
    ? { id: notification.id, readAt: notification.read_at?.toISOString() ?? null }
    : null;
}
