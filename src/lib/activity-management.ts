import type { TransactionSql } from "postgres";
import { hasActivityPermission } from "@/lib/activity-permissions";
import type { ActivityPermission, ActivityPermissionGrant } from "@/lib/activity-permissions-types";
import { AuthorizationError } from "@/lib/authorization";
import type { AuthenticatedIdentity } from "@/lib/authorization";

export class ActivityNotFoundError extends Error {
  constructor() {
    super("Activity was not found.");
    this.name = "ActivityNotFoundError";
  }
}

export class ActivityConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ActivityConflictError";
  }
}

export async function requireItineraryLegDetailsMigration(transaction: TransactionSql): Promise<void> {
  const [migration] = await transaction<{ applied: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM schema_migration WHERE name = '0005_itinerary_leg_details.sql'
    ) AS applied
  `;
  if (!migration.applied) {
    throw new ActivityConflictError("Departure locations and van or ship modes require the itinerary leg migration.");
  }
}

export async function requireActivityPermission(
  transaction: TransactionSql,
  identity: AuthenticatedIdentity,
  permission: ActivityPermission,
  activityId: string | null,
  collegeIds: string[],
): Promise<void> {
  const grants = await transaction<ActivityPermissionGrant[]>`
    SELECT permission::text AS permission,
           activity_id AS "activityId",
           college_id AS "collegeId"
    FROM activity_permission_assignment
    WHERE user_id = ${identity.id}
      AND permission = ${permission}::activity_permission
      AND (
        (${activityId}::uuid IS NOT NULL AND activity_id = ${activityId}::uuid)
        OR college_id = ANY(${collegeIds}::uuid[])
      )
    FOR SHARE
  `;

  if (!hasActivityPermission(identity, permission, grants, activityId, collegeIds)) {
    throw new AuthorizationError("You do not have the required scoped activity permission.", 403);
  }
}
