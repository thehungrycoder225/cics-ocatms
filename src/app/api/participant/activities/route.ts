import { privateJson } from "@/lib/api";
import { getAuthenticatedIdentity } from "@/lib/authorization";
import { listParticipantActivities } from "@/lib/participant-journey";

export const dynamic = "force-dynamic";

export async function GET() {
  const identity = await getAuthenticatedIdentity();
  if (!identity) return privateJson({ error: "Authentication is required." }, 401);
  if (!identity.assignments.some((assignment) => assignment.role === "PARTICIPANT")) {
    return privateJson({ error: "Only participants can access this workspace." }, 403);
  }
  const activities = await listParticipantActivities(identity.id);
  return privateJson({ activities });
}
