import type { NextRequest } from "next/server";
import { activityCreateSchema } from "@/lib/activity-validation";
import { listVisibleActivities } from "@/lib/activities";
import {
  apiErrorResponse,
  assertSameOrigin,
  privateJson,
  readJsonBody,
} from "@/lib/api";
import { requireActivityPermission } from "@/lib/activity-management";
import { AuthorizationError, getAuthenticatedIdentity } from "@/lib/authorization";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const identity = await getAuthenticatedIdentity();
    if (!identity) {
      return privateJson({ error: "Authentication is required." }, 401);
    }

    return privateJson({ activities: await listVisibleActivities(identity) });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return privateJson({ error: error.message }, error.status);
    }
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const identity = await getAuthenticatedIdentity();
    if (!identity) {
      return privateJson({ error: "Authentication is required." }, 401);
    }

    const parsed = activityCreateSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) {
      return privateJson({ error: "Activity details are invalid.", issues: parsed.error.issues }, 400);
    }

    const db = getDb();
    const activityId = await db.begin(async (transaction) => {
      await requireActivityPermission(
        transaction,
        identity,
        "ACTIVITY_EDIT",
        null,
        parsed.data.collegeIds,
      );

      const today = new Date().toISOString().slice(0, 10);
      const status = parsed.data.startDate > today
        ? "UPCOMING"
        : parsed.data.endDate < today
          ? "COMPLETED"
          : "ONGOING";
      const [activity] = await transaction<{ id: string }[]>`
        INSERT INTO activity (
          title, organizer, venue, start_date, end_date, status, approval_status,
          host_college_id, faculty_in_charge_label, created_by
        )
        VALUES (
          ${parsed.data.title},
          ${parsed.data.organizer ?? null},
          ${parsed.data.venue ?? null},
          ${parsed.data.startDate}::date,
          ${parsed.data.endDate}::date,
          ${status}::activity_status,
          'PENDING',
          ${parsed.data.hostCollegeId}::uuid,
          ${parsed.data.facultyInChargeLabel ?? null},
          ${identity.id}
        )
        RETURNING id
      `;
      for (const collegeId of parsed.data.collegeIds) {
        await transaction`
          INSERT INTO activity_college (activity_id, college_id)
          VALUES (${activity.id}::uuid, ${collegeId}::uuid)
        `;
      }
      await transaction`
        INSERT INTO audit_log (actor_id, action, resource_type, resource_id, details)
        VALUES (
          ${identity.id},
          'ACTIVITY_CREATED',
          'activity',
          ${activity.id},
          ${JSON.stringify({ collegeIds: parsed.data.collegeIds })}::text::jsonb
        )
      `;
      return activity.id;
    });

    return privateJson({ activityId, approvalStatus: "PENDING" }, 201);
  } catch (error) {
    const response = apiErrorResponse(error);
    if (response) {
      return response;
    }
    throw error;
  }
}
