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
    <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-surface/95 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-xl lg:hidden">
      <button
        type="button"
        onClick={onMenuToggle}
        aria-expanded={menuOpen}
        aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border text-text hover:bg-surface-hover"
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

      <img src="/secretlink.png" alt="" className="h-7 w-7 shrink-0" />

      <div className="min-w-0 flex-1">
        <h1 className="truncate text-base font-extrabold tracking-tight text-text">{title}</h1>
        <p className="truncate font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted">@{handle}</p>
      </div>
    </header>
  );
}
