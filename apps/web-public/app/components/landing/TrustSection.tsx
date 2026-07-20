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
    <section className="px-4 py-16 border-t border-border/50">
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="text-2xl font-bold mb-2">Why trust us?</h2>
        <p className="text-text-muted mb-10">Because you don't have to. It's math, not trust.</p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {TRUST_FEATURES.map((feature) => (
            <div key={feature.title} className="rounded-2xl bg-surface-raised border border-border p-5">
              <div className="text-2xl mb-2">{feature.icon}</div>
              <h3 className="font-semibold text-sm mb-1">{feature.title}</h3>
              <p className="text-xs text-text-muted">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
