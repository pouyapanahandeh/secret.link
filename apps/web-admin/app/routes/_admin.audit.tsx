import type { LoaderFunctionArgs } from "@remix-run/node";
import { requireAdminSession } from "~/lib/session.server";
import { adminApi } from "~/lib/api.server";
import { useLoaderData } from "@remix-run/react";

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
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Audit Log</h2>
        <span className="text-sm text-[var(--text-muted)]">{total} entries</span>
      </div>

      <div className="card overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="text-left p-3 text-[var(--text-muted)] font-medium">Time</th>
              <th className="text-left p-3 text-[var(--text-muted)] font-medium">Actor</th>
              <th className="text-left p-3 text-[var(--text-muted)] font-medium">Action</th>
              <th className="text-left p-3 text-[var(--text-muted)] font-medium">Target</th>
              <th className="text-left p-3 text-[var(--text-muted)] font-medium">Details</th>
            </tr>
          </thead>
          <tbody>
            {(logs as any[]).map((log: any) => (
              <tr key={log.id} className="border-b border-[var(--border)]">
                <td className="p-3 text-[var(--text-muted)] whitespace-nowrap">
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
                <td className="p-3 text-[var(--text-muted)] max-w-[200px] truncate">
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
      </div>
    </div>
  );
}
