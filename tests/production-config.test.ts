import assert from "node:assert/strict";
import test from "node:test";
import { validateProductionEnvironment } from "../scripts/production-config.mjs";

const validEnvironment = {
  DATABASE_URL: "postgresql://app:password@example.com/ocatms",
  NEXTAUTH_SECRET: "a-production-secret-with-at-least-32-bytes",
  NEXTAUTH_URL: "https://ocatms.example.edu",
  S3_BUCKET: "private-evidence",
  S3_REGION: "ap-southeast-1",
  GPS_MAX_ACCURACY_M: "100",
  CHECKIN_OVERDUE_TOLERANCE_MINUTES: "30",
};

test("production environment accepts secure baseline configuration", () => {
  assert.deepEqual(validateProductionEnvironment(validEnvironment), []);
});

test("production environment rejects insecure origins and invalid policy values", () => {
  const errors = validateProductionEnvironment({
    ...validEnvironment,
    NEXTAUTH_URL: "http://ocatms.example.edu",
    GPS_MAX_ACCURACY_M: "0",
    CHECKIN_OVERDUE_TOLERANCE_MINUTES: "1441",
    S3_ACCESS_KEY_ID: "only-one-half",
  });
  assert.equal(errors.length, 4);
  assert.ok(errors.some((error) => error.includes("NEXTAUTH_URL must use HTTPS")));
  assert.ok(errors.some((error) => error.includes("GPS_MAX_ACCURACY_M")));
  assert.ok(errors.some((error) => error.includes("CHECKIN_OVERDUE_TOLERANCE_MINUTES")));
  assert.ok(errors.some((error) => error.includes("S3_SECRET_ACCESS_KEY")));
});

test("production environment reports missing configuration without echoing values", () => {
  const errors = validateProductionEnvironment({});
  assert.equal(errors.length, 5);
  assert.ok(errors.every((error) => !error.includes("password")));
});

test("Supabase Storage configuration requires explicit S3-compatible settings", () => {
  const errors = validateProductionEnvironment({
    ...validEnvironment,
    S3_ENDPOINT: "https://project-ref.storage.supabase.co/storage/v1/s3",
    S3_ACCESS_KEY_ID: "staging-access-key",
    S3_SECRET_ACCESS_KEY: "staging-secret-key",
    S3_FORCE_PATH_STYLE: "true",
    S3_SERVER_SIDE_ENCRYPTION: "",
  });
  assert.deepEqual(errors, []);
});

test("Supabase Storage rejects unsupported server-side encryption and virtual-host addressing", () => {
  const errors = validateProductionEnvironment({
    ...validEnvironment,
    S3_ENDPOINT: "https://project-ref.storage.supabase.co/storage/v1/s3",
    S3_ACCESS_KEY_ID: "staging-access-key",
    S3_SECRET_ACCESS_KEY: "staging-secret-key",
    S3_FORCE_PATH_STYLE: "false",
    S3_SERVER_SIDE_ENCRYPTION: "AES256",
  });
  assert.equal(errors.length, 2);
  assert.ok(errors.some((error) => error.includes("S3_FORCE_PATH_STYLE")));
  assert.ok(errors.some((error) => error.includes("explicitly empty")));
});

test("Cloudflare R2 requires its supported region and S3 credentials", () => {
  const r2Environment = {
    ...validEnvironment,
    S3_REGION: "auto",
    S3_ENDPOINT: "https://account-id.r2.cloudflarestorage.com",
    S3_ACCESS_KEY_ID: "staging-access-key",
    S3_SECRET_ACCESS_KEY: "staging-secret-key",
  };
  assert.deepEqual(validateProductionEnvironment(r2Environment), []);
  assert.ok(validateProductionEnvironment({
    ...r2Environment,
    S3_REGION: "ap-southeast-1",
  }).some((error) => error.includes("Cloudflare R2 S3_REGION")));
  assert.ok(validateProductionEnvironment({
    ...r2Environment,
    S3_ACCESS_KEY_ID: "",
    S3_SECRET_ACCESS_KEY: "",
  }).some((error) => error.includes("Cloudflare R2 requires server-side S3 access keys")));
});

test("direct migration database URL is validated when provided", () => {
  const errors = validateProductionEnvironment({
    ...validEnvironment,
    DIRECT_URL: "https://not-postgres.example.edu",
  });
  assert.ok(errors.some((error) => error.includes("DIRECT_URL")));
});

test("production environment rejects the Supabase transaction pooler for postgres.js", () => {
  const errors = validateProductionEnvironment({
    ...validEnvironment,
    DATABASE_URL: "postgresql://postgres.project:secret@aws-0-region.pooler.supabase.com:6543/postgres",
  });
  assert.ok(errors.some((error) => error.includes("transaction pooler")));
  assert.ok(errors.every((error) => !error.includes("secret")));
});

test("production environment accepts a Supabase session pooler URL", () => {
  assert.deepEqual(validateProductionEnvironment({
    ...validEnvironment,
    DATABASE_URL: "postgresql://postgres.project:secret@aws-0-region.pooler.supabase.com:5432/postgres",
  }), []);
});
