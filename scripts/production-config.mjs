export function validateProductionEnvironment(env) {
  const errors = [];
  const required = [
    "DATABASE_URL",
    "NEXTAUTH_SECRET",
    "NEXTAUTH_URL",
    "S3_BUCKET",
    "S3_REGION",
  ];

  for (const name of required) {
    if (!env[name]?.trim()) errors.push(`${name} is required.`);
  }

  if (env.DATABASE_URL) {
    const databaseUrl = validatePostgresUrl(env.DATABASE_URL, "DATABASE_URL", errors);
    if (databaseUrl?.hostname.endsWith(".pooler.supabase.com") && databaseUrl.port === "6543") {
      errors.push(
        "DATABASE_URL uses the Supabase shared transaction pooler, which is incompatible with postgres.js pipelining; use a validated alternative before production.",
      );
    }
  }
  if (env.DIRECT_URL) {
    validatePostgresUrl(env.DIRECT_URL, "DIRECT_URL", errors);
  }

  if (env.NEXTAUTH_SECRET && Buffer.byteLength(env.NEXTAUTH_SECRET, "utf8") < 32) {
    errors.push("NEXTAUTH_SECRET must contain at least 32 UTF-8 bytes.");
  }

  if (env.NEXTAUTH_URL) {
    try {
      if (new URL(env.NEXTAUTH_URL).protocol !== "https:") {
        errors.push("NEXTAUTH_URL must use HTTPS in production.");
      }
    } catch {
      errors.push("NEXTAUTH_URL must be a valid absolute URL.");
    }
  }

  if (env.S3_ACCESS_KEY_ID && !env.S3_SECRET_ACCESS_KEY) {
    errors.push("S3_SECRET_ACCESS_KEY is required when S3_ACCESS_KEY_ID is set.");
  }
  if (env.S3_SECRET_ACCESS_KEY && !env.S3_ACCESS_KEY_ID) {
    errors.push("S3_ACCESS_KEY_ID is required when S3_SECRET_ACCESS_KEY is set.");
  }
  if (env.S3_ENDPOINT) {
    try {
      const endpoint = new URL(env.S3_ENDPOINT);
      if (endpoint.protocol !== "https:") {
        errors.push("S3_ENDPOINT must use HTTPS in production.");
      }
      if (
        endpoint.hostname.endsWith(".supabase.co") &&
        endpoint.pathname.includes("/storage/v1/s3")
      ) {
        if (env.S3_FORCE_PATH_STYLE !== "true") {
          errors.push("S3_FORCE_PATH_STYLE must be true for Supabase Storage S3 endpoints.");
        }
        if (env.S3_SERVER_SIDE_ENCRYPTION !== "") {
          errors.push("S3_SERVER_SIDE_ENCRYPTION must be explicitly empty for Supabase Storage S3 endpoints.");
        }
        if (!env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY) {
          errors.push("Supabase Storage S3 endpoints require server-side S3 access keys.");
        }
      }
    } catch {
      errors.push("S3_ENDPOINT must be a valid absolute URL.");
    }
  }

  if (env.S3_SERVER_SIDE_ENCRYPTION && env.S3_SERVER_SIDE_ENCRYPTION !== "AES256") {
    errors.push("S3_SERVER_SIDE_ENCRYPTION must be AES256 or empty.");
  }

  validateInteger(env, "GPS_MAX_ACCURACY_M", 1, 10000, errors);
  validateInteger(env, "CHECKIN_OVERDUE_TOLERANCE_MINUTES", 0, 1440, errors);
  return errors;
}

function validatePostgresUrl(value, name, errors) {
  try {
    const databaseUrl = new URL(value);
    if (!["postgres:", "postgresql:"].includes(databaseUrl.protocol) || !databaseUrl.hostname) {
      errors.push(`${name} must be a PostgreSQL connection URL with a host.`);
    }
    return databaseUrl;
  } catch {
    errors.push(`${name} must be a valid PostgreSQL connection URL.`);
    return undefined;
  }
}

function validateInteger(env, name, minimum, maximum, errors) {
  if (env[name] === undefined || env[name] === "") return;
  const value = Number(env[name]);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    errors.push(`${name} must be an integer from ${minimum} to ${maximum}.`);
  }
}
