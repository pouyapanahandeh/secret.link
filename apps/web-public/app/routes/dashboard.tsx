import type { MetaFunction, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { useState } from "react";
import { ThemeToggle } from "../components/ThemeToggle";

export const meta: MetaFunction = () => [
  { title: "Dashboard — Secretlink.life" },
];

const API_URL = process.env["API_URL"] ?? "http://localhost:4000";

export async function loader({ request }: LoaderFunctionArgs) {
  const cookieHeader = request.headers.get("Cookie") ?? "";
  const token = cookieHeader.match(/sl_token=([^;]+)/)?.[1];

  if (!token) {
    return redirect("/login");
  }

  // Get user profile
  const profileRes = await fetch(`${API_URL}/v1/users/me/profile`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!profileRes.ok) {
    return redirect("/login");
  }

  const user = await profileRes.json();

  // Get inbox (secrets sent to this user)
  const inboxRes = await fetch(`${API_URL}/v1/secrets/inbox/${user.handle}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const inbox = inboxRes.ok ? await inboxRes.json() : [];

  // Get sent secrets
  const sentRes = await fetch(`${API_URL}/v1/secrets/sent/${user.id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const sent = sentRes.ok ? await sentRes.json() : [];

  return json({ user, inbox, sent, token });
}

export default function Dashboard() {
  const { user, inbox, sent, token } = useLoaderData<typeof loader>();
  const [passkeyStatus, setPasskeyStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [passkeyError, setPasskeyError] = useState("");
  const [hasPasskey, setHasPasskey] = useState(user.hasPasskey);

  async function handleAddPasskey() {
    setPasskeyStatus("loading");
    setPasskeyError("");

    try {
      const { startRegistration } = await import("@simplewebauthn/browser");

      const origin = window.location.origin;
      const apiBase = window.location.port === "3000" ? origin.replace(":3000", ":4000") : origin;

      // 1. Get registration options from API
      const optionsRes = await fetch(`${apiBase}/v1/users/me/passkey/register-options`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!optionsRes.ok) throw new Error("Failed to get registration options");
      const options = await optionsRes.json();

      // 2. Start WebAuthn ceremony in browser
      const credential = await startRegistration({ optionsJSON: options });

      // 3. Send credential back to API for verification
      const verifyRes = await fetch(`${apiBase}/v1/users/me/passkey/register-verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(credential),
      });

      if (!verifyRes.ok) throw new Error("Passkey verification failed");

      setPasskeyStatus("done");
      setHasPasskey(true);
    } catch (err: any) {
      setPasskeyStatus("error");
      setPasskeyError(err?.message ?? "Something went wrong");
    }
  }

  return (
    <main className="min-h-screen bg-surface">
      {/* Header */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-border/50">
        <a href="/" className="flex items-center gap-2">
          <img src="/secretlink.png" alt="Secretlink.life" className="w-8 h-8" />
          <span className="text-xl font-bold tracking-tight">
            secretlink<span className="text-accent">.</span>life
          </span>
        </a>
        <div className="flex items-center gap-4">
          <span className="text-sm text-text-muted">@{user.handle}</span>
          <ThemeToggle />
          <form method="post" action="/logout">
            <button type="submit" className="text-sm text-text-muted hover:text-text transition-colors">
              Log out
            </button>
          </form>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Profile card */}
        <div className="bg-surface-raised rounded-2xl border border-border p-6 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">@{user.handle}</h1>
              <p className="text-text-muted text-sm mt-1">
                {user.email ?? "No email set"} · {user.isPro ? "Pro ⭐" : "Free"}
              </p>
            </div>
            <div className="flex gap-3">
              <a
                href={`/${user.handle}`}
                className="text-sm bg-accent/10 text-accent px-4 py-2 rounded-full hover:bg-accent/20 transition-colors"
              >
                View profile →
              </a>
              {!hasPasskey && (
                <button
                  onClick={handleAddPasskey}
                  disabled={passkeyStatus === "loading"}
                  className="text-sm bg-accent/10 text-accent px-4 py-2 rounded-full hover:bg-accent/20 transition-colors disabled:opacity-50"
                >
                  {passkeyStatus === "loading" ? "Setting up..." : passkeyStatus === "done" ? "Passkey added ✓" : "Add passkey 🔑"}
                </button>
              )}
              {hasPasskey && (
                <span className="text-sm bg-success/10 text-success px-4 py-2 rounded-full">
                  Passkey active ✓
                </span>
              )}
            </div>
          </div>
          {passkeyError && (
            <p className="text-red-400 text-sm mt-3">{passkeyError}</p>
          )}
          <div className="mt-4 flex items-center gap-2">
            <span className="text-xs text-text-muted">Your link:</span>
            <code className="text-sm bg-surface px-3 py-1 rounded-lg border border-border">
              secretlink.life/@{user.handle}
            </code>
          </div>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Inbox */}
          <section>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              📥 Inbox
              {inbox.length > 0 && (
                <span className="bg-accent text-black text-xs font-bold px-2 py-0.5 rounded-full">
                  {inbox.length}
                </span>
              )}
            </h2>

            {inbox.length === 0 ? (
              <div className="bg-surface-raised rounded-xl border border-border p-6 text-center">
                <p className="text-text-muted">No secrets yet.</p>
                <p className="text-xs text-text-muted mt-2">
                  Share your link to start receiving secrets!
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {inbox.map((secret: any) => (
                  <Link
                    key={secret.id}
                    to={`/s/${secret.id}#k=${secret.keyHint ?? ""}`}
                    className="block bg-surface-raised rounded-xl border border-border p-4 hover:border-accent/50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        {secret.contentType === "text" ? "💬" : secret.contentType === "image" ? "🖼️" : secret.contentType === "video" ? "🎥" : "📎"}{" "}
                        {secret.contentType} secret
                      </span>
                      <span className="text-xs text-text-muted">
                        {new Date(secret.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-xs text-text-muted mt-1">
                      {secret.burned ? "🔥 Burned" : secret.viewCount > 0 ? "👁️ Viewed" : "✨ New"}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* Sent */}
          <section>
            <h2 className="text-lg font-semibold mb-4">📤 Sent</h2>

            {sent.length === 0 ? (
              <div className="bg-surface-raised rounded-xl border border-border p-6 text-center">
                <p className="text-text-muted">No secrets sent yet.</p>
                <Link to="/send" className="text-xs text-accent hover:text-accent/80 mt-2 inline-block">
                  Send your first secret →
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {sent.map((secret: any) => (
                  <div
                    key={secret.id}
                    className="bg-surface-raised rounded-xl border border-border p-4"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        {secret.contentType === "text" ? "💬" : secret.contentType === "image" ? "🖼️" : secret.contentType === "video" ? "🎥" : "📎"}{" "}
                        → {secret.recipientHandle ? `@${secret.recipientHandle}` : "Anonymous link"}
                      </span>
                      <span className="text-xs text-text-muted">
                        {new Date(secret.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-xs text-text-muted mt-1">
                      {secret.burned
                        ? "🔥 Burned (viewed)"
                        : secret.viewCount > 0
                        ? `👁️ Viewed (${secret.viewCount}/${secret.maxViews})`
                        : "⏳ Pending"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
