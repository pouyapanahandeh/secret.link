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
  if (status === "ok") return "var(--success)";
  if (status === "degraded" || status === "warn") return "var(--warning)";
  if (status === "skipped") return "var(--text-muted)";
  return "var(--danger)";
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

function CheckTable({ checks, showUrl = false }: { checks: StatusCheck[]; showUrl?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] text-left text-[var(--text-muted)]">
            <th className="pb-2 pr-4 font-medium">Name</th>
            <th className="pb-2 pr-4 font-medium">Status</th>
            <th className="pb-2 pr-4 font-medium">Details</th>
            <th className="pb-2 font-medium">Latency</th>
          </tr>
        </thead>
        <tbody>
          {checks.map((check) => (
            <tr key={check.name} className="border-b border-[var(--border)]/60 last:border-0">
              <td className="py-3 pr-4 font-medium text-[var(--text)]">{check.name}</td>
              <td className="py-3 pr-4">
                <span
                  className="badge"
                  style={{
                    background: `${statusColor(check.status)}22`,
                    color: statusColor(check.status),
                  }}
                >
                  {statusLabel(check.status)}
                </span>
              </td>
              <td className="py-3 pr-4 text-[var(--text-muted)]">
                <div>{check.message ?? "—"}</div>
                {showUrl && check.details?.url ? (
                  <div className="mt-1 truncate text-xs opacity-70">{String(check.details.url)}</div>
                ) : null}
                {check.details?.pid != null ? (
                  <div className="mt-1 text-xs opacity-70">
                    PID {String(check.details.pid)}
                    {formatUptime(check.details.uptimeMs) ? ` · up ${formatUptime(check.details.uptimeMs)}` : ""}
                    {check.details.restarts != null ? ` · restarts ${String(check.details.restarts)}` : ""}
                  </div>
                ) : null}
              </td>
              <td className="py-3 text-[var(--text-muted)]">{formatLatency(check.latencyMs)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function StatusPage() {
  const { status } = useLoaderData<typeof loader>();

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <PageHeader title="System Status" />
        <Link to="/status" className="btn btn-outline text-sm">
          Refresh
        </Link>
      </div>

      <div className="card mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Overall</p>
            <p className="mt-1 text-2xl font-bold" style={{ color: statusColor(status.overall) }}>
              {status.overall === "ok" ? "All systems operational" : statusLabel(status.overall)}
            </p>
          </div>
          <div className="text-right text-sm text-[var(--text-muted)]">
            <p>Checked on page load</p>
            <p>{new Date(status.checkedAt).toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <section className="card">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Core services
          </h2>
          <CheckTable checks={status.services} />
        </section>

        <section className="card">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            PM2 instances
          </h2>
          <CheckTable checks={status.instances} />
        </section>

        <section className="card">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Endpoint probes
          </h2>
          <p className="mb-4 text-xs text-[var(--text-muted)]">
            Live HTTP requests sent when this page was loaded.
          </p>
          <CheckTable checks={status.endpoints} showUrl />
        </section>
      </div>
    </div>
  );
}
