import { randomUUID, createHash } from "node:crypto";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import sharp from "sharp";

const maximumOriginalBytes = 3 * 1024 * 1024;
const allowedFormats = new Map([
  ["jpeg", "image/jpeg"],
  ["png", "image/png"],
  ["webp", "image/webp"],
]);

export class EvidenceStorageNotConfiguredError extends Error {
  constructor() {
    super("Private evidence storage is not configured. Contact the OCATMS administrator.");
    this.name = "EvidenceStorageNotConfiguredError";
  }
}

export class EvidenceValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EvidenceValidationError";
  }
}

export interface EvidenceStorageConfiguration {
  bucket: string;
  region: string;
  endpoint?: string;
  forcePathStyle: boolean;
  accessKeyId?: string;
  secretAccessKey?: string;
  serverSideEncryption?: "AES256";
  requestChecksumCalculation?: "WHEN_REQUIRED";
}

function isCloudflareR2Endpoint(endpoint: string | undefined): boolean {
  if (!endpoint) return false;
  try {
    return new URL(endpoint).hostname.endsWith(".r2.cloudflarestorage.com");
  } catch {
    return false;
  }
}

export function getEvidenceStorageConfiguration(
  env: Record<string, string | undefined> = process.env,
): EvidenceStorageConfiguration {
  const bucket = env.S3_BUCKET?.trim();
  const region = env.S3_REGION?.trim();
  if (!bucket || !region) throw new EvidenceStorageNotConfiguredError();

  const endpoint = env.S3_ENDPOINT?.trim();
  const isCloudflareR2 = isCloudflareR2Endpoint(endpoint);
  const accessKeyId = env.S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = env.S3_SECRET_ACCESS_KEY?.trim();
  if (Boolean(accessKeyId) !== Boolean(secretAccessKey)) {
    throw new Error("S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY must be configured together.");
  }
  if (isCloudflareR2 && region !== "auto" && region !== "us-east-1") {
    throw new Error("Cloudflare R2 S3_REGION must be auto or us-east-1.");
  }
  if (isCloudflareR2 && !accessKeyId) {
    throw new Error("Cloudflare R2 requires S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY.");
  }

  const encryptionValue = env.S3_SERVER_SIDE_ENCRYPTION;
  if (encryptionValue && encryptionValue !== "AES256") {
    throw new Error("S3_SERVER_SIDE_ENCRYPTION must be AES256 or empty.");
  }

  return {
    bucket,
    region,
    ...(endpoint ? { endpoint } : {}),
    forcePathStyle: env.S3_FORCE_PATH_STYLE === "true",
    ...(accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : {}),
    ...(isCloudflareR2 ? { requestChecksumCalculation: "WHEN_REQUIRED" as const } : {}),
    ...(!isCloudflareR2 && (encryptionValue === undefined || encryptionValue === "AES256")
      ? { serverSideEncryption: encryptionValue ?? "AES256" }
      : {}),
  };
}

function getStorage() {
  const configuration = getEvidenceStorageConfiguration();
  const {
    bucket,
    region,
    endpoint,
    forcePathStyle,
    accessKeyId,
    secretAccessKey,
    serverSideEncryption,
    requestChecksumCalculation,
  } = configuration;
  const client = new S3Client({
    region,
    ...(endpoint ? { endpoint } : {}),
    forcePathStyle,
    ...(accessKeyId && secretAccessKey
      ? { credentials: { accessKeyId, secretAccessKey } }
      : {}),
    ...(requestChecksumCalculation ? { requestChecksumCalculation } : {}),
  });
  return { client, bucket, serverSideEncryption };
}

function escapeXml(value: string): string {
  return value.replace(/[<>&'"]/g, (character) => {
    const entities: Record<string, string> = {
      "<": "&lt;",
      ">": "&gt;",
      "&": "&amp;",
      "'": "&apos;",
      '"': "&quot;",
    };
    return entities[character] ?? character;
  });
}

export interface EvidenceInput {
  bytes: Buffer;
  declaredContentType: string;
  participantId: string;
  activityId: string;
  travelSessionId: string;
  kind: "ARRIVAL" | "CHECKOUT";
  latitude: number;
  longitude: number;
  serverReceivedAt: Date;
}

export interface StoredEvidence {
  id: string;
  originalObjectKey: string;
  stampedObjectKey: string;
  originalSha256: string;
  stampedSha256: string;
  contentType: string;
  originalSizeBytes: number;
  stampedSizeBytes: number;
}

