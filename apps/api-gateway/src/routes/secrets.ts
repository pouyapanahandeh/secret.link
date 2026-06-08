import Router from "@koa/router";
import { createSecret, revealSecret } from "@secretlink/core";
import { nanoid } from "nanoid";
import type { Context } from "koa";

export const secretsRouter = new Router({ prefix: "/secrets" });

// In-memory store for development; replaced by Redis/Cloud SQL adapters in production
const store = new Map<string, {
  id: string;
  ciphertext: string;
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
      if (r) store.set(id, { ...r, burned: true });
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
