import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { requireAdminSession } from "~/lib/session.server";
import { adminApi } from "~/lib/api.server";
import { useLoaderData, useSearchParams, Form, useNavigation } from "@remix-run/react";

export async function loader({ request }: LoaderFunctionArgs) {
  const { token } = await requireAdminSession(request);
  const url = new URL(request.url);
  const status = url.searchParams.get("status") ?? "open";
  const data = await adminApi(`/reports?status=${status}`, token);
  return { ...(data as any), currentStatus: status };
}

export async function action({ request }: ActionFunctionArgs) {
  const { token } = await requireAdminSession(request);
  const formData = await request.formData();
  const reportId = formData.get("reportId") as string;
  const actionType = formData.get("action_type") as string;
  const actionReason = formData.get("action_reason") as string;

  await adminApi(`/reports/${reportId}`, token, {
    method: "PATCH",
    body: { action_type: actionType, action_reason: actionReason },
  });

  return { ok: true };
}

export default function Reports() {
  const { reports, total, currentStatus } = useLoaderData<typeof loader>();
  const [, setSearchParams] = useSearchParams();
  const navigation = useNavigation();
  const isActioning = navigation.state === "submitting";

  const statuses = ["open", "actioned"];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Reports</h2>
        <span className="text-sm text-[var(--text-muted)]">{total} total</span>
      </div>

      {/* Status tabs */}
      <div className="flex gap-2 mb-6">
        {statuses.map((s) => (
          <button
            key={s}
            onClick={() => setSearchParams({ status: s })}
            className={`btn ${currentStatus === s ? "btn-primary" : "btn-outline"}`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Reports list */}
      <div className="space-y-4">
        {(reports as any[]).length === 0 && (
          <p className="text-[var(--text-muted)] text-center py-8">No {currentStatus} reports</p>
        )}
        {(reports as any[]).map((report: any) => (
          <div key={report.id} className="card">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`badge badge-${report.status}`}>{report.status}</span>
                  <span className="badge" style={{ background: "var(--border)", color: "var(--text-muted)" }}>
                    {report.reason}
                  </span>
                </div>

                {report.secret_message && (
                  <div className="bg-[var(--surface)] rounded-lg p-3 mb-2 border border-[var(--border)]">
                    <p className="text-sm">
                      <span className="mr-2">{report.emoji}</span>
                      {report.secret_message}
                    </p>
                    {report.secret_handle && (
                      <p className="text-xs text-[var(--text-muted)] mt-1">by @{report.secret_handle}</p>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-4 text-xs text-[var(--text-muted)]">
                  <span>Reporter: @{report.reporter_handle ?? "anonymous"}</span>
                  <span>{new Date(report.created_at).toLocaleDateString()}</span>
                  {report.details && <span>"{report.details}"</span>}
                </div>

                {report.action_type && (
                  <div className="mt-2 text-xs">
                    <span className="text-[var(--success)]">Action: {report.action_type}</span>
                    {report.action_reason && <span className="text-[var(--text-muted)]"> — {report.action_reason}</span>}
                  </div>
                )}
              </div>

              {/* Action buttons (only for open reports) */}
              {report.status === "open" && (
                <div className="flex flex-col gap-2 min-w-[120px]">
                  <Form method="post">
                    <input type="hidden" name="reportId" value={report.id} />
                    <input type="hidden" name="action_type" value="remove" />
                    <input type="hidden" name="action_reason" value="Content violates community guidelines" />
                    <button type="submit" disabled={isActioning} className="btn btn-danger w-full text-xs">
                      Remove
                    </button>
                  </Form>
                  <Form method="post">
                    <input type="hidden" name="reportId" value={report.id} />
                    <input type="hidden" name="action_type" value="warn" />
                    <input type="hidden" name="action_reason" value="Warning issued for policy violation" />
                    <button type="submit" disabled={isActioning} className="btn btn-outline w-full text-xs" style={{ borderColor: "var(--warning)", color: "var(--warning)" }}>
                      Warn
                    </button>
                  </Form>
                  <Form method="post">
                    <input type="hidden" name="reportId" value={report.id} />
                    <input type="hidden" name="action_type" value="ban" />
                    <input type="hidden" name="action_reason" value="Severe policy violation" />
                    <button type="submit" disabled={isActioning} className="btn btn-danger w-full text-xs opacity-80">
                      Ban
                    </button>
                  </Form>
                  <Form method="post">
                    <input type="hidden" name="reportId" value={report.id} />
                    <input type="hidden" name="action_type" value="dismiss" />
                    <input type="hidden" name="action_reason" value="Report reviewed - no violation found" />
                    <button type="submit" disabled={isActioning} className="btn btn-outline w-full text-xs">
                      Dismiss
                    </button>
                  </Form>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
