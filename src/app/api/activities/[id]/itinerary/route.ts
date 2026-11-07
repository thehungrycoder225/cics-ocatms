import { z } from "zod";
import type { NextRequest } from "next/server";
import {
  apiErrorResponse,
  assertSameOrigin,
  privateJson,
  readJsonBody,
  RequestValidationError,
} from "@/lib/api";
import {
  ActivityConflictError,
  ActivityNotFoundError,
  requireActivityPermission,
  requireItineraryLegDetailsMigration,
} from "@/lib/activity-management";
import { getAuthenticatedIdentity } from "@/lib/authorization";
import { getDb } from "@/lib/db";
import { itineraryStopCreateSchema } from "@/lib/itinerary-validation";

export const dynamic = "force-dynamic";
const activityIdSchema = z.string().uuid();

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const identity = await getAuthenticatedIdentity();
    if (!identity) return privateJson({ error: "Authentication is required." }, 401);
    const { id } = await context.params;
    if (!activityIdSchema.safeParse(id).success) {
      throw new RequestValidationError("Activity ID must be a UUID.");
    }

    const parsed = itineraryStopCreateSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) {
      return privateJson({ error: "Itinerary stop is invalid.", issues: parsed.error.issues }, 400);
    }

    const db = getDb();
    const created = await db.begin(async (transaction) => {
      const [activity] = await transaction<{ id: string; start_date: string; end_date: string }[]>`
        SELECT id, start_date::text, end_date::text
        FROM activity
        WHERE id = ${id}::uuid
        FOR UPDATE
      `;
      if (!activity) throw new ActivityNotFoundError();

      const associations = await transaction<{ college_id: string }[]>`
        SELECT college_id FROM activity_college WHERE activity_id = ${id}::uuid
      `;
      await requireActivityPermission(
        transaction,
        identity,
        "ACTIVITY_EDIT",
        id,
        associations.map((association) => association.college_id),
      );
      if (parsed.data.departureLocation != null || ["VAN", "SHIP"].includes(parsed.data.travelMode)) {
        await requireItineraryLegDetailsMigration(transaction);
      }
      const activityDays =
        Math.floor((Date.parse(`${activity.end_date}T00:00:00Z`) - Date.parse(`${activity.start_date}T00:00:00Z`)) / 86_400_000) + 1;
      if (parsed.data.day > activityDays) {
        throw new RequestValidationError("Itinerary day must fall within the activity dates.");
      }
      const [duplicate] = await transaction<{ id: string }[]>`
        SELECT id FROM itinerary_stop
        WHERE activity_id = ${id}::uuid
          AND itinerary_day = ${parsed.data.day}
          AND stop_sequence = ${parsed.data.sequence}
          AND is_active
        LIMIT 1
      `;
      if (duplicate) {
        throw new ActivityConflictError("An active stop already uses this day and sequence.");
      }

      const [stop] = await transaction<{ id: string }[]>`
        INSERT INTO itinerary_stop (
          activity_id, itinerary_day, stop_sequence, destination, location,
          geofence_radius_m, planned_departure, planned_arrival, travel_mode
        )
        VALUES (
          ${id}::uuid,
          ${parsed.data.day},
          ${parsed.data.sequence},
          ${parsed.data.destination},
          ST_SetSRID(ST_MakePoint(${parsed.data.longitude}, ${parsed.data.latitude}), 4326)::geography,
          ${parsed.data.geofenceRadiusM},
          ${parsed.data.plannedDeparture ?? null}::timestamptz,
          ${parsed.data.plannedArrival ?? null}::timestamptz,
          ${parsed.data.travelMode}
        )
        RETURNING id
      `;
      if (parsed.data.departureLocation != null) {
        await transaction`
          UPDATE itinerary_stop SET departure_location = ${parsed.data.departureLocation}
          WHERE id = ${stop.id}::uuid
        `;
      }
      const newValues = {
        ...parsed.data,
      };
      await transaction`
        UPDATE activity
        SET approval_status = 'PENDING', updated_at = now()
        WHERE id = ${id}::uuid
      `;
      await transaction`
        INSERT INTO itinerary_change (
          activity_id, itinerary_stop_id, actor_id, action, new_values
        )
        VALUES (
          ${id}::uuid,
          ${stop.id}::uuid,
          ${identity.id}::uuid,
          'STOP_CREATED',
          ${JSON.stringify(newValues)}::text::jsonb
        )
      `;
      await transaction`
        INSERT INTO audit_log (actor_id, action, resource_type, resource_id, details)
        VALUES (
          ${identity.id}::uuid,
          'ITINERARY_STOP_CREATED',
          'itinerary_stop',
          ${stop.id},
          ${JSON.stringify({ activityId: id, approvalReset: true })}::text::jsonb
        )
      `;
      return stop;
    });

    return privateJson({ itineraryStopId: created.id, activityApprovalStatus: "PENDING" }, 201);
  } catch (error) {
    const response = apiErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
