import type { MetaFunction, LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { useState } from "react";
import { Link, useRouteError, isRouteErrorResponse } from "@remix-run/react";
import { ThemeToggle } from "../components/ThemeToggle";
import { HeroSection } from "../components/landing/HeroSection";
import { FeaturesSection } from "../components/landing/FeaturesSection";
import { HowItWorksSection } from "../components/landing/HowItWorksSection";
import { TrustSection } from "../components/landing/TrustSection";
import { MapSection, FinalCtaSection } from "../components/landing/MapSection";
import { getToken } from "../lib/session.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const token = await getToken(request);
  if (token) {
    return redirect("/dashboard");
  }
  return null;
}

export const meta: MetaFunction = () => {
  const title = "Secretlink.life — Say what you really mean";
  const description =
    "Claim your @handle and get an anonymous inbox. Friends send secrets that self-destruct after one read.";
  const url = "https://secretlink.life/";
  const image = "https://secretlink.life/secretlink.png";
  return [
    { title },
    { name: "description", content: description },
    { tagName: "link", rel: "canonical", href: url },
    { property: "og:type", content: "website" },
    { property: "og:site_name", content: "Secretlink.life" },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:url", content: url },
    { property: "og:image", content: image },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: image },
  ];
};

export default function Index() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <main className="min-h-screen">
      <nav className="fixed top-0 left-0 right-0 bg-surface/90 backdrop-blur-md z-10 border-b border-border/50">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4">
          <Link to="/" className="flex items-center gap-2">
            <img src="/secretlink.png" alt="Secretlink.life" className="w-7 h-7 sm:w-8 sm:h-8" />
            <span className="text-lg sm:text-xl font-bold tracking-tight">
              secretlink<span className="text-accent">.</span>life
            </span>
          </Link>
          <div className="hidden sm:flex items-center gap-4">
            <Link to="/about" className="text-sm text-text-muted hover:text-text transition-colors">About</Link>
            <Link to="/blog" className="text-sm text-text-muted hover:text-text transition-colors">Blog</Link>
            <Link to="/send" className="text-sm text-text-muted hover:text-text transition-colors">Send</Link>
            <ThemeToggle />
            <Link
              to="/login"
              className="rounded-full bg-accent px-4 py-2 text-sm font-bold text-black hover:scale-[1.03] transition-all"
            >
              Sign in
            </Link>
          </div>

          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="sm:hidden flex items-center justify-center w-9 h-9 rounded-lg border border-border hover:border-accent/50 transition-colors"
            aria-label="Toggle menu"
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
          <div className="sm:hidden border-t border-border/50 px-4 py-4 space-y-3 bg-surface/95 backdrop-blur-md">
            <Link to="/about" className="block text-sm text-text-muted hover:text-text transition-colors py-2">About</Link>
            <Link to="/blog" className="block text-sm text-text-muted hover:text-text transition-colors py-2">Blog</Link>
            <Link to="/send" className="block text-sm text-text-muted hover:text-text transition-colors py-2">Send</Link>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-text-muted">Theme</span>
              <ThemeToggle />
            </div>
            <Link
              to="/login"
              className="block text-center rounded-full bg-accent px-4 py-2.5 text-sm font-bold text-black hover:scale-[1.02] transition-all"
            >
              Sign in
            </Link>
          </div>
        )}
      </nav>

      <HeroSection />
      <FeaturesSection />
      <HowItWorksSection />
      <TrustSection />
      <MapSection />
      <FinalCtaSection />

      <footer className="border-t border-border/50 py-6 text-center text-xs text-text-muted">
        <Link to="/about" className="hover:text-text transition-colors">About</Link>
        {" · "}
        <Link to="/blog" className="hover:text-text transition-colors">Blog</Link>
        {" · "}
        <Link to="/privacy" className="hover:text-text transition-colors">Privacy Policy</Link>
        {" · "}
        <Link to="/contact" className="hover:text-text transition-colors">Contact</Link>
        {" · "}
        <span>© 2026 Secretlink.life</span>
      </footer>
    </main>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <h1 className="text-2xl font-bold mb-2">
          {isRouteErrorResponse(error) ? `${error.status} — ${error.statusText}` : "Something went wrong"}
        </h1>
        <p className="text-text-muted mb-6">
          {isRouteErrorResponse(error) ? error.data : "An unexpected error occurred."}
        </p>
        <Link to="/" className="rounded-full bg-accent px-6 py-2.5 text-sm font-bold text-black">
          Go home
        </Link>
      </div>
    </main>
  );
}
