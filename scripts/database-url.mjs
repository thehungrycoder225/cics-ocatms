export function getOperatorDatabaseUrl(env) {
  const connectionString = env.DIRECT_URL?.trim() || env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error("Set DATABASE_URL or DIRECT_URL before running this database command.");
  }
  return connectionString;
}
