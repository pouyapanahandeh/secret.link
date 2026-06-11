import Router from "@koa/router";
import { createSecret, revealSecret } from "@secretlink/core";
import type { ContentType } from "@secretlink/core";
import { nanoid } from "nanoid";
import type { Context } from "koa";
import { promises as fs } from "node:fs";
import path from "node:path";

export const secretsRouter = new Router({ prefix: "/secrets" });

// Local blob storage directory for development
const BLOB_DIR = path.resolve(process.cwd(), ".blobs");
fs.mkdir(BLOB_DIR, { recursive: true }).catch(() => {});

// In-memory store for development; replaced by Redis/Cloud SQL adapters in production
const store = new Map<string, {
  id: string;
  ciphertext: string;
  contentType: ContentType;
  blobPath?: string;
  blobSizeBytes?: number;
  mimeType?: string;
  nonce?: string;
  viewDurationSeconds?: number;
  maxViews: number;
  viewCount: number;
  createdAt: Date;
  expiresAt: Date;
  workspaceId?: string;
  recipientHandle?: string;
  burned: boolean;
}>();

const deps = {
  repo: {
    save: async (record: Parameters<typeof store.set>[1]) => {
      store.set(record.id, record);
    },
    findById: async (id: string) => store.get(id) ?? null,
    incrementViewCount: async (id: string) => {
      const r = store.get(id);
      if (r) store.set(id, { ...r, viewCount: r.viewCount + 1 });
    },
    burn: async (id: string) => {
      const r = store.get(id);
      if (r) {
        store.set(id, { ...r, burned: true });
        // Delay blob deletion to give client time to download
        if (r.blobPath) {
          setTimeout(() => {
            fs.unlink(path.join(BLOB_DIR, r.blobPath!)).catch(() => {});
          }, 60_000); // 60 seconds grace period
        }
      }
    },
  },
  kms: { wrap: async (_dek: Uint8Array, _wsId?: string) => "wrapped-key" },
  clock: { now: () => new Date() },
  id: () => nanoid(),
};

secretsRouter.post("/", async (ctx: Context) => {
  const result = await createSecret(deps)(ctx.request.body);
  result.match(
    (val) => {
      ctx.status = 201;
      ctx.body = val;
    },
    (e) => {
      ctx.status = e.kind === "invalid_input" ? 400 : 500;
      ctx.body = { error: e.kind };
    },
  );
});

secretsRouter.get("/:id", async (ctx: Context) => {
  const result = await revealSecret(deps)(ctx.params["id"]!);
  result.match(
    (val) => {
      ctx.status = 200;
      ctx.body = val;
    },
    (e) => {
      const statusMap = {
        not_found: 404,
        expired: 410,
        max_views_reached: 410,
        burned: 410,
        storage_error: 500,
      } as const;
      ctx.status = statusMap[e.kind];
      ctx.body = { error: e.kind };
    },
  );
});

// Upload encrypted blob (binary body)
// Client sends encrypted file data directly; returns the blob path
secretsRouter.post("/blob", async (ctx: Context) => {
  const MAX_SIZE = 50 * 1024 * 1024; // 50MB

  // Read raw body
  const chunks: Buffer[] = [];
  let totalSize = 0;

  await new Promise<void>((resolve, reject) => {
    ctx.req.on("data", (chunk: Buffer) => {
      totalSize += chunk.length;
      if (totalSize > MAX_SIZE) {
        reject(new Error("File too large"));
        return;
      }
      chunks.push(chunk);
    });
    ctx.req.on("end", resolve);
    ctx.req.on("error", reject);
  });

  const blobId = nanoid();
  const blobPath = `${blobId}.bin`;
  await fs.writeFile(path.join(BLOB_DIR, blobPath), Buffer.concat(chunks));

  ctx.status = 201;
  ctx.body = { blobPath, sizeBytes: totalSize };
});

// Download encrypted blob
secretsRouter.get("/blob/:path", async (ctx: Context) => {
  const blobPath = ctx.params["path"];
  if (!blobPath || blobPath.includes("..") || blobPath.includes("/")) {
    ctx.status = 400;
    ctx.body = { error: "invalid_path" };
    return;
  }

  const filePath = path.join(BLOB_DIR, blobPath);
  try {
    const data = await fs.readFile(filePath);
    ctx.status = 200;
    ctx.type = "application/octet-stream";
    ctx.body = data;
  } catch {
    ctx.status = 404;
    ctx.body = { error: "blob_not_found" };
  }
});

// ─── Inbox: Get secrets sent TO a handle ────────────────────────────────────
secretsRouter.get("/inbox/:handle", async (ctx: Context) => {
  const handle = ctx.params["handle"];
  const secrets: any[] = [];

  for (const s of store.values()) {
    if (s.recipientHandle === handle && !s.burned) {
      secrets.push({
        id: s.id,
        contentType: s.contentType,
        createdAt: s.createdAt,
        viewCount: s.viewCount,
        maxViews: s.maxViews,
        burned: s.burned,
      });
    }
  }

  // Sort newest first
  secrets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  ctx.body = secrets;
});

// ─── Sent: Get secrets sent BY a user ───────────────────────────────────────
secretsRouter.get("/sent/:userId", async (ctx: Context) => {
  const userId = ctx.params["userId"];
  const secrets: any[] = [];

  for (const s of store.values()) {
    if ((s as any).senderId === userId) {
      secrets.push({
        id: s.id,
        contentType: s.contentType,
        recipientHandle: s.recipientHandle,
        createdAt: s.createdAt,
        viewCount: s.viewCount,
        maxViews: s.maxViews,
        burned: s.burned,
      });
    }
  }

  secrets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  ctx.body = secrets;
});
