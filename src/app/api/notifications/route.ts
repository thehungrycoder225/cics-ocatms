import { apiErrorResponse, privateJson } from "@/lib/api";
import { getAuthenticatedIdentity } from "@/lib/authorization";
import { getNotificationInbox } from "@/lib/notification-inbox";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const identity = await getAuthenticatedIdentity();
    if (!identity) return privateJson({ error: "Authentication is required." }, 401);
    return privateJson(await getNotificationInbox(identity));
  } catch (error) {
    const response = apiErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
