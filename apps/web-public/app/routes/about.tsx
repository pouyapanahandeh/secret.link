import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { SiteChrome } from "../components/SiteChrome";
import { getToken } from "../lib/session.server";

export const meta: MetaFunction = () => [
  { title: "About - Secretlink.life" },
  {
    name: "description",
    content: "Secretlink.life is a privacy-first platform where every message self-destructs. End-to-end encrypted. Open about our limitations.",
  },
];

export async function loader({ request }: LoaderFunctionArgs) {
  const token = await getToken(request);
  return json({ isLoggedIn: Boolean(token) });
}

export default function About() {
  const { isLoggedIn } = useLoaderData<typeof loader>();

  return (
    <SiteChrome isLoggedIn={isLoggedIn} currentPath="/about">
      <article className="mx-auto max-w-3xl px-4 sm:px-6 pt-28 sm:pt-32 pb-20">
        <p className="text-[11px] font-semibold tracking-[0.28em] uppercase text-accent mb-4">The story</p>
        <h1 className="font-extrabold tracking-[-0.04em] text-4xl sm:text-6xl leading-[0.95] mb-10">
          About{" "}
          <span className="font-display font-bold text-accent">Secretlink.life</span>
        </h1>

        <section className="border-t border-border py-8">
          <h2 className="text-xl font-extrabold tracking-tight mb-3">What is this?</h2>
          <p className="text-text-muted leading-relaxed">
            Secretlink.life is a social network for things you'd never post anywhere else.
            Every message vanishes after one read. Every link burns. No screenshots,
            no screen recording, no re-sharing. Just you, one person, one moment.
          </p>
        </section>

        <section className="border-t border-border py-8">
          <h2 className="text-xl font-extrabold tracking-tight mb-4">How it works</h2>
          <ol className="space-y-3 text-text-muted">
            {[
              "Your message is encrypted on your device with XChaCha20-Poly1305",
              "The encrypted blob is stored with a self-destruct timer",
              "A unique link is generated - that's the only way to access it",
              "The recipient holds to reveal - once released, it's gone forever",
              "The server never sees your plaintext",
            ].map((item, i) => (
              <li key={item} className="flex gap-4">
                <span className="font-mono text-accent text-sm tabular-nums w-6 shrink-0">0{i + 1}</span>
                <span>{item}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="border-t border-border py-8">
          <h2 className="text-xl font-extrabold tracking-tight mb-3">Privacy - honest version</h2>
          <p className="text-text-muted leading-relaxed mb-3">
            No software can make a perfectly secret message on a general-purpose device.
            The user with the screen always wins. What we <em>can</em> do is raise the
            cost of capture from "tap a button" to "borrow a second phone and aim a
            camera" - which deters ~99% of casual leaks.
          </p>
          <p className="font-mono text-[11px] tracking-wide uppercase text-accent">
            Capture-resistant, not capture-proof. We say so plainly because honesty
            is the foundation of trust.
          </p>
        </section>

        <section className="border-t border-border py-8">
          <h2 className="text-xl font-extrabold tracking-tight mb-4">Safety</h2>
          <ul className="space-y-2 text-text-muted">
            <li>Secrets self-destruct after viewing - nothing persists</li>
            <li>End-to-end encryption - we can't read your messages</li>
            <li>No accounts required to send anonymously</li>
            <li>One-tap reporting for inappropriate content</li>
          </ul>
        </section>

        <section className="border-t border-border py-8">
          <p className="text-[11px] font-semibold tracking-[0.28em] uppercase text-accent mb-3">Coming soon</p>
          <ul className="space-y-2 text-text-muted">
            <li>Custom themes for your reveal experience</li>
            <li>Longer secret TTL options</li>
            <li>Larger file uploads</li>
            <li>Pro features and custom handles</li>
          </ul>
        </section>

        <p className="border-t border-border pt-8 text-sm text-text-muted">
          Have a question?{" "}
          <Link to="/contact" className="text-accent hover:underline">Contact us</Link>
        </p>
      </article>
    </SiteChrome>
  );
}
