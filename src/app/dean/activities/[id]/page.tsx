import { ActivityMonitoringPage } from "@/components/activity-monitoring-page";
import { requireRoleForPage } from "@/lib/page-authorization";

export const dynamic = "force-dynamic";

export default async function DeanActivityMonitoringPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const identity = await requireRoleForPage("DEAN");
  const { id } = await params;
  return <ActivityMonitoringPage identity={identity} role="DEAN" activityId={id} />;
}
