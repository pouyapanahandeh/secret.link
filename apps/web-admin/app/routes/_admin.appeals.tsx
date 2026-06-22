import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { requireAdminSession } from "~/lib/session.server";
import { adminApi } from "~/lib/api.server";
import { useLoaderData, useSearchParams, Form, useNavigation } from "@remix-run/react";

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
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Appeals</h2>
        <span className="text-sm text-[var(--text-muted)]">{total} total</span>
      </div>

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

      <div className="space-y-4">
        {(appeals as any[]).length === 0 && (
          <p className="text-[var(--text-muted)] text-center py-8">No {currentStatus} appeals</p>
        )}
        {(appeals as any[]).map((appeal: any) => (
          <div key={appeal.id} className="card">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`badge badge-${appeal.status}`}>{appeal.status}</span>
                  <span className="text-sm text-[var(--text)]">@{appeal.user_handle}</span>
                </div>

                <div className="bg-[var(--surface)] rounded-lg p-3 mb-2 border border-[var(--border)]">
                  <p className="text-sm text-[var(--text-muted)]">
                    <strong>Original action:</strong> {appeal.action_type} — {appeal.report_reason}
                  </p>
                  <p className="text-sm mt-2">
                    <strong>Appeal reason:</strong> {appeal.reason}
                  </p>
                </div>

                <p className="text-xs text-[var(--text-muted)]">
                  Submitted {new Date(appeal.created_at).toLocaleDateString()}
                </p>

                {appeal.resolution_note && (
                  <p className="text-xs text-[var(--success)] mt-1">Resolution: {appeal.resolution_note}</p>
                )}
              </div>

              {appeal.status === "pending" && (
                <div className="flex flex-col gap-2 min-w-[140px]">
                  <Form method="post">
                    <input type="hidden" name="appealId" value={appeal.id} />
                    <input type="hidden" name="decision" value="reversed" />
                    <input type="hidden" name="resolution_note" value="Appeal accepted - action reversed" />
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
