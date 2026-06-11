import Koa from "koa";
import bodyParser from "koa-bodyparser";
import cors from "@koa/cors";
import helmet from "koa-helmet";
import { pinoLogger } from "./middleware/logger.js";
import { errorHandler } from "./middleware/error-handler.js";
import { rateLimiter } from "./middleware/rate-limiter.js";
import { router } from "./routes/index.js";

const app = new Koa();

// Security & parsing
app.use(helmet());
app.use(cors({ origin: process.env["CORS_ORIGIN"] ?? "*", credentials: true }));
app.use(async (ctx, next) => {
  // Skip body parsing for blob upload (raw binary)
  if (ctx.path === "/v1/secrets/blob" && ctx.method === "POST") {
    return next();
  }
  return bodyParser({ jsonLimit: "1mb" })(ctx, next);
});

// Rate limiting, logging & error handling
app.use(rateLimiter());
app.use(pinoLogger());
app.use(errorHandler());

// Routes
app.use(router.routes());
app.use(router.allowedMethods());

const port = Number(process.env["PORT"] ?? 4000);

app.listen(port, () => {
  console.log(`API Gateway listening on :${port}`);
});

export { app };
