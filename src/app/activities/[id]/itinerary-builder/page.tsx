import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { ItineraryBuilder, type BuilderStop } from "@/components/itinerary-builder";
import { ActivityNotFoundError, requireActivityPermission } from "@/lib/activity-management";
import { AuthorizationError, getAuthenticatedIdentity } from "@/lib/authorization";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ItineraryBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const identity = await getAuthenticatedIdentity();
  if (!identity) redirect("/login");
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();

  const data = await getDb().begin(async (transaction) => {
      const [activity] = await transaction<{ title: string; start_date: string; end_date: string; approval_status: string }[]>`
        SELECT title, start_date::text, end_date::text, approval_status::text
        FROM activity WHERE id = ${id}::uuid
      `;
      if (!activity) throw new ActivityNotFoundError();
      const colleges = await transaction<{ college_id: string }[]>`
        SELECT college_id FROM activity_college WHERE activity_id = ${id}::uuid
      `;
      await requireActivityPermission(transaction, identity, "ACTIVITY_EDIT", id, colleges.map((item) => item.college_id));
      const [migration] = await transaction<{ applied: boolean }[]>`
        SELECT EXISTS (
          SELECT 1 FROM schema_migration WHERE name = '0005_itinerary_leg_details.sql'
        ) AS applied
      `;
      const stops = await transaction<{
        id: string; day: number; sequence: number; destination: string; latitude: number; longitude: number;
        departure_location: string | null;
        geofence_radius_m: number; planned_departure: Date | null; planned_arrival: Date | null;
        travel_mode: BuilderStop["travelMode"]; has_travel: boolean;
      }[]>`
        SELECT s.id, s.itinerary_day AS day, s.stop_sequence AS sequence, s.destination,
          to_jsonb(s)->>'departure_location' AS departure_location,
          ST_Y(s.location::geometry) AS latitude, ST_X(s.location::geometry) AS longitude,
          s.geofence_radius_m, s.planned_departure, s.planned_arrival, s.travel_mode,
          EXISTS (SELECT 1 FROM travel_session t WHERE t.itinerary_stop_id = s.id) AS has_travel
        FROM itinerary_stop s
        WHERE s.activity_id = ${id}::uuid AND s.is_active
        ORDER BY s.itinerary_day, s.stop_sequence
      `;
      await transaction`
        INSERT INTO audit_log (actor_id, action, resource_type, resource_id, details)
        VALUES (${identity.id}, 'ITINERARY_BUILDER_READ', 'activity', ${id}, ${JSON.stringify({ stopCount: stops.length })}::text::jsonb)
      `;
      return {
        activity,
        legDetailsAvailable: migration.applied,
        stops: stops.map((stop) => ({
          id: stop.id, day: stop.day, sequence: stop.sequence, destination: stop.destination,
          departureLocation: stop.departure_location,
          latitude: stop.latitude, longitude: stop.longitude, geofenceRadiusM: stop.geofence_radius_m,
          plannedDeparture: stop.planned_departure?.toISOString() ?? null,
          plannedArrival: stop.planned_arrival?.toISOString() ?? null,
          travelMode: stop.travel_mode, hasTravel: stop.has_travel,
        })),
      };
    }).catch((error: unknown) => {
    if (error instanceof AuthorizationError || error instanceof ActivityNotFoundError) notFound();
    throw error;
  });
  return (
    <main className="page-shell">
      <div className="content-width">
        <Link className="font-semibold underline" href="/">Back to workspace</Link>
        <h1 className="mt-6 text-3xl font-bold">Itinerary builder</h1>
        <p className="muted mt-2">{data.activity.title} · {data.activity.start_date} – {data.activity.end_date}</p>
        <p className="muted mt-2 text-sm">Approval: {data.activity.approval_status}. Every itinerary change returns the activity to pending approval.</p>
        <ItineraryBuilder activityId={id} legDetailsAvailable={data.legDetailsAvailable} stops={data.stops} />
      </div>
    </main>
  );
}
