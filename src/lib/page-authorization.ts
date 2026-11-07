import { redirect } from "next/navigation";
import { AuthorizationError, requireRole, type AuthenticatedIdentity } from "@/lib/authorization";
import type { PrimaryRole } from "@/lib/roles";

export async function requireRoleForPage(role: PrimaryRole): Promise<AuthenticatedIdentity> {
  try {
    return await requireRole(role);
  } catch (error) {
    if (error instanceof AuthorizationError && error.status === 401) {
      redirect("/login");
    }
    if (error instanceof AuthorizationError && error.status === 403) {
      redirect("/");
    }
    throw error;
  }
}
