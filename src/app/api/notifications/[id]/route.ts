import { z } from "zod";
import type { NextRequest } from "next/server";
import { apiErrorResponse, assertSameOrigin, privateJson } from "@/lib/api";
import { getAuthenticatedIdentity } from "@/lib/authorization";
import { markNotificationRead } from "@/lib/notification-inbox";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const identity = await getAuthenticatedIdentity();
    if (!identity) return privateJson({ error: "Authentication is required." }, 401);

    const { id } = await context.params;
    if (!z.string().uuid().safeParse(id).success) {
      return privateJson({ error: "Notification ID must be a UUID." }, 400);
    }

    const result = await markNotificationRead(identity, id);
    return result
      ? privateJson(result)
      : privateJson({ error: "Notification was not found in your inbox." }, 404);
  } catch (error) {
    const response = apiErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
