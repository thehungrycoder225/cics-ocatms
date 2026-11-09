import { Brand } from "@/components/brand";
import { requireRoleForPage } from "@/lib/page-authorization";
import { listParticipantActivities } from "@/lib/participant-journey";
import { SignOutButton } from "@/components/sign-out-button";
import { ParticipantDashboard } from "@/components/participant-dashboard";

export default async function ParticipantPage() {
  const identity = await requireRoleForPage("PARTICIPANT");
  const activities = await listParticipantActivities(identity.id);

  return (
    <main className="page-shell">
      <div className="content-width">
        <header className="card flex flex-wrap items-center justify-between gap-4 p-4 sm:px-6">
          <Brand href="/" />
          <div className="flex items-center gap-3">
            <span className="muted hidden text-sm sm:inline">{identity.fullName}</span>
            <SignOutButton />
          </div>
        </header>
        <ParticipantDashboard activities={activities} />
      </div>
    </main>
  );
}
