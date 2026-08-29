import type { LoaderFunctionArgs } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { adminApi } from "~/lib/api.server";
import { requireSuperAdminSession } from "~/lib/session.server";
import { PageHeader } from "~/components/PageHeader";

type CheckStatus = "ok" | "error" | "warn" | "skipped";

interface StatusCheck {
  name: string;
  status: CheckStatus;
  message?: string;
  latencyMs?: number;
  details?: Record<string, unknown>;
}

interface SystemStatus {
  overall: "ok" | "degraded" | "down";
  checkedAt: string;
  services: StatusCheck[];
  instances: StatusCheck[];
  endpoints: StatusCheck[];
}

export async function loader({ request }: LoaderFunctionArgs) {
  const { token } = await requireSuperAdminSession(request);
  const status = (await adminApi("/status", token)) as SystemStatus;
  return { status };
}

function statusColor(status: CheckStatus | SystemStatus["overall"]) {
  if (status === "ok") return "var(--color-success)";
  if (status === "degraded" || status === "warn") return "var(--color-warning)";
  if (status === "skipped") return "var(--color-text-muted)";
  return "var(--color-danger)";
}

function statusLabel(status: CheckStatus | SystemStatus["overall"]) {
  if (status === "ok") return "OK";
  if (status === "degraded") return "Degraded";
  if (status === "down") return "Down";
  if (status === "warn") return "Warning";
  if (status === "skipped") return "Skipped";
  return "Error";
}

function formatLatency(ms?: number) {
  if (ms == null) return "—";
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(2)} s`;
}

function formatUptime(ms?: unknown) {
  if (typeof ms !== "number" || ms <= 0) return null;
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ${min % 60}m`;
  const day = Math.floor(hr / 24);
  return `${day}d ${hr % 24}h`;
}

function latencyWidth(ms?: number) {
  if (ms == null) return 0;
  return Math.min(100, (ms / 2000) * 100);
}

function CheckCards({ checks, showUrl = false }: { checks: StatusCheck[]; showUrl?: boolean }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {checks.map((check) => (
        <div key={check.name} className="rounded-2xl border border-border bg-surface p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={`h-2.5 w-2.5 shrink-0 rounded-full ${check.status === "ok" ? "animate-pulse" : ""}`}
                  style={{ background: statusColor(check.status) }}
                />
                <h3 className="truncate font-semibold">{check.name}</h3>
              </div>
              <p className="mt-1 text-sm text-text-muted">{check.message ?? "—"}</p>
              {showUrl && check.details?.url ? (
                <p className="mt-1 truncate font-mono text-[10px] text-text-muted/70">{String(check.details.url)}</p>
              ) : null}
              {check.details?.pid != null ? (
                <p className="mt-1 font-mono text-[10px] text-text-muted">
                  PID {String(check.details.pid)}
                  {formatUptime(check.details.uptimeMs) ? ` · up ${formatUptime(check.details.uptimeMs)}` : ""}
                  {check.details.restarts != null ? ` · restarts ${String(check.details.restarts)}` : ""}
                </p>
              ) : null}
            </div>
            <span
              className="badge shrink-0"
              style={{
                background: `${statusColor(check.status)}22`,
                color: statusColor(check.status),
              }}
            >
              {statusLabel(check.status)}
            </span>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-raised">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${latencyWidth(check.latencyMs)}%`,
                  background: statusColor(check.status),
                }}
              />
            </div>
            <span className="font-mono text-[10px] tabular-nums text-text-muted">{formatLatency(check.latencyMs)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function StatusPage() {
  const { status } = useLoaderData<typeof loader>();
  const okCount = [...status.services, ...status.instances, ...status.endpoints].filter((c) => c.status === "ok").length;
  const totalCount = status.services.length + status.instances.length + status.endpoints.length;

  return (
    <div>
      <PageHeader
        title="System status"
        subtitle={`Checked ${new Date(status.checkedAt).toLocaleString()}`}
        actions={
          <Link to="/status" className="btn btn-outline text-sm">
            Refresh
          </Link>
        }
      />

      <div className="card mb-6 overflow-hidden p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span
              className={`h-3 w-3 rounded-full ${status.overall === "ok" ? "animate-pulse" : ""}`}
              style={{ background: statusColor(status.overall) }}
            />
            <div>
              <p className="label-mono">Overall</p>
              <p className="mt-0.5 text-2xl font-extrabold tracking-tight" style={{ color: statusColor(status.overall) }}>
                {status.overall === "ok" ? "All systems operational" : statusLabel(status.overall)}
              </p>
            </div>
          </div>
          <p className="font-mono text-sm tabular-nums text-text-muted">
            {okCount}/{totalCount} checks passing
          </p>
        </div>
      </div>

      <div className="space-y-8">
        <section>
          <h2 className="label-mono mb-3">Core services</h2>
          <CheckCards checks={status.services} />
        </section>
        <section>
          <h2 className="label-mono mb-3">PM2 instances</h2>
          <CheckCards checks={status.instances} />
        </section>
        <section>
          <h2 className="label-mono mb-3">Endpoint probes</h2>
          <p className="mb-3 text-xs text-text-muted">Live HTTP requests sent when this page was loaded.</p>
          <CheckCards checks={status.endpoints} showUrl />
        </section>
      </div>
    </div>
  );
}
