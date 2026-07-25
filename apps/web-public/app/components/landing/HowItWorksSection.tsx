const STEPS = [
  {
    title: "Claim your @handle",
    description: "Pick a name. That’s your anonymous inbox — no email required.",
  },
  {
    title: "Share your link",
    description: "Drop it in your Instagram bio, TikTok, or Stories. One link is enough.",
  },
  {
    title: "Secrets arrive — then burn",
    description: "Friends send anonymous messages. Once you read them, they’re gone.",
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
