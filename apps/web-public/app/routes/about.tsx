import type { MetaFunction } from "@remix-run/node";

export const meta: MetaFunction = () => [
  { title: "About — Secretlink.life" },
  {
    name: "description",
    content: "Secretlink.life is a privacy-first platform where every message self-destructs. End-to-end encrypted. Open about our limitations.",
  },
];

export default function About() {
  return (
    <main className="flex min-h-screen flex-col items-center py-16 px-4">
      <article className="max-w-2xl w-full prose-invert">
        <img src="/secretlink.png" alt="Secretlink.life" className="w-12 h-12 mb-4" />
        <h1 className="font-display text-4xl mb-6">About Secretlink.life</h1>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-blush mb-3">What is this?</h2>
          <p className="text-candle/80 leading-relaxed">
            Secretlink.life is a social network for things you'd never post anywhere else.
            Every message vanishes after one read. Every link burns. No screenshots,
            no screen recording, no re-sharing. Just you, one person, one moment.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-blush mb-3">How it works</h2>
          <ol className="list-decimal list-inside space-y-2 text-candle/80">
            <li>Your message is encrypted on your device with XChaCha20-Poly1305</li>
            <li>The encrypted blob is stored with a self-destruct timer</li>
            <li>A unique link is generated — that's the only way to access it</li>
            <li>The recipient holds to reveal — once released, it's gone forever</li>
            <li>The server never sees your plaintext</li>
          </ol>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-blush mb-3">Privacy — honest version</h2>
          <p className="text-candle/80 leading-relaxed mb-3">
            No software can make a perfectly secret message on a general-purpose device.
            The user with the screen always wins. What we <em>can</em> do is raise the
            cost of capture from "tap a button" to "borrow a second phone and aim a
            camera" — which deters ~99% of casual leaks.
          </p>
          <p className="text-candle/60 text-sm">
            👁 Capture-resistant, not capture-proof. We say so plainly because honesty
            is the foundation of trust.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-blush mb-3">Safety</h2>
          <ul className="list-disc list-inside space-y-2 text-candle/80">
            <li>Secrets self-destruct after viewing — nothing persists</li>
            <li>End-to-end encryption — we can't read your messages</li>
            <li>No accounts required to send anonymously</li>
            <li>One-tap reporting for inappropriate content</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-mint-signal mb-3">Coming Soon</h2>
          <ul className="list-disc list-inside space-y-2 text-candle/80">
            <li>Custom themes for your reveal experience</li>
            <li>Longer secret TTL options</li>
            <li>Larger file uploads</li>
            <li>Pro features and custom handles</li>
          </ul>
        </section>

        <footer className="border-t border-candle/10 pt-6 text-center space-y-2">
          <p className="text-candle/40 text-sm">
            Built with 🔐 by the Secretlink.life team
          </p>
          <p className="text-candle/40 text-sm">
            Have a question?{" "}
            <a href="/contact" className="text-blush hover:underline">Contact us</a>
            {" · "}
            <a href="/" className="hover:text-candle/60 transition-colors">← Back to Secretlink.life</a>
          </p>
        </footer>
      </article>
    </main>
  );
}
