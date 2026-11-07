import Link from "next/link";
import { requireRoleForPage } from "@/lib/page-authorization";
import { listParticipantActivities } from "@/lib/participant-journey";
import { SignOutButton } from "@/components/sign-out-button";

export default async function ParticipantPage() {
  const identity = await requireRoleForPage("PARTICIPANT");
  const activities = await listParticipantActivities(identity.id);

  return (
    <main className="page-shell">
      <div className="content-width">
        <header className="card flex flex-wrap items-center justify-between gap-4 p-4 sm:px-6">
          <Link className="brand text-lg no-underline" href="/">
            <span aria-hidden="true" className="brand-mark">OC</span>
            <span>MarSU OCATMS</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="muted hidden text-sm sm:inline">{identity.fullName}</span>
            <SignOutButton />
          </div>
        </header>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <section className="card bento-feature min-w-0 p-6 sm:p-8 md:col-span-2">
            <p className="eyebrow">Participant workspace</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">My activities</h1>
            <p className="muted mt-3 max-w-2xl leading-7">
              Review your approved itineraries and submit travel milestones when you choose.
            </p>
          </section>
          <aside className="card min-w-0 p-6">
            <p className="eyebrow">Location privacy</p>
            <p className="muted mt-3 text-sm leading-6">
              OCATMS does not continuously track location or infer safety from a reported GPS fix.
            </p>
          </aside>
          <section aria-labelledby="participant-activities-heading" className="min-w-0 md:col-span-3">
            <h2 className="mb-3 text-xl font-bold" id="participant-activities-heading">Activities</h2>
            {activities.length === 0 ? (
              <div className="card p-6">
                <h3 className="font-bold">No activities available</h3>
                <p className="muted mt-2 text-sm leading-6">
                  Approved activities assigned to you appear here. Existing trip records remain
                  available if an activity is pending reapproval.
                </p>
              </div>
            ) : (
              <ul aria-label="My activities" className="grid gap-4 md:grid-cols-2">
                {activities.map((activity) => (
                  <li className="card flex min-w-0 flex-col p-5 sm:p-6" key={activity.id}>
                    <p className="eyebrow">{activity.startDate} – {activity.endDate}</p>
                    <h3 className="mt-2 break-words text-xl font-bold">{activity.title}</h3>
                    <p className="muted mt-1 text-sm">{activity.venue ?? "Venue pending"}</p>
                    <p className="muted mt-3 text-sm">
                      {activity.approvalStatus === "APPROVED"
                        ? `${activity.stops.length} approved stop${activity.stops.length === 1 ? "" : "s"}`
                        : "Approval pending · existing trip records remain available"}
                    </p>
                    <Link
                      className="mt-4 inline-flex min-h-11 items-center self-start text-sm font-semibold text-[#245b4e] underline"
                      href={`/participant/activities/${activity.id}`}
                    >
                      View itinerary
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
