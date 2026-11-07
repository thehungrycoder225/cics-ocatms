import type { NextRequest } from "next/server";
import { handleCheckInRequest } from "@/lib/check-in-route";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return handleCheckInRequest(request, id, "CHECKOUT");
}
