export const primaryRoles = ["PARTICIPANT", "DEAN", "VPSAS"] as const;

export type PrimaryRole = (typeof primaryRoles)[number];

export interface RoleAssignment {
  role: PrimaryRole;
  collegeId: string | null;
}

export function hasRole(assignments: RoleAssignment[], role: PrimaryRole): boolean {
  return assignments.some((assignment) => assignment.role === role);
}

export function visibleCollegeIds(assignments: RoleAssignment[]): string[] {
  return assignments
    .filter((assignment) => assignment.role === "DEAN" && assignment.collegeId !== null)
    .map((assignment) => assignment.collegeId as string);
}
