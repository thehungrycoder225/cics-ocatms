import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/db";
import type { PrimaryRole, RoleAssignment } from "@/lib/roles";

export class AuthorizationError extends Error {
  constructor(
    message: string,
    readonly status: 401 | 403,
  ) {
    super(message);
    this.name = "AuthorizationError";
  }
}

export interface AuthenticatedIdentity {
  id: string;
  fullName: string;
  email: string | null;
  collegeId: string | null;
  assignments: RoleAssignment[];
}

export async function getAuthenticatedIdentity(): Promise<AuthenticatedIdentity | null> {
  const session = await getServerSession(authOptions);
  const id = session?.user?.id;
  if (!id) {
    return null;
  }

  const db = getDb();
  const [user] = await db<
    { id: string; full_name: string; email: string | null; college_id: string | null }[]
  >`
    SELECT id, full_name, email, college_id
    FROM app_user
    WHERE id = ${id} AND status = 'ACTIVE'
      AND (account_expires_at IS NULL OR account_expires_at > now())
    LIMIT 1
  `;
  if (!user) {
    return null;
  }

  const rows = await db<{ role: string; college_id: string | null }[]>`
    SELECT role, college_id
    FROM role_assignment
    WHERE user_id = ${id}
  `;
  const assignments: RoleAssignment[] = rows.flatMap((row) => {
    if (row.role === "PARTICIPANT" || row.role === "DEAN" || row.role === "VPSAS") {
      return [{ role: row.role, collegeId: row.college_id }];
    }
    return [];
  });

  return {
    id: user.id,
    fullName: user.full_name,
    email: user.email,
    collegeId: user.college_id,
    assignments,
  };
}

export async function requireRole(role: PrimaryRole): Promise<AuthenticatedIdentity> {
  const identity = await getAuthenticatedIdentity();
  if (!identity) {
    throw new AuthorizationError("Authentication is required.", 401);
  }
  if (!identity.assignments.some((assignment) => assignment.role === role)) {
    throw new AuthorizationError("You do not have permission to access this resource.", 403);
  }
  return identity;
}
