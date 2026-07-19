import { Link } from "@remix-run/react";
import { ThemeToggle } from "./ThemeToggle";

interface BlogLayoutProps {
  children: React.ReactNode;
}

export function BlogLayout({ children }: BlogLayoutProps) {
  return (
    <main className="min-h-screen bg-surface">
      <nav className="fixed top-0 left-0 right-0 bg-surface/90 backdrop-blur-md z-10 border-b border-border/50">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 max-w-5xl mx-auto">
          <Link to="/" className="flex items-center gap-2">
            <img src="/secretlink.png" alt="Secretlink.life" className="w-7 h-7 sm:w-8 sm:h-8" />
            <span className="text-lg sm:text-xl font-bold tracking-tight">
              secretlink<span className="text-accent">.</span>life
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/about" className="hidden sm:inline text-sm text-text-muted hover:text-text transition-colors">
              About
            </Link>
            <Link to="/blog" className="text-sm text-accent font-medium">
              Blog
            </Link>
            <Link to="/send" className="hidden sm:inline text-sm text-text-muted hover:text-text transition-colors">
              Send
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </nav>

      <div className="pt-24 pb-16 px-4">
        <div className="max-w-5xl mx-auto">{children}</div>
      </div>

      <footer className="border-t border-border/50 py-6 text-center text-xs text-text-muted">
        <Link to="/about" className="hover:text-text transition-colors">About</Link>
        <span className="mx-2">·</span>
        <Link to="/blog" className="hover:text-text transition-colors">Blog</Link>
        <span className="mx-2">·</span>
        <Link to="/privacy" className="hover:text-text transition-colors">Privacy Policy</Link>
        <span className="mx-2">·</span>
        <Link to="/contact" className="hover:text-text transition-colors">Contact</Link>
      </footer>
    </main>
  );
}
