import { NextResponse, type NextRequest } from "next/server";
import { AuthorizationError } from "@/lib/authorization";
import { ActivityConflictError, ActivityNotFoundError } from "@/lib/activity-management";

export class RequestValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RequestValidationError";
  }
}

export function privateJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      Pragma: "no-cache",
    },
  });
}

export function assertSameOrigin(request: NextRequest): void {
  const expectedOrigin = process.env.NEXTAUTH_URL
    ? new URL(process.env.NEXTAUTH_URL).origin
    : new URL(request.url).origin;
  if (request.headers.get("origin") !== expectedOrigin) {
    throw new AuthorizationError("A same-origin request is required.", 403);
  }
}

export async function readJsonBody(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new RequestValidationError("Request body must be valid JSON.");
    }
    throw error;
  }
}

export function apiErrorResponse(error: unknown) {
  if (error instanceof AuthorizationError) {
    return privateJson({ error: error.message }, error.status);
  }
  if (error instanceof RequestValidationError) {
    return privateJson({ error: error.message }, 400);
  }
  if (error instanceof ActivityNotFoundError) {
    return privateJson({ error: error.message }, 404);
  }
  if (error instanceof ActivityConflictError) {
    return privateJson({ error: error.message }, 409);
  }
  return null;
}
