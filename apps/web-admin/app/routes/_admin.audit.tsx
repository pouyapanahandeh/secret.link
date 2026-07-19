import type { LoaderFunctionArgs } from "@remix-run/node";
import { requireAdminSession } from "~/lib/session.server";
import { adminApi } from "~/lib/api.server";
import { useLoaderData } from "@remix-run/react";
import { PageHeader } from "~/components/PageHeader";
import { ResponsiveTable } from "~/components/ResponsiveTable";

export async function loader({ request }: LoaderFunctionArgs) {
  const { token } = await requireAdminSession(request);
  const url = new URL(request.url);
  const actor = url.searchParams.get("actor") ?? "";
  const data = await adminApi(`/audit?actor=${encodeURIComponent(actor)}`, token);
  return { ...(data as any), actor };
}

export default function AuditLog() {
  const { logs, total } = useLoaderData<typeof loader>();

  const actionColors: Record<string, string> = {
    content_removed: "var(--danger)",
    user_warned: "var(--warning)",
    user_suspended: "var(--danger)",
    user_banned: "var(--danger)",
    user_unsuspended: "var(--success)",
    report_dismissed: "var(--text-muted)",
    role_changed: "var(--accent)",
    appeal_upheld: "var(--text-muted)",
    appeal_reversed: "var(--success)",
  };

  return (
    <div>
      <PageHeader title="Audit Log" count={total} />

      <div className="card overflow-hidden p-0">
        <ResponsiveTable>
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="p-3 text-left font-medium text-[var(--text-muted)]">Time</th>
                <th className="p-3 text-left font-medium text-[var(--text-muted)]">Actor</th>
                <th className="p-3 text-left font-medium text-[var(--text-muted)]">Action</th>
                <th className="p-3 text-left font-medium text-[var(--text-muted)]">Target</th>
                <th className="p-3 text-left font-medium text-[var(--text-muted)]">Details</th>
              </tr>
            </thead>
            <tbody>
              {(logs as any[]).map((log: any) => (
                <tr key={log.id} className="border-b border-[var(--border)]">
                  <td className="whitespace-nowrap p-3 text-[var(--text-muted)]">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                  <td className="p-3 text-[var(--accent)]">@{log.actor_handle}</td>
                  <td className="p-3">
                    <span style={{ color: actionColors[log.action] ?? "var(--text)" }}>
                      {log.action.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="p-3 text-[var(--text-muted)]">
                    {log.target_type}{log.target_id ? `: ${log.target_id.slice(0, 8)}…` : ""}
                  </td>
                  <td className="max-w-[200px] truncate p-3 text-[var(--text-muted)]">
                    {log.details ?? "—"}
                  </td>
                </tr>
              ))}
              {(logs as any[]).length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-[var(--text-muted)]">
                    No audit entries yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </ResponsiveTable>
      </div>
    </div>
  );
}
