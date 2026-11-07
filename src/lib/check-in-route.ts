import type { NextRequest } from "next/server";
import { apiErrorResponse, assertSameOrigin, privateJson } from "@/lib/api";
import { getAuthenticatedIdentity } from "@/lib/authorization";
import { travelApiError, submitCheckIn } from "@/lib/travel-api";

const maximumRequestBytes = 4 * 1024 * 1024;
const maximumPhotoBytes = 3 * 1024 * 1024;
const allowedContentTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function handleCheckInRequest(
  request: NextRequest,
  travelSessionId: string,
  kind: "ARRIVAL" | "CHECKOUT",
) {
  try {
    assertSameOrigin(request);
    const identity = await getAuthenticatedIdentity();
    if (!identity) return privateJson({ error: "Authentication is required." }, 401);

    const length = Number(request.headers.get("content-length") ?? 0);
    if (length > maximumRequestBytes) {
      return privateJson({ error: "Milestone uploads must be no larger than 4 MB." }, 413);
    }

    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().startsWith("multipart/form-data;")) {
      return privateJson({ error: "Submit milestone fields and optional photo as multipart form data." }, 415);
    }
    const form = await request.formData();
    const raw = form.get("milestone");
    if (typeof raw !== "string") {
      return privateJson({ error: "Milestone details are required." }, 400);
    }

    let fields: unknown;
    try {
      fields = JSON.parse(raw);
    } catch (error) {
      if (error instanceof SyntaxError) {
        return privateJson({ error: "Milestone details must be valid JSON." }, 400);
      }
      throw error;
    }

    const photoValue = form.get("photo");
    let photo: { bytes: Buffer; contentType: string } | null = null;
    if (photoValue !== null && typeof photoValue !== "string" && photoValue.size > 0) {
      if (!allowedContentTypes.has(photoValue.type)) {
        return privateJson({ error: "Use a JPEG, PNG, or WebP camera image." }, 415);
      }
      if (photoValue.size > maximumPhotoBytes) {
        return privateJson({ error: "Captured photos must be no larger than 3 MB." }, 413);
      }
      photo = {
        bytes: Buffer.from(await photoValue.arrayBuffer()),
        contentType: photoValue.type,
      };
    }

    const result = await submitCheckIn(identity, travelSessionId, kind, fields, photo);
    return privateJson(result, 201);
  } catch (error) {
    const response = travelApiError(error) ?? apiErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
