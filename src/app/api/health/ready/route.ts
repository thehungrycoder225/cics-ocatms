import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

const requiredMigrations = [
  "0001_foundation.sql",
  "0002_participant_journey.sql",
  "0003_monitoring_review.sql",
  "0004_username_and_expiry.sql",
];

export async function GET() {
  const dependencies = {
    database: "unavailable",
    postgis: "unchecked",
    migrations: "unchecked",
  };

  try {
    const db = getDb();
    const [extensions] = await db<{ postgis: boolean; migration_table: boolean }[]>`
      SELECT
        EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') AS postgis,
        to_regclass('public.schema_migration') IS NOT NULL AS migration_table
    `;
    dependencies.database = "ready";
    dependencies.postgis = extensions.postgis ? "ready" : "missing";

    if (!extensions.migration_table) {
      dependencies.migrations = "pending";
    } else {
      const appliedMigrations = await db<{ name: string }[]>`
        SELECT name
        FROM schema_migration
        WHERE name = ANY(${requiredMigrations}::text[])
      `;
      dependencies.migrations = requiredMigrations.every((name) =>
        appliedMigrations.some((migration) => migration.name === name),
      ) ? "ready" : "pending";
    }

    const ready = Object.values(dependencies).every((status) => status === "ready");
    return NextResponse.json(
      { status: ready ? "ready" : "not_ready", dependencies },
      { status: ready ? 200 : 503, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("OCATMS readiness check could not verify its database dependencies.", error);
    dependencies.database = "unavailable";
    return NextResponse.json(
      { status: "not_ready", dependencies },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
