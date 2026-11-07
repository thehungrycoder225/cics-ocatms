import { ActivityMonitoringPage } from "@/components/activity-monitoring-page";
import { requireRoleForPage } from "@/lib/page-authorization";

export const dynamic = "force-dynamic";

export default async function VpsasActivityMonitoringPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const identity = await requireRoleForPage("VPSAS");
  const { id } = await params;
  return <ActivityMonitoringPage identity={identity} role="VPSAS" activityId={id} />;
}
