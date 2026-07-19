import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { requireAdminSession } from "~/lib/session.server";
import { adminApi } from "~/lib/api.server";
import { useLoaderData, useSearchParams, Form, useNavigation } from "@remix-run/react";
import { FilterTabs } from "~/components/FilterTabs";
import { PageHeader } from "~/components/PageHeader";

export async function loader({ request }: LoaderFunctionArgs) {
  const { token } = await requireAdminSession(request);
  const url = new URL(request.url);
  const status = url.searchParams.get("status") ?? "new";
  const data = await adminApi(`/contact-messages?status=${status}`, token);
  return { ...(data as any), currentStatus: status };
}

export async function action({ request }: ActionFunctionArgs) {
  const { token } = await requireAdminSession(request);
  const formData = await request.formData();
  const messageId = formData.get("messageId") as string;
  const status = formData.get("status") as string;

  await adminApi(`/contact-messages/${messageId}`, token, {
    method: "PATCH",
    body: { status },
  });

  return { ok: true };
}

export default function ContactMessages() {
  const { messages, total, currentStatus } = useLoaderData<typeof loader>();
  const [, setSearchParams] = useSearchParams();
  const navigation = useNavigation();
  const isActioning = navigation.state === "submitting";

  const statuses = ["new", "read", "archived"];

  return (
    <div>
      <PageHeader title="Contact Messages" count={total} />

      <FilterTabs
        tabs={statuses.map((s) => ({
          id: s,
          label: s.charAt(0).toUpperCase() + s.slice(1),
        }))}
        activeId={currentStatus}
        onChange={(id) => setSearchParams({ status: id })}
      />

      <div className="space-y-4">
        {(messages as any[]).length === 0 && (
          <p className="py-8 text-center text-[var(--text-muted)]">No {currentStatus} messages</p>
        )}
        {(messages as any[]).map((msg: any) => (
          <div key={msg.id} className="card">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className={`badge badge-${msg.status}`}>{msg.status}</span>
                  {msg.name && (
                    <span
                      className="badge"
                      style={{ background: "var(--border)", color: "var(--text-muted)" }}
                    >
                      {msg.name}
                    </span>
                  )}
                  {msg.user_handle && (
                    <span
                      className="badge"
                      style={{ background: "var(--border)", color: "var(--accent)" }}
                    >
                      @{msg.user_handle}
                    </span>
                  )}
                </div>

                <div className="mb-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                  <p className="whitespace-pre-wrap text-sm">{msg.message}</p>
                </div>

                <div className="flex flex-col gap-1 text-xs text-[var(--text-muted)] sm:flex-row sm:gap-4">
                  <span>{msg.email ? `Reply to: ${msg.email}` : "No reply email"}</span>
                  <span>{new Date(msg.created_at).toLocaleString()}</span>
                </div>
              </div>

              <div className="flex w-full flex-col gap-2 lg:min-w-[120px] lg:w-auto">
                {msg.status !== "read" && (
                  <Form method="post">
                    <input type="hidden" name="messageId" value={msg.id} />
                    <input type="hidden" name="status" value="read" />
                    <button type="submit" disabled={isActioning} className="btn btn-primary w-full text-xs">
                      Mark read
                    </button>
                  </Form>
                )}
                {msg.status !== "archived" && (
                  <Form method="post">
                    <input type="hidden" name="messageId" value={msg.id} />
                    <input type="hidden" name="status" value="archived" />
                    <button type="submit" disabled={isActioning} className="btn btn-outline w-full text-xs">
                      Archive
                    </button>
                  </Form>
                )}
                {msg.status === "archived" && (
                  <Form method="post">
                    <input type="hidden" name="messageId" value={msg.id} />
                    <input type="hidden" name="status" value="new" />
                    <button type="submit" disabled={isActioning} className="btn btn-outline w-full text-xs">
                      Restore
                    </button>
                  </Form>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
