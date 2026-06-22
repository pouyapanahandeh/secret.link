import { NavLink, Outlet, useLoaderData } from "@remix-run/react";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { requireAdminSession } from "~/lib/session.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { handle, role } = await requireAdminSession(request);
  return { handle, role };
}

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: "📊" },
  { to: "/reports", label: "Reports", icon: "🚩" },
  { to: "/appeals", label: "Appeals", icon: "⚖️" },
  { to: "/users", label: "Users", icon: "👥" },
  { to: "/audit", label: "Audit Log", icon: "📝" },
  { to: "/transparency", label: "Transparency", icon: "📈" },
];

export default function AdminLayout() {
  const { handle, role } = useLoaderData<typeof loader>();

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 border-r border-[var(--border)] bg-[var(--surface-raised)] flex flex-col">
        <div className="p-4 border-b border-[var(--border)]">
          <h1 className="text-lg font-bold text-[var(--accent)]">🔒 Secretlink</h1>
          <p className="text-xs text-[var(--text-muted)] mt-1">Admin Panel</p>
        </div>

        <nav className="flex-1 p-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-[var(--accent)] bg-opacity-10 text-[var(--accent)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)]"
                }`
              }
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-[var(--border)]">
          <p className="text-sm text-[var(--text)]">@{handle}</p>
          <p className="text-xs text-[var(--text-muted)] capitalize">{role}</p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-6 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
