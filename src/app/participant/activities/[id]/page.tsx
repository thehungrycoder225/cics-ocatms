import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRoleForPage } from "@/lib/page-authorization";
import { getParticipantActivity } from "@/lib/participant-journey";

export const dynamic = "force-dynamic";

function statusLabel(status: string) {
  if (status === "NOT_STARTED") return "Not started";
  return status.replaceAll("_", " ").toLowerCase();
}

export default async function ParticipantActivityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const identity = await requireRoleForPage("PARTICIPANT");
  const { id } = await params;
  const activity = await getParticipantActivity(identity.id, id);
  if (!activity) notFound();

  const dayGroups = Map.groupBy(activity.stops, (stop) => stop.day);

  return (
    <main className="page-shell">
      <div className="content-width">
        <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <Link className="brand text-lg no-underline" href="/participant">
            <span aria-hidden="true" className="brand-mark">OC</span>
            <span>MarSU OCATMS</span>
          </Link>
          <Link className="inline-flex min-h-11 items-center text-sm font-semibold text-[#245b4e] underline" href="/participant">
            Back to my activities
          </Link>
        </header>
        <section className="mt-6">
          <p className="eyebrow">
            {activity.approvalStatus === "APPROVED" ? "Approved activity itinerary" : "Existing trip records"}
          </p>
          <h1 className="mt-2 break-words text-3xl font-bold tracking-tight">{activity.title}</h1>
          <p className="muted mt-2">{activity.startDate} – {activity.endDate} · {activity.venue ?? "Venue pending"}</p>
          <p className="muted mt-3 max-w-2xl text-sm leading-6">
            {activity.approvalStatus === "APPROVED"
              ? "Only approved stops are shown. Location is reported at participant-initiated milestones, not continuously."
              : "This activity is pending reapproval. Existing trip records remain available, but new travel cannot begin until approval is restored."}
          </p>
        </section>

        {activity.stops.length === 0 ? (
          <section className="card mt-7 p-6">
            <h2 className="font-bold">No currently approved itinerary stops are available</h2>
            <p className="muted mt-2 text-sm leading-6">
              An authorized activity editor must supply the approved daily itinerary before
              travel can begin.
            </p>
          </section>
        ) : (
          <div className="mt-7 space-y-7">
            {Array.from(dayGroups.entries()).map(([day, stops]) => (
              <section key={day}>
                <h2 className="mb-3 text-xl font-bold">Day {day}</h2>
                <ol className="space-y-3">
                  {stops.map((stop) => (
                    <li className="card min-w-0 p-5 sm:p-6" key={stop.id}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="eyebrow">Stop {stop.sequence}</p>
                          <h3 className="mt-1 break-words text-lg font-bold">{stop.destination}</h3>
                          {stop.departureLocation ? <p className="muted mt-1 text-sm">From: {stop.departureLocation}</p> : null}
                          <p className="muted mt-1 text-sm">
                            {stop.plannedArrival
                              ? `Planned arrival ${new Date(stop.plannedArrival).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}`
                              : "No scheduled arrival"} · {stop.travelMode.toLowerCase()}
                          </p>
                        </div>
                        <span className="rounded-full bg-[#e4f2ec] px-3 py-1 text-xs font-bold">
                          {statusLabel(stop.status)}
                        </span>
                      </div>
                      {stop.sessionId && stop.etaAt ? (
                        <p className="muted mt-3 text-xs">
                          Last route estimate: {new Date(stop.etaAt).toLocaleString("en-PH", { timeZone: "Asia/Manila" })};
                          not a live location.
                        </p>
                      ) : null}
                      {stop.arrivalAt ? (
                        <p className="muted mt-3 text-xs leading-5">
                          Arrival received {new Date(stop.arrivalAt).toLocaleString("en-PH", { timeZone: "Asia/Manila" })} ·
                          {" "}{stop.arrivalReviewStatus?.replaceAll("_", " ")}
                          {stop.arrivalReviewFlags.length ? ` · flags: ${stop.arrivalReviewFlags.join(", ")}` : ""}
                        </p>
                      ) : null}
                      {stop.checkoutAt ? (
                        <p className="muted mt-2 text-xs leading-5">
                          Check-out received {new Date(stop.checkoutAt).toLocaleString("en-PH", { timeZone: "Asia/Manila" })} ·
                          {" "}{stop.checkoutReviewStatus?.replaceAll("_", " ")}
                          {stop.checkoutReviewFlags.length ? ` · flags: ${stop.checkoutReviewFlags.join(", ")}` : ""}
                          {stop.dwellSeconds !== null
                            ? ` · dwell ${Math.floor(stop.dwellSeconds / 60)} min${stop.dwellProvisional ? " (provisional)" : ""}`
                            : ""}
                        </p>
                      ) : null}
                      <Link
                        className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-[#245b4e] underline"
                        href={`/participant/trips/${stop.id}`}
                      >
                        Open trip milestones
                      </Link>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
