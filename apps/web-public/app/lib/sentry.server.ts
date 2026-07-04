import * as Sentry from "@sentry/node";

// Server-side error monitoring for the Remix app. No-op unless SENTRY_DSN is
// set, so it is safe to ship without any account configured.

let enabled = false;

function ensureInit(): void {
  if (enabled) return;
  const dsn = process.env["SENTRY_DSN"];
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: process.env["NODE_ENV"] ?? "development",
    release: process.env["SENTRY_RELEASE"],
    tracesSampleRate: Number(process.env["SENTRY_TRACES_SAMPLE_RATE"] ?? 0),
  });
  enabled = true;
}

ensureInit();

export function captureRemixError(error: unknown, request: Request): void {
  if (!enabled) return;
  // Remix models 404s and redirects as thrown Responses — those aren't bugs.
  if (error instanceof Response) return;
  Sentry.captureException(error, {
    extra: { url: request.url, method: request.method },
  });
}
