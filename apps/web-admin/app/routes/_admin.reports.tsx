import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { requireAdminSession } from "~/lib/session.server";
import { adminApi } from "~/lib/api.server";
import { useLoaderData, useSearchParams, Form, useNavigation } from "@remix-run/react";
import { EmptyState } from "~/components/EmptyState";
import { FilterTabs } from "~/components/FilterTabs";
import { NavIcon } from "~/components/NavIcon";
import { PageHeader } from "~/components/PageHeader";

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
      <PageHeader title="Reports" count={total} />

      <FilterTabs
        tabs={statuses.map((s) => ({
          id: s,
          label: s.charAt(0).toUpperCase() + s.slice(1),
        }))}
        activeId={currentStatus}
        onChange={(id) => setSearchParams({ status: id })}
      />

      <div className="space-y-4">
        {(reports as any[]).length === 0 && (
          <EmptyState
            icon={<NavIcon name="reports" className="h-8 w-8" />}
            title={`No ${currentStatus} reports`}
            description="When users flag a secret, it lands here for review."
          />
        )}
        {(reports as any[]).map((report: any) => (
          <div key={report.id} className="card">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className={`badge badge-${report.status}`}>{report.status}</span>
                  <span
                    className="badge"
                    style={{ background: "var(--border)", color: "var(--text-muted)" }}
                  >
                    {report.reason}
                  </span>
                </div>

                {report.secret_message && (
                  <div className="mb-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                    <p className="text-sm">
                      <span className="mr-2">{report.emoji}</span>
                      {report.secret_message}
                    </p>
                    {report.secret_handle && (
                      <p className="mt-1 text-xs text-[var(--text-muted)]">
                        by @{report.secret_handle}
                      </p>
                    )}
                  </div>
                )}

                <div className="flex flex-col gap-1 text-xs text-[var(--text-muted)] sm:flex-row sm:gap-4">
                  <span>Reporter: @{report.reporter_handle ?? "anonymous"}</span>
                  <span>{new Date(report.created_at).toLocaleDateString()}</span>
                  {report.details && <span>&quot;{report.details}&quot;</span>}
                </div>

                {report.action_type && (
                  <div className="mt-2 text-xs">
                    <span className="text-[var(--success)]">Action: {report.action_type}</span>
                    {report.action_reason && (
                      <span className="text-[var(--text-muted)]"> - {report.action_reason}</span>
                    )}
                  </div>
                )}
              </div>

              {report.status === "open" && (
                <div className="flex w-full flex-col gap-2 lg:min-w-[120px] lg:w-auto">
                  <Form method="post">
                    <input type="hidden" name="reportId" value={report.id} />
                    <input type="hidden" name="action_type" value="remove" />
                    <input
                      type="hidden"
                      name="action_reason"
                      value="Content violates community guidelines"
                    />
                    <button type="submit" disabled={isActioning} className="btn btn-danger w-full text-xs">
                      Remove
                    </button>
                  </Form>
                  <Form method="post">
                    <input type="hidden" name="reportId" value={report.id} />
                    <input type="hidden" name="action_type" value="warn" />
                    <input
                      type="hidden"
                      name="action_reason"
                      value="Warning issued for policy violation"
                    />
                    <button
                      type="submit"
                      disabled={isActioning}
                      className="btn btn-outline w-full text-xs"
                      style={{ borderColor: "var(--warning)", color: "var(--warning)" }}
                    >
                      Warn
                    </button>
                  </Form>
                  <Form method="post">
                    <input type="hidden" name="reportId" value={report.id} />
                    <input type="hidden" name="action_type" value="ban" />
                    <input type="hidden" name="action_reason" value="Severe policy violation" />
                    <button
                      type="submit"
                      disabled={isActioning}
                      className="btn btn-danger w-full text-xs opacity-80"
                    >
                      Ban
                    </button>
                  </Form>
                  <Form method="post">
                    <input type="hidden" name="reportId" value={report.id} />
                    <input type="hidden" name="action_type" value="dismiss" />
                    <input
                      type="hidden"
                      name="action_reason"
                      value="Report reviewed - no violation found"
                    />
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
