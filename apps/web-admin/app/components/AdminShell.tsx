import { Outlet, useLocation } from "@remix-run/react";
import { useCallback, useEffect, useState } from "react";
import { AdminMobileHeader } from "~/components/AdminMobileHeader";
import { AdminSidebar } from "~/components/AdminSidebar";
import { PwaInstallBanner } from "~/components/PwaInstallBanner";
import { getNavLabel } from "~/lib/nav-items";

interface AdminShellProps {
  handle: string;
  role: string;
}

export function AdminShell({ handle, role }: AdminShellProps) {
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
    <div className="flex min-h-screen min-h-[100dvh]">
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
        className="fixed inset-y-0 left-0 z-40 flex w-64 -translate-x-full flex-col border-r border-[var(--border)] bg-[var(--surface-raised)] transition-transform duration-200 ease-out data-[open=true]:translate-x-0 lg:static lg:translate-x-0"
      >
        <AdminSidebar handle={handle} role={role} onNavigate={closeMenu} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <AdminMobileHeader
          title={pageTitle}
          handle={handle}
          menuOpen={menuOpen}
          onMenuToggle={() => setMenuOpen((open) => !open)}
        />

        <main className="flex-1 overflow-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:p-6">
          <Outlet />
        </main>
      </div>

      <PwaInstallBanner />
    </div>
  );
}
