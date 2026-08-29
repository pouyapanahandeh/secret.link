import { Outlet, useLocation } from "@remix-run/react";
import { useCallback, useEffect, useState } from "react";
import { AdminMobileHeader } from "~/components/AdminMobileHeader";
import { AdminSidebar } from "~/components/AdminSidebar";
import { PwaInstallBanner } from "~/components/PwaInstallBanner";
import { getNavLabel } from "~/lib/nav-items";
import type { AdminCounts } from "~/lib/stats";

interface AdminShellProps {
  handle: string;
  role: string;
  counts?: AdminCounts;
}

export function AdminShell({ handle, role, counts }: AdminShellProps) {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const pageTitle = getNavLabel(location.pathname);

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  useEffect(() => {
    closeMenu();
  }, [location.pathname, closeMenu]);

  useEffect(() => {
    if (!menuOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu();
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen, closeMenu]);

  return (
    <div className="flex min-h-screen min-h-[100dvh] bg-surface">
      {menuOpen && (
        <button
          type="button"
          aria-label="Close navigation menu"
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          onClick={closeMenu}
        />
      )}

      <aside
        data-open={menuOpen}
        className="fixed inset-y-0 left-0 z-40 flex w-64 -translate-x-full flex-col border-r border-border bg-surface transition-transform duration-200 ease-out data-[open=true]:translate-x-0 lg:static lg:translate-x-0"
      >
        <AdminSidebar handle={handle} role={role} counts={counts} onNavigate={closeMenu} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <AdminMobileHeader
          title={pageTitle}
          handle={handle}
          menuOpen={menuOpen}
          onMenuToggle={() => setMenuOpen((open) => !open)}
        />

        <main className="relative flex-1 overflow-auto p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] lg:p-8">
          <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-accent/10 blur-[100px]" />
          <div className="relative mx-auto w-full max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>

      <PwaInstallBanner />
    </div>
  );
}
