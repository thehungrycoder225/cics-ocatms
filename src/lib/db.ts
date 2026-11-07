import postgres from "postgres";

declare global {
  var ocatmsSql: ReturnType<typeof postgres> | undefined;
}

export function getDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required to access OCATMS data.");
  }

  if (!globalThis.ocatmsSql) {
    globalThis.ocatmsSql = postgres(connectionString, {
      max: 1,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
    });
  }

  return globalThis.ocatmsSql;
}
