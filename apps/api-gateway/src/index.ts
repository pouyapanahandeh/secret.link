import Koa from "koa";
import bodyParser from "koa-bodyparser";
import cors from "@koa/cors";
import helmet from "koa-helmet";
import { pinoLogger } from "./middleware/logger.js";
import { errorHandler } from "./middleware/error-handler.js";
import { rateLimiter } from "./middleware/rate-limiter.js";
import { optionalAuth } from "./middleware/auth.js";
import { router } from "./routes/index.js";

const app = new Koa();

// Allowed origins for CORS
const ALLOWED_ORIGINS = (process.env["CORS_ORIGINS"] ?? "http://localhost:3000,http://localhost:3001")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// Security & parsing
app.use(helmet());
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
  app.listen(port, () => {
    console.log(`API Gateway listening on :${port}`);
  });
}

export { app };
