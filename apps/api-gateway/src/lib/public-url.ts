import type { Context } from "koa";

/** Browser-reachable API origin (no /v1 suffix). */
export function getPublicApiBase(ctx?: Pick<Context, "get" | "protocol" | "host">): string {
  const fromEnv = process.env["PUBLIC_API_URL"] ?? process.env["PUBLIC_ORIGIN"];
  if (fromEnv) return fromEnv.replace(/\/v1\/?$/, "").replace(/\/$/, "");

  if (ctx) {
    const forwardedHost = ctx.get("X-Forwarded-Host");
    const host = forwardedHost || ctx.host || "";
    if (host && !host.includes("localhost") && !host.startsWith("127.0.0.1")) {
      const proto = ctx.get("X-Forwarded-Proto") || ctx.protocol || "https";
      return `${proto}://${host}`;
    }
  }

  return "https://secretlink.life";
}

export function publicBlobUrl(blobPath: string, ctx?: Pick<Context, "get" | "protocol" | "host">): string {
  return `${getPublicApiBase(ctx)}/v1/secrets/blob/${blobPath}`;
}
