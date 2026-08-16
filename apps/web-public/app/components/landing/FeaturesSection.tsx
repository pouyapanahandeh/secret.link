import { Link } from "@remix-run/react";

const SEND_MODES = [
  { icon: "💬", name: "Whisper", desc: "Text that burns" },
  { icon: "📸", name: "Glimpse", desc: "Disappearing pics" },
  { icon: "🔐", name: "Vault", desc: "Passwords & files" },
  { icon: "👻", name: "Echo", desc: "Timed broadcast" },
] as const;

export function FeaturesSection() {
  return (
    <section>
      <div className="bg-accent text-black">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 sm:py-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
          <div className="min-w-0">
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">
              Want people to send you secrets?
            </h2>
            <p className="mt-1 text-sm sm:text-base text-black/70 max-w-lg">
              Claim your @handle, share your link, and get an anonymous inbox that self-destructs.
            </p>
          </div>
          <Link
            to="/signup"
            className="inline-flex items-center justify-center min-h-12 shrink-0 rounded-full bg-black px-7 text-sm font-extrabold text-accent hover:opacity-90 transition-opacity"
          >
            Get your @handle
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-24">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-10">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.28em] uppercase text-accent mb-2">Modes</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">What can you send?</h2>
          </div>
          <p className="text-text-muted sm:text-right max-w-xs">Pick your vibe. Everything disappears.</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border border border-border">
          {SEND_MODES.map((mode) => (
            <Link
              key={mode.name}
              to="/send"
              className="group bg-surface p-6 sm:p-8 hover:bg-accent transition-colors min-h-[160px] flex flex-col justify-between"
            >
              <span className="text-2xl sm:text-3xl">{mode.icon}</span>
              <div className="mt-8">
                <h3 className="font-extrabold text-lg sm:text-xl tracking-tight group-hover:text-black">
                  {mode.name}
                </h3>
                <p className="text-sm text-text-muted mt-1 group-hover:text-black/70">{mode.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
