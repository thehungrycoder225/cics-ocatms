import Link from "next/link";
import { Brand } from "@/components/brand";
import { notFound } from "next/navigation";
import { requireRoleForPage } from "@/lib/page-authorization";
import { getParticipantActivity } from "@/lib/participant-journey";
import { ParticipantTravelTimeline } from "@/components/participant-travel-timeline";

export const dynamic = "force-dynamic";

export default async function ParticipantActivityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const identity = await requireRoleForPage("PARTICIPANT");
  const { id } = await params;
  const activity = await getParticipantActivity(identity.id, id);
  if (!activity) notFound();

  return (
    <main className="page-shell">
      <div className="content-width">
        <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <Brand href="/participant" />
          <Link className="inline-flex min-h-11 items-center text-sm font-semibold text-[#245b4e] underline" href="/participant">
            Back to my activities
          </Link>
        </header>
        <section className="mt-6">
          <p className="eyebrow">
            Itinerary · {activity.approvalStatus === "APPROVED" ? "Approved" : `Approval: ${activity.approvalStatus.replaceAll("_", " ").toLowerCase()}`}
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
          <ParticipantTravelTimeline stops={activity.stops} />
        )}
      </div>
    </main>
  );
}
