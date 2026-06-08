import type { MetaFunction } from "@remix-run/node";

export const meta: MetaFunction = () => {
  return [
    { title: "Secret.link for Teams — Where honesty meets safety" },
    {
      name: "description",
      content:
        "Anonymous feedback, pulse surveys & team-building games. Create a culture where everyone feels safe to speak up.",
    },
  ];
};

export default function Index() {
  return (
    <main className="min-h-screen">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 bg-cream/80 backdrop-blur-md sticky top-0 z-10 border-b border-border">
        <a href="/" className="text-xl font-semibold text-ink">
          secret.link <span className="text-primary font-normal">for teams</span>
        </a>
        <div className="flex items-center gap-5">
          <a href="/pricing" className="text-sm text-ink-soft hover:text-ink transition-colors">Pricing</a>
          <a href="/demo" className="text-sm text-ink-soft hover:text-ink transition-colors">Demo</a>
          <a href="/login" className="text-sm text-ink-soft hover:text-ink transition-colors">Log in</a>
          <a
            href="/signup"
            className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary/90 shadow-sm shadow-primary/20 transition-all duration-200"
          >
            Start free →
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative px-4 pt-24 pb-20 overflow-hidden">
        {/* Decorative blobs */}
        <div className="absolute top-10 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-peach/10 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 mb-6">
            <span className="w-2 h-2 rounded-full bg-mint animate-pulse" />
            <span className="text-xs font-medium text-primary">Trusted by 200+ teams</span>
          </div>

          <h1 className="text-4xl font-bold tracking-tight text-ink leading-[1.15] sm:text-6xl">
            Where honesty meets<br />
            <span className="text-primary">psychological safety</span>
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-ink-soft max-w-xl mx-auto">
            Give every voice on your team a safe channel to be heard. Anonymous feedback, 
            team pulse checks, and games that actually bring people together.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="/signup"
              className="rounded-full bg-primary px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:scale-[1.02] transition-all duration-200"
            >
              Get started free
            </a>
            <a
              href="/demo"
              className="rounded-full border border-border px-8 py-3.5 text-sm font-semibold text-ink hover:border-primary/40 hover:text-primary transition-all duration-200"
            >
              Try the live demo
            </a>
          </div>
          <p className="mt-4 text-xs text-ink-soft">No credit card · Free for up to 15 people · Setup in 2 minutes</p>
        </div>
      </section>

      {/* Features */}
      <section className="px-4 py-20 max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold text-ink">Three tools, one mission</h2>
          <p className="mt-2 text-ink-soft">Build a culture where people aren't afraid to tell the truth.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="rounded-2xl bg-card p-8 shadow-sm border border-border hover:shadow-md hover:-translate-y-1 transition-all duration-300">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-2xl mb-5">📨</div>
            <h3 className="text-lg font-semibold text-ink mb-2">Anonymous Feedback</h3>
            <p className="text-sm text-ink-soft leading-relaxed">
              Always-on channels where anyone can speak up. Two-way conversations 
              with zero-knowledge handles — not even admins can identify who said what.
            </p>
          </div>
          <div className="rounded-2xl bg-card p-8 shadow-sm border border-border hover:shadow-md hover:-translate-y-1 transition-all duration-300">
            <div className="w-12 h-12 rounded-xl bg-coral/10 flex items-center justify-center text-2xl mb-5">📊</div>
            <h3 className="text-lg font-semibold text-ink mb-2">Pulse Surveys</h3>
            <p className="text-sm text-ink-soft leading-relaxed">
              Quick check-ins on engagement, safety, and belonging. AI summarizes 
              patterns and writes "what to do next" briefs for managers.
            </p>
          </div>
          <div className="rounded-2xl bg-card p-8 shadow-sm border border-border hover:shadow-md hover:-translate-y-1 transition-all duration-300">
            <div className="w-12 h-12 rounded-xl bg-mint/10 flex items-center justify-center text-2xl mb-5">🎮</div>
            <h3 className="text-lg font-semibold text-ink mb-2">Team Games</h3>
            <p className="text-sm text-ink-soft leading-relaxed">
              Two Truths, Secret Compliments, Mystery Coffee & more. Drop a link in 
              Slack — the team plays async. No awkward video calls required.
            </p>
          </div>
        </div>
      </section>

      {/* Games preview */}
      <section className="px-4 py-20 bg-warm-white">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-ink">Games your team will actually play</h2>
            <p className="mt-2 text-ink-soft">No more awkward icebreakers. These are genuinely fun.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { name: "Two Truths & a Lie", desc: "Submit 3 statements. Team guesses the lie.", emoji: "🤥" },
              { name: "Secret Compliments", desc: "Anonymous appreciation that makes someone's week.", emoji: "💜" },
              { name: "Mystery Coffee", desc: "Random 1:1 pairings with icebreaker prompts.", emoji: "☕" },
              { name: "Werewolf-Lite", desc: "10-minute social deduction. Async-friendly.", emoji: "🐺" },
              { name: "Confession Bingo", desc: "\"Who in the team has ever…\" — surprisingly hilarious.", emoji: "🎯" },
              { name: "Retro: Mad/Sad/Glad", desc: "Anonymous sprint retro with AI grouping.", emoji: "🔄" },
            ].map((game) => (
              <div key={game.name} className="rounded-xl bg-card border border-border p-5 hover:border-primary/30 hover:shadow-sm transition-all duration-200">
                <span className="text-2xl">{game.emoji}</span>
                <h3 className="font-semibold text-ink mt-2 mb-1">{game.name}</h3>
                <p className="text-sm text-ink-soft">{game.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust signals */}
      <section className="px-4 py-16 max-w-4xl mx-auto">
        <div className="rounded-2xl bg-card border border-border p-10">
          <h2 className="text-2xl font-bold text-ink text-center mb-8">Built for trust</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
            <div>
              <p className="text-3xl font-bold text-primary">E2E</p>
              <p className="text-sm text-ink-soft mt-1">Encrypted</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-primary">SOC 2</p>
              <p className="text-sm text-ink-soft mt-1">Ready</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-primary">GDPR</p>
              <p className="text-sm text-ink-soft mt-1">Compliant</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-primary">k≥5</p>
              <p className="text-sm text-ink-soft mt-1">Anonymity guard</p>
            </div>
          </div>
          <p className="text-center text-xs text-ink-soft mt-6">
            Even we can't re-identify respondents. Your team's trust is non-negotiable.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 py-20 text-center">
        <h2 className="text-3xl font-bold text-ink mb-3">Ready to hear what your team really thinks?</h2>
        <p className="text-ink-soft mb-8 max-w-md mx-auto">
          Start free. No credit card. See results in your first week.
        </p>
        <a
          href="/signup"
          className="inline-block rounded-full bg-primary px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:scale-[1.02] transition-all duration-200"
        >
          Get started free →
        </a>
      </section>

      <footer className="border-t border-border py-8 text-center text-sm text-ink-soft/60">
        © 2026 Secret.link — <a href="/pricing" className="hover:text-ink transition-colors">Pricing</a> · <a href="https://secret.link" className="hover:text-ink transition-colors">Public app</a>
      </footer>
    </main>
  );
}