export async function buildStampedDerivative(input: Pick<
  EvidenceInput,
  "bytes" | "declaredContentType" | "kind" | "latitude" | "longitude" | "serverReceivedAt"
>): Promise<{ bytes: Buffer; sha256: string; contentType: string }> {
  if (input.bytes.length === 0 || input.bytes.length > maximumOriginalBytes) {
    throw new EvidenceValidationError("Evidence must be a non-empty image no larger than 3 MB.");
  }

  const metadata = await sharp(input.bytes, { limitInputPixels: 40_000_000 }).metadata();
  const contentType = metadata.format ? allowedFormats.get(metadata.format) : undefined;
  if (!contentType || contentType !== input.declaredContentType) {
    throw new EvidenceValidationError("The captured evidence format is invalid or does not match the uploaded image.");
  }
  if (!metadata.width || !metadata.height || metadata.width < 160 || metadata.height < 160) {
    throw new EvidenceValidationError("The captured image is too small to use as evidence.");
  }

  const stampText = [
    `OCATMS ${input.kind} · ${input.serverReceivedAt.toISOString()}`,
    `GPS ${input.latitude.toFixed(6)}, ${input.longitude.toFixed(6)}`,
  ];
  const escapedText = stampText.map(escapeXml);
  const width = Math.min(metadata.width, 1600);
  const fontSize = Math.max(14, Math.round(width / 48));
  const padding = Math.round(fontSize * 0.8);
  const baseImage = await sharp(input.bytes, { limitInputPixels: 40_000_000 })
    .rotate()
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .toBuffer({ resolveWithObject: true });
  const stampWidth = baseImage.info.width;
  const stampHeight = fontSize * 4 + padding * 2;
  const svg = Buffer.from(
    `<svg width="${stampWidth}" height="${stampHeight}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="rgba(0,0,0,0.72)"/><text x="${padding}" y="${fontSize * 1.4}" fill="white" font-family="Arial,sans-serif" font-size="${fontSize}" font-weight="700">${escapedText[0]}</text><text x="${padding}" y="${fontSize * 2.7}" fill="white" font-family="Arial,sans-serif" font-size="${fontSize}">${escapedText[1]}</text><text x="${padding}" y="${fontSize * 3.8}" fill="white" font-family="Arial,sans-serif" font-size="${Math.max(11, Math.round(fontSize * 0.72))}">Submission stamp; presence is not independently verified.</text></svg>`,
  );
  const stampedBytes = await sharp(baseImage.data)
    .extend({ bottom: stampHeight, background: { r: 0, g: 0, b: 0, alpha: 1 } })
    .composite([{ input: svg, gravity: "south" }])
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer();

  return {
    bytes: stampedBytes,
    sha256: createHash("sha256").update(stampedBytes).digest("hex"),
    contentType,
  };
}

export async function storeEvidence(input: EvidenceInput): Promise<StoredEvidence> {
  const originalSha256 = createHash("sha256").update(input.bytes).digest("hex");
  const derivative = await buildStampedDerivative(input);
  const stampedBytes = derivative.bytes;
  const contentType = derivative.contentType;
  const id = randomUUID();
  const prefix = `${input.participantId}/${input.activityId}/${input.travelSessionId}/${id}`;
  const originalObjectKey = `${prefix}/original`;
  const stampedObjectKey = `${prefix}/stamped.jpg`;
  const stampedSha256 = derivative.sha256;
  const { client, bucket, serverSideEncryption } = getStorage();

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: originalObjectKey,
        Body: input.bytes,
        ContentType: contentType,
        ...(serverSideEncryption ? { ServerSideEncryption: serverSideEncryption } : {}),
        Metadata: {
          sha256: originalSha256,
          participant: input.participantId,
          activity: input.activityId,
          kind: input.kind.toLowerCase(),
        },
      }),
    );
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: stampedObjectKey,
        Body: stampedBytes,
        ContentType: "image/jpeg",
        ...(serverSideEncryption ? { ServerSideEncryption: serverSideEncryption } : {}),
        Metadata: { sha256: stampedSha256, originalSha256 },
      }),
    );
  } catch (error) {
    const cleanupResults = await Promise.allSettled([
      client.send(new DeleteObjectCommand({ Bucket: bucket, Key: originalObjectKey })),
      client.send(new DeleteObjectCommand({ Bucket: bucket, Key: stampedObjectKey })),
    ]);
    for (const result of cleanupResults) {
      if (result.status === "rejected") {
        console.error("Failed to clean up an incomplete private evidence upload.", result.reason);
      }
    }
    throw error;
  } finally {
    client.destroy();
  }

  return {
    id,
    originalObjectKey,
    stampedObjectKey,
    originalSha256,
    stampedSha256,
    contentType,
    originalSizeBytes: input.bytes.length,
    stampedSizeBytes: stampedBytes.length,
  };
}

export async function createPrivateEvidenceUrl(objectKey: string): Promise<string> {
  const { client, bucket } = getStorage();
  try {
    return await getSignedUrl(
      client,
      new GetObjectCommand({
        Bucket: bucket,
        Key: objectKey,
        ResponseCacheControl: "private, no-store, max-age=0",
      }),
      { expiresIn: 60 },
    );
  } finally {
    client.destroy();
  }
}

export async function deleteStoredEvidence(keys: string[]): Promise<void> {
  if (!process.env.S3_BUCKET || !process.env.S3_REGION) return;
  const { client, bucket } = getStorage();
  try {
    await Promise.all(
      keys.map((key) => client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))),
    );
  } finally {
    client.destroy();
  }
}
