import { Link } from "@remix-run/react";

export function HeroSection() {
  return (
    <section className="relative flex flex-col items-center justify-center px-4 pt-32 pb-16 overflow-hidden">
      <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-accent/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative max-w-2xl text-center">
        <img src="/secretlink.png" alt="Secretlink.life mascot" className="w-24 h-24 mx-auto mb-6" />
        <h1 className="text-4xl font-bold tracking-tight leading-[1.15] sm:text-6xl">
          Say what you<br />
          <span className="text-accent">really mean</span>
        </h1>
        <p className="mt-5 text-base leading-relaxed text-text-muted max-w-md mx-auto">
          Get your anonymous inbox. Friends send secrets that self-destruct after one read.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to="/signup"
            className="rounded-full bg-accent px-8 py-3.5 text-sm font-bold text-black shadow-lg shadow-accent/25 hover:shadow-accent/50 hover:scale-[1.03] transition-all duration-200"
          >
            Get your @handle
          </Link>
          <Link
            to="/send"
            className="rounded-full border-2 border-border px-8 py-3.5 text-sm font-semibold text-text hover:border-accent hover:text-accent transition-all duration-200"
          >
            Send a secret
          </Link>
        </div>
        <p className="mt-4 text-xs text-text-muted">Free forever · No email required · 100% encrypted</p>
      </div>
    </section>
  );
}
