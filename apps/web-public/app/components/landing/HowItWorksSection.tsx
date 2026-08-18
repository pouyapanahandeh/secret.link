const STEPS = [
  {
    n: "01",
    title: "Claim your @handle",
    description: "Pick a name. That’s your anonymous inbox - no email required.",
  },
  {
    n: "02",
    title: "Share your link",
    description: "Drop it in your Instagram bio, TikTok, or Stories. One link is enough.",
  },
  {
    n: "03",
    title: "Secrets arrive - then burn",
    description: "Friends send anonymous messages. Once you read them, they’re gone.",
  },
] as const;

export function HowItWorksSection() {
  return (
    <section className="border-t border-border">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-24">
        <p className="text-[11px] font-semibold tracking-[0.28em] uppercase text-accent mb-2">The loop</p>
        <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight mb-12 sm:mb-16">How it works</h2>

        <ol className="list-none p-0 m-0 divide-y divide-border border-y border-border">
          {STEPS.map((step) => (
            <li
              key={step.title}
              className="grid sm:grid-cols-[7rem_1fr] gap-4 sm:gap-10 py-8 sm:py-10"
            >
              <span className="font-display text-5xl sm:text-6xl leading-none text-accent">{step.n}</span>
              <div>
                <h3 className="text-xl sm:text-2xl font-extrabold tracking-tight">{step.title}</h3>
                <p className="mt-2 text-text-muted max-w-xl text-base leading-relaxed">{step.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
