export function readIdempotencyResponse(value: unknown): Record<string, unknown> {
  const response: unknown = typeof value === "string" ? JSON.parse(value) : value;
  if (!response || typeof response !== "object" || Array.isArray(response)) {
    throw new Error("Stored idempotency response must be a JSON object.");
  }
  return response as Record<string, unknown>;
}
