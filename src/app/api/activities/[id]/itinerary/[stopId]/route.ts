import { z } from "zod";
import type { NextRequest } from "next/server";
import {
  apiErrorResponse,
  assertSameOrigin,
  privateJson,
  readJsonBody,
  RequestValidationError,
} from "@/lib/api";
import { ActivityConflictError, ActivityNotFoundError, requireActivityPermission, requireItineraryLegDetailsMigration } from "@/lib/activity-management";
import { getAuthenticatedIdentity } from "@/lib/authorization";
import { getDb } from "@/lib/db";
import { hasRequiredDepartureLocation, itineraryStopUpdateSchema } from "@/lib/itinerary-validation";

export const dynamic = "force-dynamic";
const uuid = z.string().uuid();

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; stopId: string }> },
) {
  try {
    assertSameOrigin(request);
    const identity = await getAuthenticatedIdentity();
    if (!identity) return privateJson({ error: "Authentication is required." }, 401);
    const { id, stopId } = await context.params;
    if (!uuid.safeParse(id).success || !uuid.safeParse(stopId).success) {
      throw new RequestValidationError("Activity and itinerary stop IDs must be UUIDs.");
    }
    const parsed = itineraryStopUpdateSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) {
      return privateJson({ error: "Itinerary stop update is invalid.", issues: parsed.error.issues }, 400);
    }

    await getDb().begin(async (transaction) => {
      const [activity] = await transaction<{ id: string; start_date: string; end_date: string }[]>`
        SELECT id, start_date::text, end_date::text
        FROM activity
        WHERE id = ${id}::uuid
        FOR UPDATE
      `;
      if (!activity) throw new ActivityNotFoundError();
      const [stop] = await transaction<
        {
          id: string;
          activity_id: string;
          itinerary_day: number;
          stop_sequence: number;
          destination: string;
          departure_location: string | null;
          latitude: number;
          longitude: number;
          geofence_radius_m: number;
          planned_departure: Date | null;
          planned_arrival: Date | null;
          travel_mode: string;
          is_active: boolean;
        }[]
      >`
        SELECT
          id, activity_id, itinerary_day, stop_sequence, destination,
          to_jsonb(itinerary_stop)->>'departure_location' AS departure_location,
          ST_Y(location::geometry) AS latitude,
          ST_X(location::geometry) AS longitude,
          geofence_radius_m, planned_departure, planned_arrival, travel_mode, is_active
        FROM itinerary_stop
        WHERE id = ${stopId}::uuid AND activity_id = ${id}::uuid
        FOR UPDATE
      `;
      if (!stop) throw new ActivityNotFoundError();

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
      if (parsed.data.departureLocation !== undefined || parsed.data.travelMode === "VAN" || parsed.data.travelMode === "SHIP") {
        await requireItineraryLegDetailsMigration(transaction);
      }
      if (!stop.is_active) throw new ActivityConflictError("This itinerary stop has been deactivated.");
      const [travel] = await transaction<{ id: string }[]>`
        SELECT id FROM travel_session WHERE itinerary_stop_id = ${stopId}::uuid LIMIT 1
      `;
      if (travel) {
        throw new ActivityConflictError("A stop with travel history cannot be changed; preserve it and create a new approved itinerary.");
      }

      const current = {
        day: stop.itinerary_day,
        sequence: stop.stop_sequence,
        destination: stop.destination,
        departureLocation: stop.departure_location,
        latitude: stop.latitude,
        longitude: stop.longitude,
        geofenceRadiusM: stop.geofence_radius_m,
        plannedDeparture: stop.planned_departure?.toISOString() ?? null,
        plannedArrival: stop.planned_arrival?.toISOString() ?? null,
        travelMode: stop.travel_mode,
      };
      const next = { ...current, ...parsed.data };
      if (!hasRequiredDepartureLocation(next.travelMode, next.departureLocation)) {
        throw new RequestValidationError("Departure location is required for van and ship legs.");
      }
      const durationDays =
        Math.floor((Date.parse(`${activity.end_date}T00:00:00Z`) - Date.parse(`${activity.start_date}T00:00:00Z`)) / 86_400_000) + 1;
      if (next.day > durationDays) {
        throw new RequestValidationError("Itinerary day must fall within the activity dates.");
      }
      const [duplicate] = await transaction<{ id: string }[]>`
        SELECT id FROM itinerary_stop
        WHERE activity_id = ${id}::uuid
          AND itinerary_day = ${next.day}
          AND stop_sequence = ${next.sequence}
          AND is_active
          AND id <> ${stopId}::uuid
        LIMIT 1
      `;
      if (duplicate) {
        throw new ActivityConflictError("An active stop already uses this day and sequence.");
      }

      await transaction`
        UPDATE itinerary_stop
        SET itinerary_day = ${next.day},
            stop_sequence = ${next.sequence},
            destination = ${next.destination},
            location = ST_SetSRID(ST_MakePoint(${next.longitude}, ${next.latitude}), 4326)::geography,
            geofence_radius_m = ${next.geofenceRadiusM},
            planned_departure = ${next.plannedDeparture}::timestamptz,
            planned_arrival = ${next.plannedArrival}::timestamptz,
            travel_mode = ${next.travelMode},
            updated_at = now()
        WHERE id = ${stopId}::uuid
      `;
      if (parsed.data.departureLocation !== undefined) {
        await transaction`
          UPDATE itinerary_stop SET departure_location = ${parsed.data.departureLocation}
          WHERE id = ${stopId}::uuid
        `;
      }
      await transaction`
        UPDATE activity SET approval_status = 'PENDING', updated_at = now()
        WHERE id = ${id}::uuid
      `;
      await transaction`
        INSERT INTO itinerary_change (
          activity_id, itinerary_stop_id, actor_id, action, previous_values, new_values
        )
        VALUES (
          ${id}::uuid,
          ${stopId}::uuid,
          ${identity.id}::uuid,
          'STOP_UPDATED',
          ${JSON.stringify(current)}::text::jsonb,
          ${JSON.stringify(next)}::text::jsonb
        )
      `;
      await transaction`
        INSERT INTO audit_log (actor_id, action, resource_type, resource_id, details)
        VALUES (
          ${identity.id}::uuid,
          'ITINERARY_STOP_UPDATED',
          'itinerary_stop',
          ${stopId},
          '{"approvalReset":true}'::jsonb
        )
      `;
    });
    return privateJson({ itineraryStopId: stopId, activityApprovalStatus: "PENDING" });
  } catch (error) {
    const response = apiErrorResponse(error);
    if (response) return response;
    throw error;
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string; stopId: string }> },
) {
  try {
    assertSameOrigin(request);
    const identity = await getAuthenticatedIdentity();
    if (!identity) return privateJson({ error: "Authentication is required." }, 401);
    const { id, stopId } = await context.params;
    if (!uuid.safeParse(id).success || !uuid.safeParse(stopId).success) {
      throw new RequestValidationError("Activity and itinerary stop IDs must be UUIDs.");
    }

    await getDb().begin(async (transaction) => {
      const [activity] = await transaction<{ id: string }[]>`
        SELECT id FROM activity WHERE id = ${id}::uuid FOR UPDATE
      `;
      if (!activity) throw new ActivityNotFoundError();
      const [stop] = await transaction<
        { id: string; activity_id: string; is_active: boolean; destination: string }[]
      >`
        SELECT id, activity_id, is_active, destination
        FROM itinerary_stop
        WHERE id = ${stopId}::uuid AND activity_id = ${id}::uuid
        FOR UPDATE
      `;
      if (!stop) throw new ActivityNotFoundError();

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
      if (!stop.is_active) return;
      const [travel] = await transaction<{ id: string }[]>`
        SELECT id FROM travel_session WHERE itinerary_stop_id = ${stopId}::uuid LIMIT 1
      `;
      if (travel) {
        throw new ActivityConflictError("A stop with travel history cannot be deactivated.");
      }
      await transaction`
        UPDATE itinerary_stop SET is_active = false, updated_at = now()
        WHERE id = ${stopId}::uuid
      `;
      await transaction`
        UPDATE activity SET approval_status = 'PENDING', updated_at = now()
        WHERE id = ${id}::uuid
      `;
      await transaction`
        INSERT INTO itinerary_change (
          activity_id, itinerary_stop_id, actor_id, action, previous_values, new_values
        )
        VALUES (
          ${id}::uuid,
          ${stopId}::uuid,
          ${identity.id}::uuid,
          'STOP_DEACTIVATED',
          ${JSON.stringify({ destination: stop.destination, isActive: true })}::text::jsonb,
          '{"isActive":false}'::jsonb
        )
      `;
      await transaction`
        INSERT INTO audit_log (actor_id, action, resource_type, resource_id, details)
        VALUES (
          ${identity.id}::uuid,
          'ITINERARY_STOP_DEACTIVATED',
          'itinerary_stop',
          ${stopId},
          '{"approvalReset":true}'::jsonb
        )
      `;
    });
    return privateJson({ itineraryStopId: stopId, active: false, activityApprovalStatus: "PENDING" });
  } catch (error) {
    const response = apiErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
