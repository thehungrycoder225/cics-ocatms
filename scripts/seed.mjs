import { readFile } from "node:fs/promises";
import postgres from "postgres";
import { getOperatorDatabaseUrl } from "./database-url.mjs";

const connectionString = getOperatorDatabaseUrl(process.env);
const sql = postgres(connectionString, { max: 1, prepare: false });
try {
  const seed = await readFile(new URL("../db/seeds/0001_canonical_example.sql", import.meta.url), "utf8");
  await sql.unsafe(seed);
  console.log("Canonical activity and pending participant assignments seeded. No travel or attendance events were created.");
} finally {
  await sql.end();
}
