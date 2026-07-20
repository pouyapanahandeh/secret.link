const STEPS = [
  {
    title: "Write your secret",
    description: "Type a message, drop a file, or snap a pic. Choose how long it lives.",
  },
  {
    title: "Share the link",
    description: "We give you a one-time link. Send it however you want — text, DM, email, carrier pigeon.",
  },
  {
    title: "Poof — it's gone 💨",
    description: "Once they open it, the secret self-destructs. No copies, no cache, no coming back.",
  },
] as const;

export function HowItWorksSection() {
  return (
    <section className="px-4 py-16 border-t border-border/50">
      <div className="max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold text-center mb-10">How it works</h2>

        <div className="space-y-8">
          {STEPS.map((step, index) => (
            <div key={step.title} className="flex items-start gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-accent flex items-center justify-center text-black font-bold text-sm">
                {index + 1}
              </div>
              <div>
                <h3 className="font-semibold mb-1">{step.title}</h3>
                <p className="text-sm text-text-muted">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
