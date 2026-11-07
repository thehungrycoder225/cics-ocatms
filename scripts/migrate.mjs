import { readdir, readFile } from "node:fs/promises";
import postgres from "postgres";
import { getOperatorDatabaseUrl } from "./database-url.mjs";

const connectionString = getOperatorDatabaseUrl(process.env);
const sql = postgres(connectionString, { max: 1, prepare: false });
try {
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migration (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  const migrationDirectory = new URL("../db/migrations/", import.meta.url);
  const fileNames = (await readdir(migrationDirectory))
    .filter((name) => name.endsWith(".sql"))
    .sort();

  for (const name of fileNames) {
    const [existing] = await sql`SELECT name FROM schema_migration WHERE name = ${name}`;
    if (existing) {
      console.log(`Already applied: ${name}`);
      continue;
    }

    const contents = await readFile(new URL(name, migrationDirectory), "utf8");
    await sql.begin(async (transaction) => {
      await transaction.unsafe(contents.replace(/^\s*BEGIN\s*;/i, "").replace(/COMMIT\s*;\s*$/i, ""));
      await transaction`INSERT INTO schema_migration (name) VALUES (${name})`;
    });
    console.log(`Applied: ${name}`);
  }
} finally {
  await sql.end();
}
