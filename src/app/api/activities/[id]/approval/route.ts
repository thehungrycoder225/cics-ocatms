import { z } from "zod";
import { NextRequest } from "next/server";
import { apiErrorResponse, assertSameOrigin, privateJson, readJsonBody } from "@/lib/api";
import {
  ActivityConflictError,
  ActivityNotFoundError,
  requireActivityPermission,
} from "@/lib/activity-management";
import { activityApprovalSchema } from "@/lib/activity-validation";
import { getAuthenticatedIdentity } from "@/lib/authorization";
import { getDb } from "@/lib/db";

const idSchema = z.string().uuid();

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const identity = await getAuthenticatedIdentity();
    if (!identity) {
      return privateJson({ error: "Authentication is required." }, 401);
    }

    const { id } = await context.params;
    if (!idSchema.safeParse(id).success) {
      return privateJson({ error: "Activity ID must be a UUID." }, 400);
    }
    const parsed = activityApprovalSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) {
      return privateJson({ error: "Approval decision is invalid.", issues: parsed.error.issues }, 400);
    }

    const db = getDb();
    await db.begin(async (transaction) => {
      const [activity] = await transaction<
        { id: string; approval_status: string }[]
      >`
        SELECT id, approval_status
        FROM activity
        WHERE id = ${id}::uuid
        FOR UPDATE
      `;
      if (!activity) {
        throw new ActivityNotFoundError();
      }
      if (activity.approval_status !== "PENDING") {
        throw new ActivityConflictError("Only pending activities can receive an approval decision.");
      }

      const associations = await transaction<{ college_id: string }[]>`
        SELECT college_id FROM activity_college WHERE activity_id = ${id}::uuid
      `;
      const scopes = associations.map((association) => association.college_id);
      await requireActivityPermission(transaction, identity, "ACTIVITY_APPROVE", id, scopes);

      await transaction`
        UPDATE activity
        SET approval_status = ${parsed.data.decision}::approval_status,
            updated_at = now()
        WHERE id = ${id}::uuid
      `;
      await transaction`
        INSERT INTO audit_log (actor_id, action, resource_type, resource_id, details)
        VALUES (
          ${identity.id},
          ${parsed.data.decision === "APPROVED" ? "ACTIVITY_APPROVED" : "ACTIVITY_REJECTED"},
          'activity',
          ${id},
          ${JSON.stringify({ reason: parsed.data.reason ?? null })}::text::jsonb
        )
      `;
    });

    return privateJson({ activityId: id, approvalStatus: parsed.data.decision });
  } catch (error) {
    const response = apiErrorResponse(error);
    if (response) {
      return response;
    }
    throw error;
  }
}
