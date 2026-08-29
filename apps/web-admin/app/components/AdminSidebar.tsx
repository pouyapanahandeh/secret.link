import { Form, NavLink } from "@remix-run/react";
import { NavIcon } from "~/components/NavIcon";
import type { AdminCounts } from "~/lib/stats";
import { navItemsForRole } from "~/lib/nav-items";

interface AdminSidebarProps {
  handle: string;
  role: string;
  counts?: AdminCounts;
  onNavigate?: () => void;
}

function badgeFor(to: string, counts?: AdminCounts): number {
  if (!counts) return 0;
  if (to === "/reports") return counts.openReports;
  if (to === "/appeals") return counts.pendingAppeals;
  if (to === "/contact-messages") return counts.newContactMessages;
  return 0;
}

export function AdminSidebar({ handle, role, counts, onNavigate }: AdminSidebarProps) {
  return (
    <>
      <div className="relative overflow-hidden border-b border-border px-5 py-5">
        <div className="pointer-events-none absolute -top-10 left-0 h-24 w-24 rounded-full bg-accent/15 blur-2xl" />
        <div className="relative flex items-center gap-2.5">
          <img src="/secretlink.png" alt="" className="h-8 w-8 shrink-0" />
          <div className="min-w-0">
            <p className="truncate text-sm font-extrabold tracking-tight">
              secretlink<span className="text-accent">.</span>life
            </p>
            <p className="label-mono mt-0.5">Admin</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navItemsForRole(role).map((item) => {
          const count = badgeFor(item.to, counts);
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-full px-3 py-2.5 text-sm font-semibold transition-colors ${
                  isActive
                    ? "bg-accent text-black"
                    : "text-text-muted hover:bg-surface-hover hover:text-text"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <NavIcon name={item.icon} />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {count > 0 && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold tabular-nums ${
                        isActive ? "bg-black text-accent" : "bg-accent text-black"
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="border-t border-border px-4 py-4">
        <p className="truncate text-sm font-semibold text-text">@{handle}</p>
        <p className="label-mono mt-0.5">{role}</p>
        <Form method="post" action="/logout" className="mt-3">
          <button
            type="submit"
            className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-muted hover:text-accent"
          >
            Log out
          </button>
        </Form>
      </div>
    </>
  );
}
