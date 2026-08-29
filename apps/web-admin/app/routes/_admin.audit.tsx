import type { LoaderFunctionArgs } from "@remix-run/node";
import { Form, useLoaderData, useSearchParams } from "@remix-run/react";
import { EmptyState } from "~/components/EmptyState";
import { NavIcon } from "~/components/NavIcon";
import { PageHeader } from "~/components/PageHeader";
import { ResponsiveTable } from "~/components/ResponsiveTable";
import { adminApi } from "~/lib/api.server";
import { requireAdminSession } from "~/lib/session.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { token } = await requireAdminSession(request);
  const url = new URL(request.url);
  const actor = url.searchParams.get("actor") ?? "";
  const data = await adminApi(`/audit?actor=${encodeURIComponent(actor)}`, token);
  return { ...(data as { logs: AuditLog[]; total: number }), actor };
}

interface AuditLog {
  id: string;
  created_at: string;
  actor_handle: string;
  action: string;
  target_type: string;
  target_id?: string | null;
  details?: string | null;
}

const actionColors: Record<string, string> = {
  content_removed: "var(--color-danger)",
  user_warned: "var(--color-warning)",
  user_suspended: "var(--color-danger)",
  user_banned: "var(--color-danger)",
  user_unsuspended: "var(--color-success)",
  report_dismissed: "var(--color-text-muted)",
  role_changed: "var(--color-accent)",
  appeal_upheld: "var(--color-text-muted)",
  appeal_reversed: "var(--color-success)",
};

function ActionLabel({ action }: { action: string }) {
  return (
    <span className="font-medium capitalize" style={{ color: actionColors[action] ?? "var(--color-text)" }}>
      {action.replace(/_/g, " ")}
    </span>
  );
}

export default function AuditLog() {
  const { logs, total, actor } = useLoaderData<typeof loader>();
  const [, setSearchParams] = useSearchParams();

  return (
    <div>
      <PageHeader title="Audit log" count={total} />

      <Form
        className="mb-6"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const next = String(fd.get("actor") ?? "");
          setSearchParams(next ? { actor: next } : {});
        }}
      >
        <input
          name="actor"
          defaultValue={actor}
          placeholder="Filter by actor handle..."
          className="input w-full sm:max-w-sm"
        />
      </Form>

      {logs.length === 0 ? (
        <EmptyState
          icon={<NavIcon name="audit" className="h-8 w-8" />}
          title="No audit entries"
          description="Moderation actions will show up here as a timeline."
        />
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {logs.map((log) => (
              <div key={log.id} className="card">
                <div className="flex items-start justify-between gap-3">
                  <ActionLabel action={log.action} />
                  <span className="shrink-0 font-mono text-[10px] text-text-muted">
                    {new Date(log.created_at).toLocaleString()}
                  </span>
                </div>
                <p className="mt-2 text-sm text-accent">@{log.actor_handle}</p>
                <p className="mt-1 text-xs text-text-muted">
                  {log.target_type}
                  {log.target_id ? `: ${log.target_id.slice(0, 8)}…` : ""}
                </p>
                {log.details && <p className="mt-2 text-sm text-text-muted">{log.details}</p>}
              </div>
            ))}
          </div>

          <div className="card hidden overflow-hidden p-0 md:block">
            <ResponsiveTable>
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="p-3 text-left font-medium text-text-muted">Time</th>
                    <th className="p-3 text-left font-medium text-text-muted">Actor</th>
                    <th className="p-3 text-left font-medium text-text-muted">Action</th>
                    <th className="p-3 text-left font-medium text-text-muted">Target</th>
                    <th className="p-3 text-left font-medium text-text-muted">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b border-border last:border-0 hover:bg-surface-hover">
                      <td className="whitespace-nowrap p-3 font-mono text-xs text-text-muted">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="p-3 text-accent">@{log.actor_handle}</td>
                      <td className="p-3">
                        <ActionLabel action={log.action} />
                      </td>
                      <td className="p-3 text-text-muted">
                        {log.target_type}
                        {log.target_id ? `: ${log.target_id.slice(0, 8)}…` : ""}
                      </td>
                      <td className="max-w-[220px] truncate p-3 text-text-muted">{log.details ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ResponsiveTable>
          </div>
        </>
      )}
    </div>
  );
}
