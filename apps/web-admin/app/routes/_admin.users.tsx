import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { requireAdminSession } from "~/lib/session.server";
import { adminApi } from "~/lib/api.server";
import { useLoaderData, useSearchParams, Form, useNavigation } from "@remix-run/react";
import { PageHeader } from "~/components/PageHeader";
import { ResponsiveTable } from "~/components/ResponsiveTable";

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

function UserActions({ user, isActioning }: { user: any; isActioning: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      {!user.suspended ? (
        <Form method="post" className="inline">
          <input type="hidden" name="userId" value={user.id} />
          <input type="hidden" name="actionType" value="suspend" />
          <button
            type="submit"
            disabled={isActioning}
            className="btn btn-outline text-xs py-1 px-2"
            style={{ borderColor: "var(--danger)", color: "var(--danger)" }}
          >
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
  );
}

export default function Users() {
  const { users, total, search } = useLoaderData<typeof loader>();
  const [, setSearchParams] = useSearchParams();
  const navigation = useNavigation();
  const isActioning = navigation.state === "submitting";

  return (
    <div>
      <PageHeader title="Users" count={total} />

      <div className="mb-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            setSearchParams({ search: fd.get("q") as string });
          }}
        >
          <input
            name="q"
            defaultValue={search}
            placeholder="Search by handle..."
            className="input w-full sm:max-w-sm"
          />
        </form>
      </div>

      {/* Mobile card list */}
      <div className="space-y-3 md:hidden">
        {(users as any[]).map((user: any) => (
          <div key={user.id} className="card">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="font-medium text-[var(--accent)]">@{user.handle}</span>
              <span
                className={`badge ${
                  user.role === "admin"
                    ? "badge-pending"
                    : user.role === "moderator"
                      ? "badge-actioned"
                      : "badge-dismissed"
                }`}
              >
                {user.role}
              </span>
              {user.suspended ? (
                <span className="badge badge-open">Suspended</span>
              ) : (
                <span className="text-xs text-[var(--success)]">Active</span>
              )}
            </div>
            {user.email && (
              <p className="mb-2 text-xs text-[var(--text-muted)]">{user.email}</p>
            )}
            <p className="mb-3 text-xs text-[var(--text-muted)]">
              Joined {new Date(user.created_at).toLocaleDateString()}
            </p>
            <UserActions user={user} isActioning={isActioning} />
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="card hidden overflow-hidden p-0 md:block">
        <ResponsiveTable>
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="p-3 text-left font-medium text-[var(--text-muted)]">Handle</th>
                <th className="p-3 text-left font-medium text-[var(--text-muted)]">Role</th>
                <th className="p-3 text-left font-medium text-[var(--text-muted)]">Status</th>
                <th className="p-3 text-left font-medium text-[var(--text-muted)]">Joined</th>
                <th className="p-3 text-right font-medium text-[var(--text-muted)]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(users as any[]).map((user: any) => (
                <tr key={user.id} className="border-b border-[var(--border)] hover:bg-[var(--surface-hover)]">
                  <td className="p-3">
                    <span className="text-[var(--accent)]">@{user.handle}</span>
                    {user.email && (
                      <span className="ml-2 text-xs text-[var(--text-muted)]">{user.email}</span>
                    )}
                  </td>
                  <td className="p-3">
                    <span
                      className={`badge ${
                        user.role === "admin"
                          ? "badge-pending"
                          : user.role === "moderator"
                            ? "badge-actioned"
                            : "badge-dismissed"
                      }`}
                    >
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
                    <div className="flex justify-end gap-1">
                      <UserActions user={user} isActioning={isActioning} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ResponsiveTable>
      </div>
    </div>
  );
}
