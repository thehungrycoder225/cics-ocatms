import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import sharp from "sharp";
import {
  buildStampedDerivative,
  getEvidenceStorageConfiguration,
  storeEvidence,
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

test("Cloudflare R2 configuration requires supported credentials and omits unsupported request headers", () => {
  const config = {
    S3_BUCKET: "activity-evidence",
    S3_REGION: "auto",
    S3_ENDPOINT: "https://account-id.r2.cloudflarestorage.com",
    S3_ACCESS_KEY_ID: "test-access-key",
    S3_SECRET_ACCESS_KEY: "test-secret-key",
  };
  const defaultConfig = getEvidenceStorageConfiguration(config);
  assert.equal(defaultConfig.serverSideEncryption, undefined);
  assert.equal(defaultConfig.requestChecksumCalculation, "WHEN_REQUIRED");
  assert.equal(
    getEvidenceStorageConfiguration({ ...config, S3_SERVER_SIDE_ENCRYPTION: "AES256" })
      .serverSideEncryption,
    undefined,
  );
  assert.throws(
    () => getEvidenceStorageConfiguration({ ...config, S3_REGION: "ap-southeast-1" }),
    /Cloudflare R2 S3_REGION must be auto or us-east-1/,
  );
  assert.throws(
    () => getEvidenceStorageConfiguration({
      S3_BUCKET: config.S3_BUCKET,
      S3_REGION: config.S3_REGION,
      S3_ENDPOINT: config.S3_ENDPOINT,
    }),
    /Cloudflare R2 requires S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY/,
  );
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

test("arrival and checkout originals and stamped derivatives persist at an S3-compatible endpoint", async () => {
  const persistedObjects = new Map<string, { bytes: Buffer; headers: Map<string, string> }>();
  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      if (request.method !== "PUT") {
        response.writeHead(405).end();
        return;
      }
      const objectKey = new URL(request.url ?? "/", "http://localhost").pathname
        .replace(/^\/activity-evidence\//, "");
      persistedObjects.set(objectKey, {
        bytes: Buffer.concat(chunks),
        headers: new Map(
          Object.entries(request.headers).map(([name, value]) => [
            name,
            Array.isArray(value) ? value.join(",") : value ?? "",
          ]),
        ),
      });
      response.writeHead(200, { ETag: '"persisted"' }).end();
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");

  const environmentKeys = [
    "S3_BUCKET",
    "S3_REGION",
    "S3_ENDPOINT",
    "S3_ACCESS_KEY_ID",
    "S3_SECRET_ACCESS_KEY",
    "S3_FORCE_PATH_STYLE",
    "S3_SERVER_SIDE_ENCRYPTION",
  ] as const;
  const originalEnvironment = Object.fromEntries(
    environmentKeys.map((key) => [key, process.env[key]]),
  );
  Object.assign(process.env, {
    S3_BUCKET: "activity-evidence",
    S3_REGION: "auto",
    S3_ENDPOINT: `http://127.0.0.1:${address.port}`,
    S3_ACCESS_KEY_ID: "test-access-key",
    S3_SECRET_ACCESS_KEY: "test-secret-key",
    S3_FORCE_PATH_STYLE: "true",
    S3_SERVER_SIDE_ENCRYPTION: "",
  });

  try {
    const original = await sharp({
      create: {
        width: 320,
        height: 240,
        channels: 3,
        background: { r: 32, g: 96, b: 72 },
      },
    }).jpeg().toBuffer();

    for (const kind of ["ARRIVAL", "CHECKOUT"] as const) {
      const label = kind.toLowerCase();
      const evidence = await storeEvidence({
        bytes: original,
        declaredContentType: "image/jpeg",
        participantId: `participant-${label}`,
        activityId: "activity-1",
        travelSessionId: `session-${label}`,
        kind,
        latitude: 14.6,
        longitude: 121.0,
        serverReceivedAt: new Date("2026-11-07T12:00:00.000Z"),
      });
      const savedOriginal = persistedObjects.get(evidence.originalObjectKey);
      const savedStamped = persistedObjects.get(evidence.stampedObjectKey);

      assert.ok(savedOriginal, `${kind} original object persisted`);
      assert.ok(savedStamped, `${kind} stamped derivative persisted`);
      assert.deepEqual(savedOriginal.bytes, original);
      assert.equal(savedOriginal.headers.get("content-type"), "image/jpeg");
      assert.equal(savedOriginal.headers.get("x-amz-server-side-encryption"), undefined);
      assert.equal(savedOriginal.headers.get("x-amz-meta-kind"), label);
      assert.equal(savedOriginal.headers.get("x-amz-meta-sha256"), evidence.originalSha256);
      assert.equal(savedStamped.headers.get("content-type"), "image/jpeg");
      assert.equal(savedStamped.headers.get("x-amz-server-side-encryption"), undefined);
      assert.equal(savedStamped.headers.get("x-amz-meta-sha256"), evidence.stampedSha256);
      assert.equal(savedStamped.headers.get("x-amz-meta-originalsha256"), evidence.originalSha256);
      assert.equal((await sharp(savedStamped.bytes).metadata()).format, "jpeg");
    }

    assert.equal(persistedObjects.size, 4);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
    for (const [key, value] of Object.entries(originalEnvironment)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
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
