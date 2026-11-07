import type { AuthenticatedIdentity } from "@/lib/authorization";
import type { ActivityPermission, ActivityPermissionGrant } from "@/lib/activity-permissions-types";

export function canManageActivities(identity: AuthenticatedIdentity): boolean {
  return identity.assignments.some(
    (assignment) => assignment.role === "DEAN" || assignment.role === "VPSAS",
  );
}

export function hasActivityPermission(
  identity: AuthenticatedIdentity,
  permission: ActivityPermission,
  grants: ActivityPermissionGrant[],
  activityId: string | null,
  collegeIds: string[],
): boolean {
  if (!canManageActivities(identity)) {
    return false;
  }

  const permissionGrants = grants.filter((grant) => grant.permission === permission);
  if (activityId && permissionGrants.some((grant) => grant.activityId === activityId)) {
    return true;
  }

  const grantedCollegeIds = new Set(
    permissionGrants.flatMap((grant) => (grant.collegeId ? [grant.collegeId] : [])),
  );
  return collegeIds.length > 0 && collegeIds.every((collegeId) => grantedCollegeIds.has(collegeId));
}
