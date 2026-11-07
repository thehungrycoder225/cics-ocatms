import { z } from "zod";
import { apiErrorResponse, privateJson, RequestValidationError } from "@/lib/api";
import { getAuthenticatedIdentity } from "@/lib/authorization";
import { getParticipantStop } from "@/lib/participant-journey";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const identity = await getAuthenticatedIdentity();
    if (!identity) return privateJson({ error: "Authentication is required." }, 401);
    if (!identity.assignments.some((assignment) => assignment.role === "PARTICIPANT")) {
      return privateJson({ error: "Only participants can access this workspace." }, 403);
    }
    const { id } = await context.params;
    if (!z.string().uuid().safeParse(id).success) {
      throw new RequestValidationError("Itinerary stop ID must be a UUID.");
    }
    const stop = await getParticipantStop(identity.id, id);
    if (!stop) return privateJson({ error: "Approved itinerary stop was not found." }, 404);
    return privateJson({ stop });
  } catch (error) {
    const response = apiErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
