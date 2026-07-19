interface AdminMobileHeaderProps {
  title: string;
  handle: string;
  menuOpen: boolean;
  onMenuToggle: () => void;
}

export function AdminMobileHeader({
  title,
  handle,
  menuOpen,
  onMenuToggle,
}: AdminMobileHeaderProps) {
  return (
    <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-[var(--border)] bg-[var(--surface-raised)] px-4 py-3 lg:hidden pt-[max(0.75rem,env(safe-area-inset-top))]">
      <button
        type="button"
        onClick={onMenuToggle}
        aria-expanded={menuOpen}
        aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text)] hover:bg-[var(--surface-hover)]"
      >
        {menuOpen ? (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>

      <div className="min-w-0 flex-1">
        <h1 className="truncate text-base font-semibold text-[var(--text)]">{title}</h1>
        <p className="truncate text-xs text-[var(--text-muted)]">@{handle}</p>
      </div>
    </header>
  );
}
