import { notFound } from "next/navigation";
import { z } from "zod";
import type { PrimaryRole } from "@/lib/roles";
import type { AuthenticatedIdentity } from "@/lib/authorization";
import { getMonitoringDashboard } from "@/lib/monitoring";
import { MonitoringConsole } from "@/components/monitoring-console";

export async function ActivityMonitoringPage({
  identity,
  role,
  activityId,
}: {
  identity: AuthenticatedIdentity;
  role: Extract<PrimaryRole, "DEAN" | "VPSAS">;
  activityId: string;
}) {
  if (!z.string().uuid().safeParse(activityId).success) notFound();
  const data = await getMonitoringDashboard(identity, { activityId, includeSynthetic: "true" });
  if (!data.activities.length) notFound();
  return <MonitoringConsole initialData={data} role={role} activityId={activityId} />;
}
