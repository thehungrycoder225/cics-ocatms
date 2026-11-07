import type { NextRequest } from "next/server";
import {
  apiErrorResponse,
  assertSameOrigin,
  privateJson,
  readJsonBody,
} from "@/lib/api";
import { getAuthenticatedIdentity } from "@/lib/authorization";
import { travelApiError, updateTravelLocation } from "@/lib/travel-api";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const identity = await getAuthenticatedIdentity();
    if (!identity) return privateJson({ error: "Authentication is required." }, 401);
    const { id } = await context.params;
    return privateJson(await updateTravelLocation(identity, id, await readJsonBody(request)));
  } catch (error) {
    const response = travelApiError(error) ?? apiErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
