import { execFile } from "node:child_process";
import { promisify } from "node:util";
import db from "../db.js";
import { blobStore } from "./blob-store.js";

const execFileAsync = promisify(execFile);

export type CheckStatus = "ok" | "error" | "warn" | "skipped";

export interface StatusCheck {
  name: string;
  status: CheckStatus;
  message?: string;
  latencyMs?: number;
  details?: Record<string, unknown>;
}

export interface SystemStatus {
  overall: "ok" | "degraded" | "down";
  checkedAt: string;
  services: StatusCheck[];
  instances: StatusCheck[];
  endpoints: StatusCheck[];
}

const API_BASE = process.env["API_URL"] ?? "http://127.0.0.1:4000";
const WEB_PUBLIC_URL = process.env["WEB_PUBLIC_URL"] ?? "http://127.0.0.1:3000";
const WEB_ADMIN_URL = process.env["WEB_ADMIN_URL"] ?? "http://127.0.0.1:3002";
const PROBE_TIMEOUT_MS = 8_000;

async function probe(
  name: string,
  url: string,
  options: {
    expectStatus?: number | number[];
    validateJson?: (body: unknown) => boolean;
  } = {},
): Promise<StatusCheck> {
  const start = Date.now();
  const expect = options.expectStatus ?? 200;
  const allowed = Array.isArray(expect) ? expect : [expect];

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "secretlink-status/1.0" },
      redirect: "manual",
    });
    clearTimeout(timer);

    const latencyMs = Date.now() - start;
    if (!allowed.includes(res.status)) {
      return {
        name,
        status: "error",
        message: `HTTP ${res.status}`,
        latencyMs,
        details: { url },
      };
    }

    if (options.validateJson) {
      const body = await res.json();
      if (!options.validateJson(body)) {
        return {
          name,
          status: "error",
          message: "Unexpected response body",
          latencyMs,
          details: { url },
        };
      }
    }

    return {
      name,
      status: "ok",
      message: `HTTP ${res.status}`,
      latencyMs,
      details: { url },
    };
  } catch (err) {
    return {
      name,
      status: "error",
      message: err instanceof Error ? err.message : "Request failed",
      latencyMs: Date.now() - start,
      details: { url },
    };
  }
}

async function checkDatabase(): Promise<StatusCheck> {
  const start = Date.now();
  try {
    db.prepare("SELECT 1 AS ok").get();
    return {
      name: "Database",
      status: "ok",
      message: "SQLite reachable",
      latencyMs: Date.now() - start,
    };
  } catch (err) {
    return {
      name: "Database",
      status: "error",
      message: err instanceof Error ? err.message : "Query failed",
      latencyMs: Date.now() - start,
    };
  }
}

async function checkBlobStorage(): Promise<StatusCheck> {
  const start = Date.now();
  const testKey = `_status_${Date.now()}`;
  const driver = process.env["STORAGE_DRIVER"] ?? "local";

  try {
    await blobStore.put(testKey, Buffer.from("ok"));
    const data = await blobStore.get(testKey);
    await blobStore.delete(testKey);

    if (data?.toString() !== "ok") {
      return {
        name: "Blob storage",
        status: "error",
        message: "Read/write mismatch",
        latencyMs: Date.now() - start,
        details: { driver },
      };
    }

    return {
      name: "Blob storage",
      status: "ok",
      message: driver === "s3" ? `S3 (${process.env["BLOB_BUCKET"] ?? "bucket"})` : "Local disk",
      latencyMs: Date.now() - start,
      details: { driver },
    };
  } catch (err) {
    await blobStore.delete(testKey).catch(() => {});
    return {
      name: "Blob storage",
      status: "error",
      message: err instanceof Error ? err.message : "Storage check failed",
      latencyMs: Date.now() - start,
      details: { driver },
    };
  }
}

async function checkPm2Instances(): Promise<StatusCheck[]> {
  try {
    const { stdout } = await execFileAsync("pm2", ["jlist"], { timeout: 5_000 });
    const processes = JSON.parse(stdout) as Array<{
      name?: string;
      pid?: number;
      pm2_env?: { status?: string; pm_uptime?: number; restart_time?: number };
    }>;

    const expected = ["api-gateway", "web-public", "web-admin"];
    return expected.map((name) => {
      const proc = processes.find((p) => p.name === name);
      if (!proc) {
        return { name, status: "error" as const, message: "Process not registered in PM2" };
      }

      const online = proc.pm2_env?.status === "online";
      const uptimeMs = proc.pm2_env?.pm_uptime ? Date.now() - proc.pm2_env.pm_uptime : undefined;

      return {
        name,
        status: online ? ("ok" as const) : ("error" as const),
        message: online ? "Online" : `Status: ${proc.pm2_env?.status ?? "unknown"}`,
        details: {
          pid: proc.pid,
          uptimeMs,
          restarts: proc.pm2_env?.restart_time,
        },
      };
    });
  } catch {
    return [
      {
        name: "PM2",
        status: "skipped",
        message: "PM2 not available (local dev or not installed)",
      },
    ];
  }
}

function overallStatus(checks: StatusCheck[]): SystemStatus["overall"] {
  const actionable = checks.filter((c) => c.status !== "skipped");
  if (actionable.some((c) => c.status === "error")) {
    const errors = actionable.filter((c) => c.status === "error").length;
    const total = actionable.length;
    return errors === total ? "down" : "degraded";
  }
  if (actionable.some((c) => c.status === "warn")) return "degraded";
  return "ok";
}

export async function runSystemStatusChecks(): Promise<SystemStatus> {
  const services = await Promise.all([checkDatabase(), checkBlobStorage()]);

  const instances = await checkPm2Instances();

  const endpoints = await Promise.all([
    probe("API health", `${API_BASE}/v1/health`, {
      validateJson: (body) => {
        const data = body as { status?: string; checks?: { db?: string } };
        return data.status === "ok" && data.checks?.db === "ok";
      },
    }),
    probe("Map secrets", `${API_BASE}/v1/secrets/map`),
    probe("Public blog", `${API_BASE}/v1/public/blog?limit=1`),
    probe("Transparency", `${API_BASE}/v1/public/transparency`),
    probe("Web public", WEB_PUBLIC_URL, { expectStatus: [200, 302, 307, 308] }),
    probe("Web admin", WEB_ADMIN_URL, { expectStatus: [200, 302, 307, 308] }),
  ]);

  const allChecks = [...services, ...instances, ...endpoints];
  return {
    overall: overallStatus(allChecks),
    checkedAt: new Date().toISOString(),
    services,
    instances,
    endpoints,
  };
}
