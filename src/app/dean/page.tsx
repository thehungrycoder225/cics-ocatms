import { Dashboard } from "@/components/dashboard";
import { requireRoleForPage } from "@/lib/page-authorization";

export default async function DeanPage() {
  const identity = await requireRoleForPage("DEAN");
  return <Dashboard identity={identity} role="DEAN" />;
}
