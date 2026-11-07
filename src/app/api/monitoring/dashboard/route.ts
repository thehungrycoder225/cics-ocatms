import { apiErrorResponse, privateJson, RequestValidationError } from "@/lib/api";
import { getAuthenticatedIdentity } from "@/lib/authorization";
import { getMonitoringDashboard, monitoringFilterSchema } from "@/lib/monitoring";
import { hasMonitoringRole } from "@/lib/monitoring-access";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const identity = await getAuthenticatedIdentity();
    if (!identity) return privateJson({ error: "Authentication is required." }, 401);
    if (!hasMonitoringRole(identity)) {
      return privateJson({ error: "Monitoring is available only to authorized Dean or VPSAS accounts." }, 403);
    }

    const search = new URL(request.url).searchParams;
    const parsed = monitoringFilterSchema.safeParse({
      ...(search.has("collegeId") ? { collegeId: search.get("collegeId") } : {}),
      ...(search.has("activityId") ? { activityId: search.get("activityId") } : {}),
      ...(search.has("activityStatus") ? { activityStatus: search.get("activityStatus") } : {}),
      ...(search.has("dateFrom") ? { dateFrom: search.get("dateFrom") } : {}),
      ...(search.has("dateTo") ? { dateTo: search.get("dateTo") } : {}),
      ...(search.has("participant") ? { participant: search.get("participant") } : {}),
      ...(search.has("participantId") ? { participantId: search.get("participantId") } : {}),
      ...(search.has("exceptionsOnly") ? { exceptionsOnly: search.get("exceptionsOnly") } : {}),
      ...(search.has("travelStatus") ? { travelStatus: search.get("travelStatus") } : {}),
      ...(search.has("arrivalStatus") ? { arrivalStatus: search.get("arrivalStatus") } : {}),
      ...(search.has("checkoutStatus") ? { checkoutStatus: search.get("checkoutStatus") } : {}),
      ...(search.has("evidenceStatus") ? { evidenceStatus: search.get("evidenceStatus") } : {}),
      ...(search.has("includeSynthetic") ? { includeSynthetic: search.get("includeSynthetic") } : {}),
    });
    if (!parsed.success) {
      throw new RequestValidationError(parsed.error.issues[0]?.message ?? "Monitoring filters are invalid.");
    }
    return privateJson(await getMonitoringDashboard(identity, parsed.data));
  } catch (error) {
    const response = apiErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
