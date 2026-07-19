import { NavLink } from "@remix-run/react";
import { navItems } from "~/lib/nav-items";

interface AdminSidebarProps {
  handle: string;
  role: string;
  onNavigate?: () => void;
}

export function AdminSidebar({ handle, role, onNavigate }: AdminSidebarProps) {
  return (
    <>
      <div className="border-b border-[var(--border)] p-4">
        <div className="flex items-center gap-3">
          <img src="/secretlink.png" alt="Secretlink" className="h-9 w-9 shrink-0" />
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold text-[var(--accent)]">Secretlink</h1>
            <p className="text-xs text-[var(--text-muted)]">Admin Panel</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-2 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavigate}
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
    </>
  );
}
