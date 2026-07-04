import { promises as fs } from "node:fs";
import path from "node:path";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

// Pluggable storage for encrypted media blobs.
//   STORAGE_DRIVER=local  → on-disk .blobs/ (development only)
//   STORAGE_DRIVER=s3     → S3 bucket BLOB_BUCKET (durable, scalable, prod)
//
// Blobs are already client-side encrypted; this layer only decides where the
// opaque ciphertext lives.

const DRIVER = process.env["STORAGE_DRIVER"] ?? "local";
const BUCKET = process.env["BLOB_BUCKET"] ?? "";
const BLOB_DIR = path.resolve(process.cwd(), ".blobs");

export interface BlobStore {
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  delete(key: string): Promise<void>;
}

function isSafeKey(key: string): boolean {
  return !!key && !key.includes("..") && !key.includes("/");
}

const localStore: BlobStore = {
  async put(key, data) {
    await fs.mkdir(BLOB_DIR, { recursive: true });
    await fs.writeFile(path.join(BLOB_DIR, key), data);
  },
  async get(key) {
    if (!isSafeKey(key)) return null;
    try {
      return await fs.readFile(path.join(BLOB_DIR, key));
    } catch {
      return null;
    }
  },
  async delete(key) {
    if (!isSafeKey(key)) return;
    await fs.unlink(path.join(BLOB_DIR, key)).catch(() => {});
  },
};

function createS3Store(): BlobStore {
  if (!BUCKET) throw new Error("STORAGE_DRIVER=s3 requires BLOB_BUCKET to be set");
  const s3 = new S3Client({ region: process.env["AWS_REGION"] ?? "eu-north-1" });
  const prefix = "blobs/";

  async function streamToBuffer(body: unknown): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of body as AsyncIterable<Uint8Array>) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  return {
    async put(key, data) {
      await s3.send(
        new PutObjectCommand({
          Bucket: BUCKET,
          Key: prefix + key,
          Body: data,
          ContentType: "application/octet-stream",
        }),
      );
    },
    async get(key) {
      if (!isSafeKey(key)) return null;
      try {
        const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: prefix + key }));
        if (!res.Body) return null;
        return await streamToBuffer(res.Body);
      } catch {
        return null;
      }
    },
    async delete(key) {
      if (!isSafeKey(key)) return;
      await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: prefix + key })).catch(() => {});
    },
  };
}

export const blobStore: BlobStore = DRIVER === "s3" ? createS3Store() : localStore;
