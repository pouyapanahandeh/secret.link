import type { MetaFunction } from "@remix-run/node";

export const meta: MetaFunction = () => [
  { title: "Demo - Secret.link for Teams" },
  { name: "description", content: "See how Secret.link for Teams helps your organization collect honest feedback and build team culture." },
];

export default function Demo() {
  return (
    <main className="min-h-screen bg-porcelain">
      <nav className="flex items-center justify-between px-6 py-4 bg-white/80 backdrop-blur-sm border-b border-ink/5">
        <a href="/" className="text-xl font-semibold text-ink">
          Secret.link <span className="text-trust-blue">for Teams</span>
        </a>
        <a href="/signup" className="rounded-md bg-trust-blue px-4 py-2 text-sm font-semibold text-white hover:bg-trust-blue/90 transition-colors">
          Get started free
        </a>
      </nav>

      <section className="max-w-4xl mx-auto px-4 py-16">
        <h1 className="text-3xl font-bold text-ink text-center mb-12">
          See it in action
        </h1>

        {/* Feedback Channel Demo */}
        <div className="mb-16">
          <h2 className="text-xl font-semibold text-ink mb-6 flex items-center gap-2">
            <span className="text-2xl">📨</span> Anonymous Feedback Channel
          </h2>
          <div className="bg-white rounded-xl shadow-sm border border-ink/5 overflow-hidden">
            <div className="bg-ink/[0.02] px-6 py-4 border-b border-ink/5">
              <p className="text-sm font-medium text-ink">secret.link/t/acme/eng-leadership</p>
              <p className="text-xs text-ink/40">Always-on · Two-way mode · k-anonymity: 5</p>
            </div>
            <div className="p-6 space-y-4">
              {[
                { time: "2h ago", msg: "I feel like our sprint planning doesn't account for tech debt. Can we allocate 20% of each sprint?", sentiment: "constructive", topic: "process" },
                { time: "5h ago", msg: "The new onboarding buddy system is amazing. I felt so supported in my first week.", sentiment: "positive", topic: "culture" },
                { time: "1d ago", msg: "Standups are too long. Can we try async standups?", sentiment: "constructive", topic: "meetings" },
              ].map((item, i) => (
                <div key={i} className="rounded-lg bg-porcelain p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs text-ink/40">{item.time}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-trust-blue/10 text-trust-blue">{item.topic}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-warm-accent/10 text-warm-accent">{item.sentiment}</span>
                  </div>
                  <p className="text-sm text-ink/80">{item.msg}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Game Demo */}
        <div className="mb-16">
          <h2 className="text-xl font-semibold text-ink mb-6 flex items-center gap-2">
            <span className="text-2xl">🎮</span> Two Truths & a Lie
          </h2>
          <div className="bg-white rounded-xl shadow-sm border border-ink/5 p-6">
            <p className="text-sm text-ink/60 mb-4">Round 3 of 8 · 6 players · 2 guessed correctly</p>
            <div className="space-y-3">
              {[
                { text: "I've been skydiving three times", votes: 2 },
                { text: "I can solve a Rubik's cube in under a minute", votes: 1, lie: true },
                { text: "I once ate an entire pizza by myself", votes: 3 },
              ].map((item, i) => (
                <div key={i} className={`rounded-lg p-4 border ${item.lie ? "border-warm-accent bg-warm-accent/5" : "border-ink/10"}`}>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-ink">{item.text}</p>
                    <span className="text-xs text-ink/40">{item.votes} votes</span>
                  </div>
                  {item.lie && <p className="text-xs text-warm-accent mt-1">← This was the lie!</p>}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Pulse Survey Demo */}
        <div className="mb-16">
          <h2 className="text-xl font-semibold text-ink mb-6 flex items-center gap-2">
            <span className="text-2xl">📊</span> Pulse Survey Results
          </h2>
          <div className="bg-white rounded-xl shadow-sm border border-ink/5 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="font-semibold text-ink">Psychological Safety Index</p>
                <p className="text-sm text-ink/40">Engineering team · May 2026</p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-trust-blue">7.2</p>
                <p className="text-xs text-green-600">↑ 0.4 from last month</p>
              </div>
            </div>
            <div className="space-y-3">
              {[
                { q: "I feel safe to take risks on this team", score: 7.8 },
                { q: "My mistakes are not held against me", score: 7.1 },
                { q: "I can bring up problems without fear", score: 6.9 },
                { q: "People on this team value different perspectives", score: 7.5 },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="flex-1">
                    <p className="text-sm text-ink/70">{item.q}</p>
                  </div>
                  <div className="w-32 bg-porcelain rounded-full h-2">
                    <div className="bg-trust-blue rounded-full h-2" style={{ width: `${(item.score / 10) * 100}%` }} />
                  </div>
                  <span className="text-sm font-semibold text-ink w-8 text-right">{item.score}</span>
                </div>
              ))}
            </div>
            <div className="mt-6 p-4 rounded-lg bg-trust-blue/5 border border-trust-blue/10">
              <p className="text-sm font-medium text-trust-blue mb-1">AI Insight</p>
              <p className="text-sm text-ink/70">
                Psychological safety rose 0.4 points - likely driven by the new "blameless postmortem"
                process introduced in Engineering. Consider expanding this practice to Product.
              </p>
            </div>
          </div>
        </div>

        <div className="text-center">
          <a
            href="/signup"
            className="inline-block rounded-md bg-trust-blue px-8 py-3 text-sm font-semibold text-white shadow-sm hover:bg-trust-blue/90 transition-colors duration-200"
          >
            Start your free workspace →
          </a>
        </div>
      </section>
    </main>
  );
}
