import { Dashboard } from "@/components/dashboard";
import { requireRoleForPage } from "@/lib/page-authorization";

export default async function VpsasPage() {
  const identity = await requireRoleForPage("VPSAS");
  return <Dashboard identity={identity} role="VPSAS" />;
}
