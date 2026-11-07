import Link from "next/link";
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
          <Link className="brand text-lg no-underline" href="/participant">
            <span aria-hidden="true" className="brand-mark">OC</span>
            <span>MarSU OCATMS</span>
          </Link>
          <Link className="inline-flex min-h-11 items-center text-sm font-semibold text-[#245b4e] underline" href={`/participant/activities/${stop.activityId}`}>
            Back to activity
          </Link>
        </header>
        <section className="mt-6">
          <p className="eyebrow break-words">{stop.activityTitle} · Day {stop.day} · Stop {stop.sequence}</p>
          <h1 className="mt-2 break-words text-3xl font-bold tracking-tight">{stop.destination}</h1>
          {stop.departureLocation ? <p className="muted mt-2 text-sm">From: {stop.departureLocation}</p> : null}
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
