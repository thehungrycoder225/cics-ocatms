import { z } from "zod";
import type { NextRequest } from "next/server";
import {
  apiErrorResponse,
  assertSameOrigin,
  privateJson,
  readJsonBody,
  RequestValidationError,
} from "@/lib/api";
import { getAuthenticatedIdentity } from "@/lib/authorization";
import { getDb } from "@/lib/db";
import { canMonitorParticipant, getMonitoringAccess } from "@/lib/monitoring-access";

export const dynamic = "force-dynamic";

const reviewSchema = z.object({
  decision: z.enum(["VERIFIED", "FLAGGED_FOR_REVIEW"]),
  note: z.string().trim().min(3).max(2000),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const identity = await getAuthenticatedIdentity();
    if (!identity) return privateJson({ error: "Authentication is required." }, 401);
    const access = getMonitoringAccess(identity);
    if (!access.isVpsas && access.deanCollegeIds.length === 0) {
      return privateJson({ error: "Milestone review requires a Dean or VPSAS role." }, 403);
    }

    const { id } = await context.params;
    if (!z.string().uuid().safeParse(id).success) {
      throw new RequestValidationError("Check-in ID must be a UUID.");
    }
    const parsed = reviewSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) {
      throw new RequestValidationError(parsed.error.issues[0]?.message ?? "Review details are invalid.");
    }

    const result = await getDb().begin(async (transaction) => {
      const [checkIn] = await transaction<{
        id: string;
        travel_session_id: string;
        kind: string;
        status: string;
        activity_id: string;
        participant_id: string;
        participant_college_id: string | null;
        activity_college_ids: string[];
      }[]>`
        SELECT
          ci.id,
          ci.travel_session_id,
          ci.kind::text AS kind,
          ci.validation_status::text AS status,
          a.id AS activity_id,
          p.user_id AS participant_id,
          participant.college_id AS participant_college_id,
          ARRAY(
            SELECT ac.college_id FROM activity_college ac WHERE ac.activity_id = a.id
          ) AS activity_college_ids
        FROM check_in ci
        JOIN travel_session ts ON ts.id = ci.travel_session_id
        JOIN itinerary_stop s ON s.id = ts.itinerary_stop_id
        JOIN activity a ON a.id = s.activity_id
        JOIN participation p ON p.id = ts.participation_id
        JOIN app_user participant ON participant.id = p.user_id
        WHERE ci.id = ${id}::uuid
        FOR UPDATE OF ci, ts
      `;
      if (
        !checkIn ||
        !canMonitorParticipant(
          identity,
          checkIn.participant_id,
          checkIn.participant_college_id,
          checkIn.activity_college_ids,
        )
      ) return null;

      const [review] = await transaction<{ id: string; reviewed_at: Date }[]>`
        INSERT INTO check_in_review (check_in_id, reviewer_id, decision, note)
        VALUES (
          ${id}::uuid,
          ${identity.id}::uuid,
          ${parsed.data.decision},
          ${parsed.data.note}
        )
        RETURNING id, reviewed_at
      `;
      await transaction`
        UPDATE check_in
        SET validation_status = ${parsed.data.decision}::validation_status
        WHERE id = ${id}::uuid
      `;
      if (parsed.data.decision === "VERIFIED") {
        const nextSessionStatus = checkIn.kind === "ARRIVAL" ? "CHECKED_IN" : "CHECKED_OUT";
        const expectedStatus = checkIn.kind === "ARRIVAL" ? "ARRIVAL_SUBMITTED" : "CHECKOUT_SUBMITTED";
        await transaction`
          UPDATE travel_session
          SET status = ${nextSessionStatus}::travel_session_status
          WHERE id = ${checkIn.travel_session_id}::uuid
            AND status = ${expectedStatus}::travel_session_status
        `;
      }
      await transaction`
        INSERT INTO audit_log (actor_id, action, resource_type, resource_id, details)
        VALUES (
          ${identity.id}::uuid,
          'MILESTONE_REVIEWED',
          'check_in',
          ${id},
          ${JSON.stringify({
            reviewId: review.id,
            decision: parsed.data.decision,
            kind: checkIn.kind,
            activityId: checkIn.activity_id,
            note: parsed.data.note,
          })}::text::jsonb
        )
      `;
      return {
        reviewId: review.id,
        checkInId: id,
        decision: parsed.data.decision,
        reviewedAt: review.reviewed_at.toISOString(),
      };
    });

    if (!result) return privateJson({ error: "Check-in was not found in your authorized scope." }, 404);
    return privateJson(result, 201);
  } catch (error) {
    const response = apiErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
