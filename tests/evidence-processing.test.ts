import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import {
  buildStampedDerivative,
  getEvidenceStorageConfiguration,
} from "../src/lib/evidence-storage.ts";

test("S3 storage configuration preserves existing defaults and supports Supabase endpoint settings", () => {
  assert.deepEqual(getEvidenceStorageConfiguration({
    S3_BUCKET: "evidence",
    S3_REGION: "ap-southeast-1",
  }), {
    bucket: "evidence",
    region: "ap-southeast-1",
    forcePathStyle: false,
    serverSideEncryption: "AES256",
  });

  assert.deepEqual(getEvidenceStorageConfiguration({
    S3_BUCKET: "activity-evidence",
    S3_REGION: "ap-southeast-1",
    S3_ENDPOINT: "https://project-ref.storage.supabase.co/storage/v1/s3",
    S3_ACCESS_KEY_ID: "staging-access-key",
    S3_SECRET_ACCESS_KEY: "staging-secret-key",
    S3_FORCE_PATH_STYLE: "true",
    S3_SERVER_SIDE_ENCRYPTION: "",
  }), {
    bucket: "activity-evidence",
    region: "ap-southeast-1",
    endpoint: "https://project-ref.storage.supabase.co/storage/v1/s3",
    forcePathStyle: true,
    accessKeyId: "staging-access-key",
    secretAccessKey: "staging-secret-key",
  });
});

test("S3 storage configuration rejects a partial credential pair and unknown encryption mode", () => {
  assert.throws(
    () => getEvidenceStorageConfiguration({
      S3_BUCKET: "evidence",
      S3_REGION: "ap-southeast-1",
      S3_ACCESS_KEY_ID: "staging-access-key",
    }),
    /must be configured together/,
  );
  assert.throws(
    () => getEvidenceStorageConfiguration({
      S3_BUCKET: "evidence",
      S3_REGION: "ap-southeast-1",
      S3_SERVER_SIDE_ENCRYPTION: "aws:kms",
    }),
    /must be AES256 or empty/,
  );
});

test("stamped derivative visibly adds server-time, coordinates, and a verification disclaimer", async () => {
  const original = await sharp({
    create: {
      width: 320,
      height: 240,
      channels: 3,
      background: { r: 32, g: 96, b: 72 },
    },
  }).jpeg().toBuffer();

  const result = await buildStampedDerivative({
    bytes: original,
    declaredContentType: "image/jpeg",
    kind: "ARRIVAL",
    latitude: 14.6,
    longitude: 121.0,
    serverReceivedAt: new Date("2026-11-07T12:00:00.000Z"),
  });
  const derivative = await sharp(result.bytes).metadata();

  assert.equal(derivative.format, "jpeg");
  assert.ok(derivative.height && derivative.height > 240);
  assert.equal(result.sha256.length, 64);
});

test("invalid image format is not accepted as evidence", async () => {
  await assert.rejects(
    buildStampedDerivative({
      bytes: Buffer.from("not an image"),
      declaredContentType: "image/jpeg",
      kind: "CHECKOUT",
      latitude: 14.6,
      longitude: 121.0,
      serverReceivedAt: new Date("2026-11-07T12:00:00.000Z"),
    }),
  );
});
