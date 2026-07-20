import type { MetaFunction } from "@remix-run/node";
import { Link } from "@remix-run/react";
import { AppNav } from "../components/AppNav";

export const meta: MetaFunction = () => [
  { title: "Security — Secretlink.life" },
  { name: "description", content: "How Secretlink protects your secrets with client-side encryption." },
];

export default function Security() {
  return (
    <main className="min-h-screen bg-surface text-text">
      <AppNav authLinks="login" />
      <article className="max-w-3xl mx-auto px-4 py-24 prose prose-invert">
        <h1 className="font-display text-4xl text-accent mb-6">Security model</h1>
        <p className="text-text-muted leading-relaxed">
          Secretlink is designed so the server stores ciphertext, not your secrets. Encryption happens in your
          browser or mobile app using <code>@secretlink/crypto</code> (AES-256-GCM + X25519 key wrap).
        </p>

        <h2 className="text-2xl font-semibold mt-10 mb-3">What we cannot read</h2>
        <ul className="list-disc pl-6 space-y-2 text-text-muted">
          <li>Link secret plaintext (key is in the URL fragment or wrapped for recipients)</li>
          <li>Map drop messages (only encrypted blobs + wrapped keys at rest)</li>
          <li>Your private X25519 keys (stored locally in IndexedDB / secure storage)</li>
        </ul>

        <h2 className="text-2xl font-semibold mt-10 mb-3">What we do store</h2>
        <ul className="list-disc pl-6 space-y-2 text-text-muted">
          <li>Ciphertext, nonces, expiry, view limits, and public profile metadata</li>
          <li>Map coordinates and place labels (not message content)</li>
          <li>Session tokens: API JWT (<code>sl_token</code>) and web session cookie (<code>sl_session</code>)</li>
        </ul>

        <h2 className="text-2xl font-semibold mt-10 mb-3">Map keys at rest</h2>
        <p className="text-text-muted leading-relaxed">
          Map drop data encryption keys are wrapped with a server <code>MASTER_KEY</code> (AWS SSM in production).
          Reveal endpoints return key material for client decrypt — never plaintext messages.
        </p>

        <h2 className="text-2xl font-semibold mt-10 mb-3">Reporting & moderation</h2>
        <p className="text-text-muted leading-relaxed">
          Users can report map content. Moderators work from metadata and reports; content removal does not require
          storing plaintext at rest under normal operation.
        </p>

        <p className="mt-10 text-sm text-text-muted">
          See also our{" "}
          <Link to="/privacy" className="text-accent hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
      </article>
    </main>
  );
}
