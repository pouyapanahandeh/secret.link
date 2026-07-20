const SEND_MODES = [
  { icon: "💬", name: "Whisper", desc: "Text that burns" },
  { icon: "📸", name: "Glimpse", desc: "Disappearing pics" },
  { icon: "🔐", name: "Vault", desc: "Passwords & files" },
  { icon: "👻", name: "Echo", desc: "Timed broadcast" },
] as const;

export function FeaturesSection() {
  return (
    <section className="px-4 py-16 max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold text-center mb-2">What can you send?</h2>
      <p className="text-text-muted text-center mb-10">Pick your vibe. Everything disappears.</p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {SEND_MODES.map((mode) => (
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
  );
}
