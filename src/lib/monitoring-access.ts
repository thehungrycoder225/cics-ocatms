import type { AuthenticatedIdentity } from "@/lib/authorization";

export interface MonitoringAccess {
  isVpsas: boolean;
  isParticipant: boolean;
  deanCollegeIds: string[];
}

export function getMonitoringAccess(identity: AuthenticatedIdentity): MonitoringAccess {
  return {
    isVpsas: identity.assignments.some((assignment) => assignment.role === "VPSAS"),
    isParticipant: identity.assignments.some((assignment) => assignment.role === "PARTICIPANT"),
    deanCollegeIds: identity.assignments.flatMap((assignment) =>
      assignment.role === "DEAN" && assignment.collegeId ? [assignment.collegeId] : [],
    ),
  };
}

export function canMonitorParticipant(
  identity: AuthenticatedIdentity,
  participantId: string,
  participantCollegeId: string | null,
  activityCollegeIds: string[],
): boolean {
  const access = getMonitoringAccess(identity);
  if (access.isVpsas) return true;
  if (access.isParticipant && identity.id === participantId) return true;
  return Boolean(
    participantCollegeId &&
    access.deanCollegeIds.includes(participantCollegeId) &&
    activityCollegeIds.includes(participantCollegeId),
  );
}

export function hasMonitoringRole(identity: AuthenticatedIdentity): boolean {
  const access = getMonitoringAccess(identity);
  return access.isVpsas || access.deanCollegeIds.length > 0;
}
