import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { requireAdminSession } from "~/lib/session.server";
import { adminApi } from "~/lib/api.server";
import { useLoaderData, useSearchParams, Form, useNavigation } from "@remix-run/react";

export async function loader({ request }: LoaderFunctionArgs) {
  const { token } = await requireAdminSession(request);
  const url = new URL(request.url);
  const search = url.searchParams.get("search") ?? "";
  const data = await adminApi(`/users?search=${encodeURIComponent(search)}`, token);
  return { ...(data as any), search };
}

export async function action({ request }: ActionFunctionArgs) {
  const { token } = await requireAdminSession(request);
  const formData = await request.formData();
  const userId = formData.get("userId") as string;
  const actionType = formData.get("actionType") as string;

  if (actionType === "suspend") {
    await adminApi(`/users/${userId}`, token, {
      method: "PATCH",
      body: { suspend: true, reason: "Suspended by admin" },
    });
  } else if (actionType === "unsuspend") {
    await adminApi(`/users/${userId}`, token, {
      method: "PATCH",
      body: { unsuspend: true },
    });
  } else if (actionType === "make_moderator") {
    await adminApi(`/users/${userId}`, token, {
      method: "PATCH",
      body: { role: "moderator" },
    });
  } else if (actionType === "remove_moderator") {
    await adminApi(`/users/${userId}`, token, {
      method: "PATCH",
      body: { role: "user" },
    });
  }

  return { ok: true };
}

export default function Users() {
  const { users, total, search } = useLoaderData<typeof loader>();
  const [, setSearchParams] = useSearchParams();
  const navigation = useNavigation();
  const isActioning = navigation.state === "submitting";

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Users</h2>
        <span className="text-sm text-[var(--text-muted)]">{total} total</span>
      </div>

      {/* Search */}
      <div className="mb-6">
        <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); setSearchParams({ search: fd.get("q") as string }); }}>
          <input
            name="q"
            defaultValue={search}
            placeholder="Search by handle..."
            className="input max-w-sm"
          />
        </form>
      </div>

      {/* Users table */}
      <div className="card overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="text-left p-3 text-[var(--text-muted)] font-medium">Handle</th>
              <th className="text-left p-3 text-[var(--text-muted)] font-medium">Role</th>
              <th className="text-left p-3 text-[var(--text-muted)] font-medium">Status</th>
              <th className="text-left p-3 text-[var(--text-muted)] font-medium">Joined</th>
              <th className="text-right p-3 text-[var(--text-muted)] font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(users as any[]).map((user: any) => (
              <tr key={user.id} className="border-b border-[var(--border)] hover:bg-[var(--surface-hover)]">
                <td className="p-3">
                  <span className="text-[var(--accent)]">@{user.handle}</span>
                  {user.email && <span className="text-xs text-[var(--text-muted)] ml-2">{user.email}</span>}
                </td>
                <td className="p-3">
                  <span className={`badge ${user.role === "admin" ? "badge-pending" : user.role === "moderator" ? "badge-actioned" : "badge-dismissed"}`}>
                    {user.role}
                  </span>
                </td>
                <td className="p-3">
                  {user.suspended ? (
                    <span className="badge badge-open">Suspended</span>
                  ) : (
                    <span className="text-xs text-[var(--success)]">Active</span>
                  )}
                </td>
                <td className="p-3 text-[var(--text-muted)]">
                  {new Date(user.created_at).toLocaleDateString()}
                </td>
                <td className="p-3 text-right">
                  <div className="flex gap-1 justify-end">
                    {!user.suspended ? (
                      <Form method="post" className="inline">
                        <input type="hidden" name="userId" value={user.id} />
                        <input type="hidden" name="actionType" value="suspend" />
                        <button type="submit" disabled={isActioning} className="btn btn-outline text-xs py-1 px-2" style={{ borderColor: "var(--danger)", color: "var(--danger)" }}>
                          Suspend
                        </button>
                      </Form>
                    ) : (
                      <Form method="post" className="inline">
                        <input type="hidden" name="userId" value={user.id} />
                        <input type="hidden" name="actionType" value="unsuspend" />
                        <button type="submit" disabled={isActioning} className="btn btn-success text-xs py-1 px-2">
                          Unsuspend
                        </button>
                      </Form>
                    )}
                    {user.role === "user" && (
                      <Form method="post" className="inline">
                        <input type="hidden" name="userId" value={user.id} />
                        <input type="hidden" name="actionType" value="make_moderator" />
                        <button type="submit" disabled={isActioning} className="btn btn-outline text-xs py-1 px-2">
                          → Mod
                        </button>
                      </Form>
                    )}
                    {user.role === "moderator" && (
                      <Form method="post" className="inline">
                        <input type="hidden" name="userId" value={user.id} />
                        <input type="hidden" name="actionType" value="remove_moderator" />
                        <button type="submit" disabled={isActioning} className="btn btn-outline text-xs py-1 px-2">
                          → User
                        </button>
                      </Form>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
