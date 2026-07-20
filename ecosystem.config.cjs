/* eslint-disable */
// PM2 process definitions.
//
// Secrets are NO LONGER stored in this file. They are loaded at runtime from a
// `.env` file that lives ONLY on the server (never committed) and/or from the
// process environment (e.g. injected from AWS SSM Parameter Store by the deploy
// script). See `.env.production.example` for the full list of required keys and
// `scripts/pull-ssm-env.sh` for the SSM-backed workflow.

const fs = require("node:fs");
const path = require("node:path");

/** Minimal .env parser (no dependency). Values already in process.env win. */
function loadEnv(file) {
  const out = {};
  try {
    const raw = fs.readFileSync(file, "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      out[key] = val;
    }
  } catch {
    // No .env file present — rely on the ambient process environment instead.
  }
  return out;
}

const fileEnv = loadEnv(path.join(__dirname, ".env"));
const get = (k) => process.env[k] ?? fileEnv[k];

// Anchor PM2 to the `current` symlink on the server (NOT a resolved release
// path). Node's process.cwd() resolves symlinks, so starting with relative
// paths would pin PM2 to releases/<timestamp>; a later symlink swap + reload
// would then keep re-running the OLD release. Using the absolute symlink path
// means every reload re-resolves `current` to the newest release. Falls back to
// __dirname for local dev, where the release layout doesn't exist.
const SERVER_CURRENT = "/home/ubuntu/secretlink-releases/current";
const APP_ROOT = fs.existsSync(SERVER_CURRENT) ? SERVER_CURRENT : __dirname;
const appPath = (p) => path.join(APP_ROOT, p);

const REQUIRED = [
  "JWT_SECRET",
  "SESSION_SECRET",
  "VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
  "MASTER_KEY",
];
const missing = REQUIRED.filter((k) => !get(k));
if (missing.length > 0) {
  throw new Error(
    `[ecosystem] Missing required secrets: ${missing.join(", ")}. ` +
      `Create a .env file (see .env.production.example) or export them before starting PM2.`,
  );
}

const apiEnv = {
  NODE_ENV: "production",
  PORT: "4000",
  JWT_SECRET: get("JWT_SECRET"),
  MASTER_KEY: get("MASTER_KEY"),
  RP_ID: get("RP_ID") ?? "secretlink.life",
  RP_ORIGIN: get("RP_ORIGIN") ?? "https://secretlink.life,https://admin.secretlink.life",
  CORS_ORIGINS:
    get("CORS_ORIGINS") ??
    "https://secretlink.life,https://admin.secretlink.life,http://localhost:3000,http://localhost:3001",
  SES_REGION: get("SES_REGION") ?? "eu-north-1",
  SES_FROM: get("SES_FROM") ?? "hello@secretlink.life",
  AWS_REGION: get("AWS_REGION") ?? "eu-north-1",
  IVS_REGION: get("IVS_REGION") ?? "eu-west-1",
  VAPID_PUBLIC_KEY: get("VAPID_PUBLIC_KEY"),
  VAPID_PRIVATE_KEY: get("VAPID_PRIVATE_KEY"),
  VAPID_SUBJECT: get("VAPID_SUBJECT") ?? "mailto:ops@example.com",
  // Blob storage. Set STORAGE_DRIVER=s3 + BLOB_BUCKET to use S3 (recommended in prod).
  STORAGE_DRIVER: get("STORAGE_DRIVER") ?? "local",
  BLOB_BUCKET: get("BLOB_BUCKET") ?? "",
  PUBLIC_ORIGIN: get("PUBLIC_ORIGIN") ?? "https://secretlink.life",
};

// AWS credentials are intentionally omitted: the EC2 instance uses an IAM
// instance-profile role, so the SDK resolves credentials automatically. Only
// fall back to static keys if explicitly provided (e.g. local dev).
if (get("AWS_ACCESS_KEY_ID") && get("AWS_SECRET_ACCESS_KEY")) {
  apiEnv.AWS_ACCESS_KEY_ID = get("AWS_ACCESS_KEY_ID");
  apiEnv.AWS_SECRET_ACCESS_KEY = get("AWS_SECRET_ACCESS_KEY");
}

const sessionSecret = get("SESSION_SECRET");

// Optional Sentry config, shared by all apps. Only include keys that are
// actually set — passing SENTRY_DSN=undefined would make Sentry try (and fail)
// to initialise with an invalid DSN, so we omit it entirely when absent.
const sentryEnv = {};
for (const k of ["SENTRY_DSN", "SENTRY_RELEASE", "SENTRY_TRACES_SAMPLE_RATE"]) {
  const v = get(k);
  if (v) sentryEnv[k] = v;
}
Object.assign(apiEnv, sentryEnv);

module.exports = {
  apps: [
    {
      name: "api-gateway",
      cwd: appPath("apps/api-gateway"),
      script: appPath("node_modules/.bin/tsx"),
      args: "src/index.ts",
      interpreter: "/usr/bin/node",
      env: apiEnv,
    },
    {
      name: "web-public",
      cwd: appPath("apps/web-public"),
      script: appPath("node_modules/.bin/remix-serve"),
      args: "./build/server/index.js",
      interpreter: "/usr/bin/node",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
        SESSION_SECRET: sessionSecret,
        API_URL: get("API_URL") ?? "http://localhost:4000",
        PUBLIC_ORIGIN: get("PUBLIC_ORIGIN") ?? "https://secretlink.life",
        ...sentryEnv,
      },
    },
    {
      name: "web-admin",
      cwd: appPath("apps/web-admin"),
      script: appPath("node_modules/.bin/remix-serve"),
      args: "./build/server/index.js",
      interpreter: "/usr/bin/node",
      env: {
        NODE_ENV: "production",
        PORT: "3002",
        SESSION_SECRET: sessionSecret,
        API_URL: get("API_URL") ?? "http://localhost:4000",
        PUBLIC_ORIGIN: get("PUBLIC_ORIGIN") ?? "https://secretlink.life",
        ...sentryEnv,
      },
    },
  ],
};
