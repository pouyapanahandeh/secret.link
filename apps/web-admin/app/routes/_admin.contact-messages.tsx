import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { requireAdminSession } from "~/lib/session.server";
import { adminApi } from "~/lib/api.server";
import { useLoaderData, useSearchParams, Form, useNavigation } from "@remix-run/react";

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
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Contact Messages</h2>
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

      {/* Messages list */}
      <div className="space-y-4">
        {(messages as any[]).length === 0 && (
          <p className="text-[var(--text-muted)] text-center py-8">No {currentStatus} messages</p>
        )}
        {(messages as any[]).map((msg: any) => (
          <div key={msg.id} className="card">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`badge badge-${msg.status}`}>{msg.status}</span>
                  {msg.name && (
                    <span className="badge" style={{ background: "var(--border)", color: "var(--text-muted)" }}>
                      {msg.name}
                    </span>
                  )}
                  {msg.user_handle && (
                    <span className="badge" style={{ background: "var(--border)", color: "var(--accent)" }}>
                      @{msg.user_handle}
                    </span>
                  )}
                </div>

                <div className="bg-[var(--surface)] rounded-lg p-3 mb-2 border border-[var(--border)]">
                  <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                </div>

                <div className="flex items-center gap-4 text-xs text-[var(--text-muted)]">
                  <span>{msg.email ? `Reply to: ${msg.email}` : "No reply email"}</span>
                  <span>{new Date(msg.created_at).toLocaleString()}</span>
                </div>
              </div>

              <div className="flex flex-col gap-2 min-w-[120px]">
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
