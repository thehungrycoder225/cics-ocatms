export type ActivityPermission = "ACTIVITY_EDIT" | "ACTIVITY_APPROVE";

export interface ActivityPermissionGrant {
  permission: ActivityPermission;
  activityId: string | null;
  collegeId: string | null;
}
