const TRUST_FEATURES = [
  {
    icon: "🔒",
    title: "End-to-end encrypted",
    description: "Encrypted on your device. We literally can't read it.",
  },
  {
    icon: "⏱️",
    title: "Auto-destruct timer",
    description: "From 5 minutes to 30 days. Then the key is deleted forever.",
  },
  {
    icon: "📵",
    title: "Screenshot blocked",
    description: "Blocked on mobile. Watermarked on web. We try our best.",
  },
] as const;

export function TrustSection() {
  return (
    <section className="border-t border-border bg-surface-raised">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-24">
        <div className="max-w-2xl mb-12 sm:mb-16">
          <p className="text-[11px] font-semibold tracking-[0.28em] uppercase text-accent mb-2">Receipts</p>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Why trust us?</h2>
          <p className="mt-3 font-display text-3xl sm:text-4xl text-accent leading-tight">
            Because you don't have to. It's math, not trust.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-border border border-border">
          {TRUST_FEATURES.map((feature) => (
            <div key={feature.title} className="bg-surface p-7 sm:p-8">
              <div className="text-2xl mb-6">{feature.icon}</div>
              <h3 className="font-extrabold text-lg tracking-tight mb-2">{feature.title}</h3>
              <p className="text-sm text-text-muted leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
