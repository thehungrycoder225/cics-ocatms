import type { NextRequest } from "next/server";
import {
  apiErrorResponse,
  assertSameOrigin,
  privateJson,
  readJsonBody,
} from "@/lib/api";
import { getAuthenticatedIdentity } from "@/lib/authorization";
import { travelApiError, startTravel } from "@/lib/travel-api";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const identity = await getAuthenticatedIdentity();
    if (!identity) return privateJson({ error: "Authentication is required." }, 401);

    return privateJson(await startTravel(identity, await readJsonBody(request)), 201);
  } catch (error) {
    const response = travelApiError(error) ?? apiErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
