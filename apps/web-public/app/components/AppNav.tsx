import { Link } from "@remix-run/react";
import { ThemeToggle } from "./ThemeToggle";

interface AppNavProps {
  /** Show auth links (sign in / sign up / log in) */
  authLinks?: "login" | "signup" | "none";
  /** Additional right-side content */
  children?: React.ReactNode;
}

export function AppNav({ authLinks = "none", children }: AppNavProps) {
  return (
    <nav className="fixed top-0 left-0 right-0 flex items-center justify-between px-6 py-4 bg-surface/90 backdrop-blur-md z-10 border-b border-border/50">
      <Link to="/" className="flex items-center gap-2">
        <img src="/secretlink.png" alt="Secretlink.life" className="w-8 h-8" />
        <span className="text-xl font-bold tracking-tight">
          secretlink<span className="text-accent">.</span>life
        </span>
      </Link>
      <div className="flex items-center gap-4">
        {authLinks === "login" && (
          <Link to="/login" className="text-sm text-text-muted hover:text-text transition-colors">
            Log in
          </Link>
        )}
        {authLinks === "signup" && (
          <Link to="/signup" className="text-sm text-text-muted hover:text-text transition-colors">
            Sign up
          </Link>
        )}
        {children}
        <ThemeToggle />
      </div>
    </nav>
  );
}
