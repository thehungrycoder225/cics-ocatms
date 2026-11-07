import { z } from "zod";
import { apiErrorResponse, privateJson, RequestValidationError } from "@/lib/api";
import { getAuthenticatedIdentity } from "@/lib/authorization";
import { getDb } from "@/lib/db";
import {
  createPrivateEvidenceUrl,
  EvidenceStorageNotConfiguredError,
} from "@/lib/evidence-storage";
import { canMonitorParticipant, getMonitoringAccess } from "@/lib/monitoring-access";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const identity = await getAuthenticatedIdentity();
    if (!identity) return privateJson({ error: "Authentication is required." }, 401);
    const access = getMonitoringAccess(identity);
    if (!access.isVpsas && !access.isParticipant && access.deanCollegeIds.length === 0) {
      return privateJson({ error: "Evidence access requires an authorized OCATMS role." }, 403);
    }

    const { id } = await context.params;
    if (!z.string().uuid().safeParse(id).success) {
      throw new RequestValidationError("Evidence ID must be a UUID.");
    }
    const [evidence] = await getDb()<{
      id: string;
      original_object_key: string;
      stamped_object_key: string;
      kind: string;
      activity_id: string;
      participant_id: string;
      participant_college_id: string | null;
      activity_college_ids: string[];
    }[]>`
      SELECT
        e.id,
        e.original_object_key,
        e.stamped_object_key,
        ci.kind::text AS kind,
        a.id AS activity_id,
        p.user_id AS participant_id,
        participant.college_id AS participant_college_id,
        ARRAY(
          SELECT ac.college_id FROM activity_college ac WHERE ac.activity_id = a.id
        ) AS activity_college_ids
      FROM evidence e
      JOIN check_in ci ON ci.id = e.check_in_id
      JOIN travel_session ts ON ts.id = ci.travel_session_id
      JOIN participation p ON p.id = ts.participation_id
      JOIN app_user participant ON participant.id = p.user_id
      JOIN itinerary_stop s ON s.id = ts.itinerary_stop_id
      JOIN activity a ON a.id = s.activity_id
      WHERE e.id = ${id}::uuid
      LIMIT 1
    `;
    if (
      !evidence ||
      !canMonitorParticipant(
        identity,
        evidence.participant_id,
        evidence.participant_college_id,
        evidence.activity_college_ids,
      )
    ) return privateJson({ error: "Evidence was not found in your authorized scope." }, 404);

    const [originalUrl, stampedUrl] = await Promise.all([
      createPrivateEvidenceUrl(evidence.original_object_key),
      createPrivateEvidenceUrl(evidence.stamped_object_key),
    ]);
    await getDb()`
      INSERT INTO audit_log (actor_id, action, resource_type, resource_id, details)
      VALUES (
        ${identity.id}::uuid,
        'EVIDENCE_SIGNED_URL_ISSUED',
        'evidence',
        ${id},
        ${JSON.stringify({ activityId: evidence.activity_id, kind: evidence.kind })}::text::jsonb
      )
    `;
    return privateJson({
      evidenceId: evidence.id,
      kind: evidence.kind,
      originalUrl,
      stampedUrl,
      expiresInSeconds: 60,
    });
  } catch (error) {
    if (error instanceof EvidenceStorageNotConfiguredError) {
      return privateJson({ error: error.message }, 503);
    }
    const response = apiErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
