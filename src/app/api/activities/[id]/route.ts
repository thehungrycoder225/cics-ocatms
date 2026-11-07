import { z } from "zod";
import { NextRequest } from "next/server";
import { apiErrorResponse, assertSameOrigin, privateJson, readJsonBody, RequestValidationError } from "@/lib/api";
import {
  ActivityNotFoundError,
  requireActivityPermission,
} from "@/lib/activity-management";
import { activityUpdateSchema } from "@/lib/activity-validation";
import { getAuthenticatedIdentity } from "@/lib/authorization";
import { getDb } from "@/lib/db";

const idSchema = z.string().uuid();

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const identity = await getAuthenticatedIdentity();
    if (!identity) {
      return privateJson({ error: "Authentication is required." }, 401);
    }

    const { id } = await context.params;
    if (!idSchema.safeParse(id).success) {
      throw new RequestValidationError("Activity ID must be a UUID.");
    }
    const parsed = activityUpdateSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) {
      return privateJson({ error: "Activity update is invalid.", issues: parsed.error.issues }, 400);
    }

    const db = getDb();
    const activity = await db.begin(async (transaction) => {
      const [current] = await transaction<
        {
          id: string;
          title: string;
          organizer: string | null;
          venue: string | null;
          start_date: string;
          end_date: string;
          faculty_in_charge_label: string | null;
        }[]
      >`
        SELECT id, title, organizer, venue, start_date::text, end_date::text, faculty_in_charge_label
        FROM activity
        WHERE id = ${id}::uuid
        FOR UPDATE
      `;
      if (!current) {
        throw new ActivityNotFoundError();
      }

      const associations = await transaction<{ college_id: string }[]>`
        SELECT college_id FROM activity_college WHERE activity_id = ${id}::uuid
      `;
      const scopes = associations.map((association) => association.college_id);
      await requireActivityPermission(transaction, identity, "ACTIVITY_EDIT", id, scopes);

      const next = {
        title: parsed.data.title ?? current.title,
        organizer:
          parsed.data.organizer === undefined ? current.organizer : parsed.data.organizer,
        venue: parsed.data.venue === undefined ? current.venue : parsed.data.venue,
        startDate: parsed.data.startDate ?? current.start_date,
        endDate: parsed.data.endDate ?? current.end_date,
        facultyInChargeLabel:
          parsed.data.facultyInChargeLabel === undefined
            ? current.faculty_in_charge_label
            : parsed.data.facultyInChargeLabel,
      };
      if (next.endDate < next.startDate) {
        throw new RequestValidationError("The end date must be on or after the start date.");
      }

      const today = new Date().toISOString().slice(0, 10);
      const status = next.startDate > today ? "UPCOMING" : next.endDate < today ? "COMPLETED" : "ONGOING";
      const [updated] = await transaction<{ id: string }[]>`
        UPDATE activity
        SET title = ${next.title},
            organizer = ${next.organizer},
            venue = ${next.venue},
            start_date = ${next.startDate}::date,
            end_date = ${next.endDate}::date,
            faculty_in_charge_label = ${next.facultyInChargeLabel},
            status = ${status}::activity_status,
            approval_status = 'PENDING',
            updated_at = now()
        WHERE id = ${id}::uuid
        RETURNING id
      `;
      await transaction`
        INSERT INTO audit_log (actor_id, action, resource_type, resource_id, details)
        VALUES (
          ${identity.id},
          'ACTIVITY_UPDATED',
          'activity',
          ${id},
          ${JSON.stringify({ fields: Object.keys(parsed.data) })}::text::jsonb
        )
      `;
      return updated;
    });

    return privateJson({ activityId: activity.id });
  } catch (error) {
    const response = apiErrorResponse(error);
    if (response) {
      return response;
    }
    throw error;
  }
}
