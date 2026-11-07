import type { AuthenticatedIdentity } from "@/lib/authorization";
import { getDb } from "@/lib/db";

export interface ActivitySummary {
  id: string;
  title: string;
  venue: string | null;
  startDate: string;
  endDate: string;
  status: string;
  approvalStatus: string;
  collegeName: string | null;
  participantCount: number;
}

export async function listVisibleActivities(
  identity: AuthenticatedIdentity,
): Promise<ActivitySummary[]> {
  const db = getDb();
  const roles = identity.assignments.map((assignment) => assignment.role);
  const isVpsas = roles.includes("VPSAS");
  const deanCollegeIds = identity.assignments
    .filter((assignment) => assignment.role === "DEAN" && assignment.collegeId)
    .map((assignment) => assignment.collegeId as string);

  const rows = await db<
    {
      id: string;
      title: string;
      venue: string | null;
      start_date: string;
      end_date: string;
      status: string;
      approval_status: string;
      college_name: string | null;
      participant_count: number;
    }[]
  >`
    SELECT
      a.id,
      a.title,
      a.venue,
      a.start_date::text AS start_date,
      a.end_date::text AS end_date,
      a.status,
      a.approval_status,
      c.name AS college_name,
      COUNT(DISTINCT p.user_id)::int AS participant_count
    FROM activity a
    LEFT JOIN college c ON c.id = a.host_college_id
    LEFT JOIN participation p ON p.activity_id = a.id
      AND p.assignment_status = 'ASSIGNED'
      AND (
        ${isVpsas}
        OR p.user_id = ${identity.id}::uuid
        OR p.user_id IN (
          SELECT u.id FROM app_user u
          WHERE u.college_id = ANY(${deanCollegeIds}::uuid[])
        )
      )
      AND (
        p.user_id <> ${identity.id}::uuid
        OR (p.assignment_status = 'ASSIGNED' AND a.approval_status = 'APPROVED')
      )
    WHERE a.data_classification = 'OPERATIONAL'
      AND (
        ${isVpsas}
        OR (
          'PARTICIPANT' = ANY(${roles}::text[])
          AND EXISTS (
            SELECT 1 FROM participation own_p
            WHERE own_p.activity_id = a.id
              AND own_p.user_id = ${identity.id}::uuid
              AND own_p.assignment_status = 'ASSIGNED'
          )
          AND a.approval_status = 'APPROVED'
        )
        OR (
          'DEAN' = ANY(${roles}::text[])
          AND EXISTS (
            SELECT 1 FROM activity_college ac
            WHERE ac.activity_id = a.id AND ac.college_id = ANY(${deanCollegeIds}::uuid[])
          )
        )
      )
    GROUP BY a.id, c.name
    ORDER BY a.start_date DESC, a.title
    LIMIT 200
  `;

  await db`
    INSERT INTO audit_log (actor_id, action, resource_type, details)
    VALUES (
      ${identity.id},
      'ACTIVITY_LIST_READ',
      'activity',
      ${JSON.stringify({ visibleCount: rows.length, roleCount: roles.length })}::text::jsonb
    )
  `;

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    venue: row.venue,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
    approvalStatus: row.approval_status,
    collegeName: row.college_name,
    participantCount: row.participant_count,
  }));
}
