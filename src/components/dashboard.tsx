import { Brand } from "@/components/brand";
import type { PrimaryRole } from "@/lib/roles";
import { listVisibleActivities } from "@/lib/activities";
import type { AuthenticatedIdentity } from "@/lib/authorization";
import { SignOutButton } from "@/components/sign-out-button";
import { getMonitoringDashboard } from "@/lib/monitoring";
import { MonitoringConsole } from "@/components/monitoring-console";

const roleTitles: Record<PrimaryRole, string> = {
  PARTICIPANT: "Participant workspace",
  DEAN: "Dean monitoring",
  VPSAS: "VPSAS monitoring",
};

export async function Dashboard({
  identity,
  role,
}: {
  identity: AuthenticatedIdentity;
  role: PrimaryRole;
}) {
  if (role === "DEAN" || role === "VPSAS") {
    const data = await getMonitoringDashboard(identity, {});
    return <MonitoringConsole initialData={data} role={role} />;
  }

  const activities = await listVisibleActivities(identity);

  return (
    <main className="page-shell">
      <div className="content-width">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <Brand href="/" />
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-[#64736f] sm:inline">{identity.fullName}</span>
            <SignOutButton />
          </div>
        </header>

        <section className="mt-10">
          <p className="eyebrow">M1 foundation · {role}</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{roleTitles[role]}</h1>
          <p className="muted mt-3 max-w-2xl leading-7">
            This foundation view shows only activity records available to your current server-verified
            role and scope. No location tracking or attendance data is generated in M1.
          </p>
        </section>

        <section aria-labelledby="activity-heading" className="mt-8">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <p className="eyebrow">Authorized records</p>
              <h2 className="mt-1 text-xl font-bold" id="activity-heading">Activities</h2>
            </div>
            <span className="rounded-full bg-[#e4f2ec] px-3 py-1 text-sm font-semibold text-[#245b4e]">
              {activities.length} visible
            </span>
          </div>

          {activities.length === 0 ? (
            <div className="card p-6">
              <h3 className="font-bold">No activities are assigned to this view yet</h3>
              <p className="muted mt-2 text-sm leading-6">
                Records appear when they are assigned to your participant account or authorized
                college scope. Pending setup examples are visible only to VPSAS.
              </p>
            </div>
          ) : (
            <ul className="grid gap-4 md:grid-cols-2">
              {activities.map((activity) => (
                <li className="card p-5" key={activity.id}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="rounded-full bg-[#e4f2ec] px-2.5 py-1 text-xs font-bold text-[#245b4e]">
                      {activity.status}
                    </span>
                    <span className="text-xs font-semibold text-[#64736f]">
                      Approval: {activity.approvalStatus}
                    </span>
                  </div>
                  <h3 className="mt-4 text-lg font-bold">{activity.title}</h3>
                  <p className="muted mt-2 text-sm">
                    {activity.startDate} – {activity.endDate}
                  </p>
                  <p className="muted mt-1 text-sm">{activity.venue ?? "Venue pending"}</p>
                  {role !== "PARTICIPANT" ? (
                    <p className="muted mt-3 text-sm">
                      {activity.collegeName ?? "College association pending"} ·{" "}
                      {activity.participantCount} scoped participant
                      {activity.participantCount === 1 ? "" : "s"}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <footer className="muted mt-10 border-t border-[#dce5e1] pt-5 text-xs leading-5">
          Location freshness and live movement are not available in this milestone. Records are
          displayed in the institution’s local context; timestamps are stored in UTC.
        </footer>
      </div>
    </main>
  );
}
