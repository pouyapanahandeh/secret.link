import Koa from "koa";
import bodyParser from "koa-bodyparser";
import cors from "@koa/cors";
import helmet from "koa-helmet";
import compress from "koa-compress";
import { pinoLogger } from "./middleware/logger.js";
import { errorHandler } from "./middleware/error-handler.js";
import { rateLimiter } from "./middleware/rate-limiter.js";
import { optionalAuth } from "./middleware/auth.js";
import { router } from "./routes/index.js";
import { startDeletionJob } from "./jobs/deletion.js";
import { initSentry, flushSentry } from "./lib/sentry.js";

// Initialise error monitoring before anything else. No-op unless SENTRY_DSN set.
initSentry();

const app = new Koa();

// Trust the reverse proxy so ctx.ip reflects the real client IP from
// X-Forwarded-For (nginx is configured to overwrite XFF with $remote_addr).
app.proxy = true;

// Allowed origins for CORS
const ALLOWED_ORIGINS = (process.env["CORS_ORIGINS"] ?? "http://localhost:3000,http://localhost:3001")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// Response compression (skips SSE, which sets its own headers).
app.use(compress({ threshold: 1024 }));

// Security & parsing
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: (ctx) => {
    const requestOrigin = ctx.get("Origin");
    if (ALLOWED_ORIGINS.includes(requestOrigin)) return requestOrigin;
    return "";
  },
  credentials: true,
}));
app.use(async (ctx, next) => {
  // Skip body parsing for blob upload (raw binary)
  if (ctx.path === "/v1/secrets/blob" && ctx.method === "POST") {
    return next();
  }
  return bodyParser({ jsonLimit: "1mb" })(ctx, next);
});

// Optional auth (populates ctx.state.user if token present, but doesn't reject)
app.use(optionalAuth());

// Rate limiting, logging & error handling
app.use(rateLimiter());
app.use(pinoLogger());
app.use(errorHandler());

// Routes
app.use(router.routes());
app.use(router.allowedMethods());

const port = Number(process.env["PORT"] ?? 4000);

if (process.env["NODE_ENV"] !== "test") {
  const server = app.listen(port, () => {
    console.log(`API Gateway listening on :${port}`);
  });
  // Background job: execute due GDPR account-deletion requests.
  startDeletionJob();

  // Graceful shutdown: stop accepting connections and flush pending error events.
  const shutdown = (signal: string) => {
    console.log(`Received ${signal}, shutting down...`);
    server.close(() => {
      void flushSentry().finally(() => process.exit(0));
    });
    // Hard cap so a stuck connection can't block the restart indefinitely.
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

export { app };
