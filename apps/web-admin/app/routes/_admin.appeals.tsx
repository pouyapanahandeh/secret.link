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
  const status = url.searchParams.get("status") ?? "pending";
  const data = await adminApi(`/appeals?status=${status}`, token);
  return { ...(data as any), currentStatus: status };
}

export async function action({ request }: ActionFunctionArgs) {
  const { token } = await requireAdminSession(request);
  const formData = await request.formData();
  const appealId = formData.get("appealId") as string;
  const decision = formData.get("decision") as string;
  const resolutionNote = formData.get("resolution_note") as string;

  await adminApi(`/appeals/${appealId}`, token, {
    method: "PATCH",
    body: { decision, resolution_note: resolutionNote },
  });

  return { ok: true };
}

export default function Appeals() {
  const { appeals, total, currentStatus } = useLoaderData<typeof loader>();
  const [, setSearchParams] = useSearchParams();
  const navigation = useNavigation();
  const isActioning = navigation.state === "submitting";

  const statuses = ["pending", "upheld", "reversed"];

  return (
    <div>
      <PageHeader title="Appeals" count={total} />

      <FilterTabs
        tabs={statuses.map((s) => ({
          id: s,
          label: s.charAt(0).toUpperCase() + s.slice(1),
        }))}
        activeId={currentStatus}
        onChange={(id) => setSearchParams({ status: id })}
      />

      <div className="space-y-4">
        {(appeals as any[]).length === 0 && (
          <EmptyState
            icon={<NavIcon name="appeals" className="h-8 w-8" />}
            title={`No ${currentStatus} appeals`}
            description="Users can appeal moderation decisions. Those cases show up here."
          />
        )}
        {(appeals as any[]).map((appeal: any) => (
          <div key={appeal.id} className="card">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className={`badge badge-${appeal.status}`}>{appeal.status}</span>
                  <span className="text-sm text-[var(--text)]">@{appeal.user_handle}</span>
                </div>

                <div className="mb-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                  <p className="text-sm text-[var(--text-muted)]">
                    <strong>Original action:</strong> {appeal.action_type} - {appeal.report_reason}
                  </p>
                  <p className="mt-2 text-sm">
                    <strong>Appeal reason:</strong> {appeal.reason}
                  </p>
                </div>

                <p className="text-xs text-[var(--text-muted)]">
                  Submitted {new Date(appeal.created_at).toLocaleDateString()}
                </p>

                {appeal.resolution_note && (
                  <p className="mt-1 text-xs text-[var(--success)]">
                    Resolution: {appeal.resolution_note}
                  </p>
                )}
              </div>

              {appeal.status === "pending" && (
                <div className="flex w-full flex-col gap-2 lg:min-w-[140px] lg:w-auto">
                  <Form method="post">
                    <input type="hidden" name="appealId" value={appeal.id} />
                    <input type="hidden" name="decision" value="reversed" />
                    <input
                      type="hidden"
                      name="resolution_note"
                      value="Appeal accepted - action reversed"
                    />
                    <button type="submit" disabled={isActioning} className="btn btn-success w-full text-xs">
                      Accept (Reverse)
                    </button>
                  </Form>
                  <Form method="post">
                    <input type="hidden" name="appealId" value={appeal.id} />
                    <input type="hidden" name="decision" value="upheld" />
                    <input type="hidden" name="resolution_note" value="Original decision upheld" />
                    <button type="submit" disabled={isActioning} className="btn btn-outline w-full text-xs">
                      Reject (Uphold)
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
