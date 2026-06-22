import type { LoaderFunctionArgs } from "@remix-run/node";
import { requireAdminSession } from "~/lib/session.server";
import { adminApi } from "~/lib/api.server";
import { useLoaderData } from "@remix-run/react";

export async function loader({ request }: LoaderFunctionArgs) {
  const { token } = await requireAdminSession(request);
  const data = await adminApi("/transparency", token);
  return { stats: data as any };
}

export default function Transparency() {
  const { stats } = useLoaderData<typeof loader>();

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Transparency Report</h2>
      <p className="text-sm text-[var(--text-muted)] mb-6">
        Period: {new Date(stats.period.from).toLocaleDateString()} — {new Date(stats.period.to).toLocaleDateString()}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Reports */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">🚩 Reports</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Total received</span>
              <span className="font-medium">{stats.reports.total}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Actioned</span>
              <span className="font-medium text-[var(--success)]">{stats.reports.actioned}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Dismissed</span>
              <span className="font-medium">{stats.reports.dismissed}</span>
            </div>
            {stats.reports.byReason.length > 0 && (
              <div className="pt-2 border-t border-[var(--border)]">
                <p className="text-[var(--text-muted)] mb-1">By reason:</p>
                {stats.reports.byReason.map((r: any) => (
                  <div key={r.reason} className="flex justify-between">
                    <span className="text-[var(--text-muted)]">{r.reason}</span>
                    <span>{r.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">⚡ Actions Taken</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Content removals</span>
              <span className="font-medium">{stats.actions.removals}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Warnings issued</span>
              <span className="font-medium">{stats.actions.warnings}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Suspensions</span>
              <span className="font-medium">{stats.actions.suspensions}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Permanent bans</span>
              <span className="font-medium text-[var(--danger)]">{stats.actions.bans}</span>
            </div>
          </div>
        </div>

        {/* Appeals */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">⚖️ Appeals</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Total received</span>
              <span className="font-medium">{stats.appeals.total}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Upheld (original decision)</span>
              <span className="font-medium">{stats.appeals.upheld}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Reversed (user vindicated)</span>
              <span className="font-medium text-[var(--success)]">{stats.appeals.reversed}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
