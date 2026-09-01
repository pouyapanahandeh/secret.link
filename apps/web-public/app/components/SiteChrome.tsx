import { useState } from "react";
import { Link } from "@remix-run/react";
import { ThemeToggle } from "./ThemeToggle";

const NAV_LINKS = [
  { to: "/about", label: "About" },
  { to: "/blog", label: "Blog" },
  { to: "/send", label: "Send" },
] as const;

const FOOTER_LINKS = [
  { to: "/about", label: "About" },
  { to: "/blog", label: "Blog" },
  { to: "/privacy", label: "Privacy Policy" },
  { to: "/contact", label: "Contact" },
] as const;

export function SiteChrome({
  children,
  isLoggedIn = false,
  currentPath,
  hideFooter = false,
}: {
  children: React.ReactNode;
  isLoggedIn?: boolean;
  currentPath?: string;
  hideFooter?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const authTo = isLoggedIn ? "/dashboard" : "/login";
  const authLabel = isLoggedIn ? "Dashboard" : "Sign in";

  return (
    <main className={`${hideFooter ? "h-dvh overflow-hidden" : "min-h-screen"} bg-surface text-text`}>
      <div className="landing-grain" aria-hidden />

      <nav className="fixed top-0 left-0 right-0 z-50 pt-[max(0.75rem,env(safe-area-inset-top))] px-3 sm:px-4">
        <div className="mx-auto max-w-6xl flex items-center justify-between gap-3 rounded-full border border-border/80 bg-surface/80 backdrop-blur-xl px-3 sm:px-4 py-2 shadow-[0_8px_40px_rgba(0,0,0,0.35)]">
          <Link to="/" className="flex items-center gap-2 min-w-0" onClick={() => setMenuOpen(false)}>
            <img src="/secretlink.png" alt="Secretlink.life" className="w-8 h-8 shrink-0" />
            <span className="hidden min-[360px]:inline text-sm sm:text-base font-extrabold tracking-tight truncate">
              secretlink<span className="text-accent">.</span>life
            </span>
          </Link>
          <div className="hidden sm:flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  currentPath === link.to ? "text-accent" : "text-text-muted hover:text-text"
                }`}
              >
                {link.label}
              </Link>
            ))}
            <ThemeToggle />
            <Link
              to={authTo}
              className="ml-1 rounded-full bg-accent px-4 py-2 text-sm font-extrabold text-black hover:bg-accent-soft transition-colors"
            >
              {authLabel}
            </Link>
          </div>

          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="sm:hidden flex items-center justify-center w-11 h-11 rounded-full border border-border hover:border-accent/50 transition-colors"
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
          >
            {menuOpen ? (
              <svg className="w-5 h-5 text-text" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-text" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {menuOpen && (
          <div className="sm:hidden mx-auto max-w-6xl mt-2 rounded-3xl border border-border/80 bg-surface/95 backdrop-blur-xl px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMenuOpen(false)}
                className={`flex items-center min-h-11 text-base font-medium transition-colors ${
                  currentPath === link.to ? "text-accent" : "text-text-muted hover:text-text"
                }`}
              >
                {link.label}
              </Link>
            ))}
            <div className="flex items-center justify-between min-h-11">
              <span className="text-sm text-text-muted">Theme</span>
              <ThemeToggle />
            </div>
            <Link
              to={authTo}
              onClick={() => setMenuOpen(false)}
              className="flex items-center justify-center min-h-11 rounded-full bg-accent px-4 text-sm font-extrabold text-black"
            >
              {authLabel}
            </Link>
          </div>
        )}
      </nav>

      {children}

      {!hideFooter && (
        <footer className="border-t border-border px-4 py-12 sm:py-16">
          <div className="mx-auto max-w-6xl">
            <p className="font-display text-4xl sm:text-5xl text-text mb-8">
              secretlink<span className="text-accent">.</span>life
            </p>
            <nav className="grid grid-cols-2 gap-x-4 gap-y-2 sm:flex sm:flex-wrap sm:gap-x-8">
              {FOOTER_LINKS.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`min-h-11 sm:min-h-0 flex items-center text-sm font-medium transition-colors ${
                    currentPath === link.to ? "text-accent" : "text-text-muted hover:text-accent"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <p className="mt-8 text-xs tracking-widest uppercase text-text-muted">© 2026 Secretlink.life</p>
          </div>
        </footer>
      )}
    </main>
  );
}
