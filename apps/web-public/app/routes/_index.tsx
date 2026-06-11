import type { MetaFunction } from "@remix-run/node";
import { useState } from "react";
import { ThemeToggle } from "../components/ThemeToggle";

export const meta: MetaFunction = () => {
  return [
    { title: "Secretlink.life — Say what you really mean" },
    {
      name: "description",
      content:
        "The private social layer. Send secrets that self-destruct, share anonymously, and connect without a trace.",
    },
  ];
};

export default function Index() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <main className="min-h-screen">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 bg-surface/90 backdrop-blur-md z-10 border-b border-border/50">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4">
          <a href="/" className="flex items-center gap-2">
            <img src="/secretlink.png" alt="Secretlink.life" className="w-7 h-7 sm:w-8 sm:h-8" />
            <span className="text-lg sm:text-xl font-bold tracking-tight">
              secretlink<span className="text-accent">.</span>life
            </span>
          </a>

          {/* Desktop nav */}
          <div className="hidden sm:flex items-center gap-4">
            <a href="/about" className="text-sm text-text-muted hover:text-text transition-colors">About</a>
            <a href="/send" className="text-sm text-text-muted hover:text-text transition-colors">Send</a>
            <ThemeToggle />
            <a
              href="/login"
              className="rounded-full bg-accent px-4 py-2 text-sm font-bold text-black hover:scale-[1.03] transition-all"
            >
              Sign in
            </a>
          </div>

          {/* Mobile hamburger */}
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

        {/* Mobile menu */}
        {menuOpen && (
          <div className="sm:hidden border-t border-border/50 px-4 py-4 space-y-3 bg-surface/95 backdrop-blur-md">
            <a href="/about" className="block text-sm text-text-muted hover:text-text transition-colors py-2">About</a>
            <a href="/send" className="block text-sm text-text-muted hover:text-text transition-colors py-2">Send</a>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-text-muted">Theme</span>
              <ThemeToggle />
            </div>
            <a
              href="/login"
              className="block text-center rounded-full bg-accent px-4 py-2.5 text-sm font-bold text-black hover:scale-[1.02] transition-all"
            >
              Sign in
            </a>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="relative flex flex-col items-center justify-center px-4 pt-32 pb-16 overflow-hidden">
        {/* Ambient glow */}
        <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-accent/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative max-w-2xl text-center">
          {/* Logo mascot */}
          <img src="/secretlink.png" alt="Secretlink.life mascot" className="w-24 h-24 mx-auto mb-6" />
          <h1 className="text-4xl font-bold tracking-tight leading-[1.15] sm:text-6xl">
            Your secrets are<br />
            <span className="text-accent">safe with us</span>
          </h1>
          <p className="mt-5 text-base leading-relaxed text-text-muted max-w-md mx-auto">
            Send messages that disappear. Share stuff that self-destructs. 
            No screenshots, no traces, no drama.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href="/send"
              className="rounded-full bg-accent px-8 py-3.5 text-sm font-bold text-black shadow-lg shadow-accent/25 hover:shadow-accent/50 hover:scale-[1.03] transition-all duration-200"
            >
              Send a secret 🤫
            </a>
            <a
              href="/signup"
              className="rounded-full border-2 border-border px-8 py-3.5 text-sm font-semibold text-text hover:border-accent hover:text-accent transition-all duration-200"
            >
              Get your @handle
            </a>
          </div>
          <p className="mt-4 text-xs text-text-muted">Free forever · No email required · 100% encrypted</p>
        </div>
      </section>

      {/* What you can send */}
      <section className="px-4 py-16 max-w-3xl mx-auto">
        <h2 className="text-2xl font-bold text-center mb-2">What can you send?</h2>
        <p className="text-text-muted text-center mb-10">Pick your vibe. Everything disappears.</p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: "💬", name: "Whisper", desc: "Text that burns" },
            { icon: "📸", name: "Glimpse", desc: "Disappearing pics" },
            { icon: "🔐", name: "Vault", desc: "Passwords & files" },
            { icon: "👻", name: "Echo", desc: "Timed broadcast" },
          ].map((mode) => (
            <a
              key={mode.name}
              href="/send"
              className="group rounded-2xl bg-surface-raised border border-border p-5 text-center hover:border-accent/50 hover:bg-accent/5 transition-all duration-200"
            >
              <span className="text-3xl block mb-2 group-hover:scale-110 transition-transform">{mode.icon}</span>
              <h3 className="font-semibold text-sm">{mode.name}</h3>
              <p className="text-xs text-text-muted mt-0.5">{mode.desc}</p>
            </a>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="px-4 py-16 border-t border-border/50">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-10">How it works</h2>

          <div className="space-y-8">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-accent flex items-center justify-center text-black font-bold text-sm">1</div>
              <div>
                <h3 className="font-semibold mb-1">Write your secret</h3>
                <p className="text-sm text-text-muted">Type a message, drop a file, or snap a pic. Choose how long it lives.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-accent flex items-center justify-center text-black font-bold text-sm">2</div>
              <div>
                <h3 className="font-semibold mb-1">Share the link</h3>
                <p className="text-sm text-text-muted">We give you a one-time link. Send it however you want — text, DM, email, carrier pigeon.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-accent flex items-center justify-center text-black font-bold text-sm">3</div>
              <div>
                <h3 className="font-semibold mb-1">Poof — it's gone 💨</h3>
                <p className="text-sm text-text-muted">Once they open it, the secret self-destructs. No copies, no cache, no coming back.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust section */}
      <section className="px-4 py-16 border-t border-border/50">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-2">Why trust us?</h2>
          <p className="text-text-muted mb-10">Because you don't have to. It's math, not trust.</p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="rounded-2xl bg-surface-raised border border-border p-5">
              <div className="text-2xl mb-2">🔒</div>
              <h3 className="font-semibold text-sm mb-1">End-to-end encrypted</h3>
              <p className="text-xs text-text-muted">Encrypted on your device. We literally can't read it.</p>
            </div>
            <div className="rounded-2xl bg-surface-raised border border-border p-5">
              <div className="text-2xl mb-2">⏱️</div>
              <h3 className="font-semibold text-sm mb-1">Auto-destruct timer</h3>
              <p className="text-xs text-text-muted">From 5 minutes to 30 days. Then the key is deleted forever.</p>
            </div>
            <div className="rounded-2xl bg-surface-raised border border-border p-5">
              <div className="text-2xl mb-2">📵</div>
              <h3 className="font-semibold text-sm mb-1">Screenshot blocked</h3>
              <p className="text-xs text-text-muted">Blocked on mobile. Watermarked on web. We try our best.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-4 py-20 text-center">
        <div className="text-5xl mb-4">🤫</div>
        <h2 className="text-2xl font-bold mb-2">Got something to say?</h2>
        <p className="text-text-muted mb-6">Go on. We won't tell anyone.</p>
        <a
          href="/send"
          className="inline-block rounded-full bg-accent px-8 py-3.5 text-sm font-bold text-black shadow-lg shadow-accent/25 hover:shadow-accent/50 hover:scale-[1.03] transition-all duration-200"
        >
          Send a secret →
        </a>
      </section>

      <footer className="border-t border-border/50 py-6 text-center text-xs text-text-muted">
        <a href="/about" className="hover:text-text transition-colors">About</a>
        {" · "}
        <a href="https://teams.secretlink.life" className="hover:text-text transition-colors">For Teams</a>
        {" · "}
        <span>© 2026 Secretlink.life</span>
      </footer>
    </main>
  );
}
