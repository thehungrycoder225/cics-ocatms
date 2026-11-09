import Link from "next/link";
import { Brand } from "@/components/brand";
import { notFound } from "next/navigation";
import { TripControls } from "@/components/trip-controls";
import { requireRoleForPage } from "@/lib/page-authorization";
import { getParticipantStop } from "@/lib/participant-journey";

export const dynamic = "force-dynamic";

export default async function ParticipantTripPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const identity = await requireRoleForPage("PARTICIPANT");
  const { id } = await params;
  const stop = await getParticipantStop(identity.id, id);
  if (!stop) notFound();

  return (
    <main className="page-shell">
      <div className="content-width">
        <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <Brand href="/participant" />
          <Link className="inline-flex min-h-11 items-center text-sm font-semibold text-[#245b4e] underline" href={`/participant/activities/${stop.activityId}`}>
            Back to activity
          </Link>
        </header>
        <section className="trip-leg-header mt-6">
          <p className="trip-leg-context">{stop.activityTitle} · Day {stop.day} · Stop {stop.sequence}</p>
          <h1 className="mt-2 break-words text-2xl font-bold tracking-tight sm:text-3xl">{stop.destination}</h1>
          <p className="muted mt-2 text-sm">From: {stop.departureLocation ?? "Unavailable"} · {stop.travelMode.replaceAll("_", " ").toLowerCase()}</p>
          {stop.plannedArrival ? (
            <p className="muted mt-2 text-sm">
              Planned arrival: {new Date(stop.plannedArrival).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}
            </p>
          ) : null}
          <p className="muted mt-2 text-sm">Approved geofence radius: {stop.geofenceRadiusM} m</p>
        </section>
        <TripControls initialStop={stop} />
      </div>
    </main>
  );
}
