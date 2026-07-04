import * as Sentry from "@sentry/node";

// Error monitoring. This is a complete no-op unless SENTRY_DSN is set, so it is
// safe to ship without any account configured. When a DSN is present, unhandled
// server errors are reported to Sentry. Tracing is disabled by default to keep
// overhead and event volume low; set SENTRY_TRACES_SAMPLE_RATE to enable it.

let enabled = false;

export function initSentry(): void {
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

export function captureException(err: unknown, extra?: Record<string, unknown>): void {
  if (!enabled) return;
  Sentry.captureException(err, extra ? { extra } : undefined);
}

export async function flushSentry(timeoutMs = 2000): Promise<void> {
  if (!enabled) return;
  try {
    await Sentry.flush(timeoutMs);
  } catch {
    // Never let telemetry flushing block or crash shutdown.
  }
}
