function getApiUrl(): string {
  const url = process.env["API_URL"];
  if (!url) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("API_URL environment variable is required in production");
    }
    return "http://localhost:4000";
  }
  return url;
}

export const API_URL = getApiUrl();

/**
 * Browser-facing API origin. `API_URL` is the server-to-server address
 * (often http://localhost:4000 on the box) and must not be sent to the client.
 */
export function publicApiBase(request: Request): string {
  const url = new URL(request.url);
  const host = (request.headers.get("x-forwarded-host") ?? url.host).split(",")[0]!.trim();
  const forwarded = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const proto =
    forwarded ||
    (host.includes("localhost") || host.startsWith("127.") ? url.protocol.replace(":", "") : "https");
  return `${proto}://${host}`.replace(/:3000$/, ":4000").replace(/:3001$/, ":4000");
}
