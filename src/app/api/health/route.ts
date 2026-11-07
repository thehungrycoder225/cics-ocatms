import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json(
    { status: "ok", service: "marsu-ocatms" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
