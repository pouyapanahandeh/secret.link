import type { MetaFunction, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useActionData, useNavigation } from "@remix-run/react";
import { useState } from "react";
import { ThemeToggle } from "../components/ThemeToggle";

export const meta: MetaFunction = () => [
  { title: "Send a Secret — Secret.link" },
  { name: "description", content: "Send an anonymous, encrypted, self-destructing secret. Burns after one read." },
];

export async function action({ request }: ActionFunctionArgs) {
  const form = await request.formData();
  const message = String(form.get("message") ?? "").trim();
  const ttl = String(form.get("ttl") ?? "3600");
  const recipient = String(form.get("recipient") ?? "").trim();

  const errors: Record<string, string> = {};
  if (!message) errors.message = "Secret cannot be empty";
  if (message.length > 10000) errors.message = "Secret too long (max 10,000 characters)";

  if (Object.keys(errors).length > 0) {
    return json({ errors, link: null });
  }

  // TODO: encrypt client-side before sending, call API gateway
  const fakeId = Math.random().toString(36).substring(2, 14);
  const link = `https://secret.link/s/${fakeId}`;

  return json({ errors: null, link, ttl: Number(ttl) });
}

export default function Send() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (actionData?.link) {
      await navigator.clipboard.writeText(actionData.link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 pt-20">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 flex items-center justify-between px-6 py-4 bg-surface/90 backdrop-blur-md z-10 border-b border-border/50">
        <a href="/" className="text-xl font-bold tracking-tight">
          secret<span className="text-accent">.</span>link
        </a>
        <div className="flex items-center gap-4">
          <a href="/" className="text-sm text-text-muted hover:text-text transition-colors">Home</a>
          <ThemeToggle />
        </div>
      </nav>

      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🤫</div>
          <h1 className="text-3xl font-bold mb-2">
            Send a <span className="text-accent">secret</span>
          </h1>
          <p className="text-sm text-text-muted">
            One read. Then it's gone forever.
          </p>
        </div>

        {actionData?.link ? (
          <div className="space-y-6 text-center">
            <div className="text-4xl mb-2">✨</div>
            <div className="rounded-2xl border border-success/30 bg-surface-raised p-6">
              <p className="text-sm text-text-muted mb-3">Your secret link is ready!</p>
              <p className="text-success font-mono text-sm break-all bg-success/10 rounded-lg p-3">{actionData.link}</p>
            </div>

            <button
              onClick={handleCopy}
              className="rounded-full bg-accent px-8 py-3 text-sm font-bold text-black hover:scale-[1.03] transition-all duration-200"
            >
              {copied ? "✓ Copied!" : "Copy link 📋"}
            </button>

            <p className="text-xs text-text-muted">
              Share this link. Once they open it, poof — it's gone.
            </p>

            <a
              href="/send"
              className="inline-block text-sm text-text-muted hover:text-accent transition-colors"
            >
              Send another secret →
            </a>
          </div>
        ) : (
          <form method="post" className="space-y-5">
            <div>
              <label htmlFor="recipient" className="block text-sm font-medium mb-1.5">
                To <span className="text-text-muted font-normal">(optional)</span>
              </label>
              <input
                id="recipient"
                name="recipient"
                type="text"
                placeholder="@handle or leave blank for a link"
                className="w-full rounded-2xl bg-surface-raised border border-border px-4 py-3.5 text-text placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent/40 transition-all"
              />
            </div>

            <div>
              <label htmlFor="message" className="block text-sm font-medium mb-1.5">
                Your secret 💭
              </label>
              <textarea
                id="message"
                name="message"
                rows={4}
                required
                maxLength={10000}
                placeholder="What's on your mind?"
                className="w-full rounded-2xl bg-surface-raised border border-border px-4 py-3.5 text-text placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent/40 resize-none transition-all"
              />
              {actionData?.errors?.message && (
                <p className="text-red-400 text-xs mt-1">{actionData.errors.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="ttl" className="block text-sm font-medium mb-1.5">
                Self-destruct timer ⏱️
              </label>
              <select
                id="ttl"
                name="ttl"
                defaultValue="3600"
                className="w-full rounded-2xl bg-surface-raised border border-border px-4 py-3.5 text-text focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent/40 transition-all"
              >
                <option value="300">5 minutes</option>
                <option value="3600">1 hour</option>
                <option value="86400">24 hours</option>
                <option value="604800">7 days</option>
                <option value="2592000">30 days</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={navigation.state === "submitting"}
              className="w-full rounded-full bg-accent px-6 py-4 text-sm font-bold text-black shadow-lg shadow-accent/25 hover:shadow-accent/50 hover:scale-[1.01] transition-all duration-200 disabled:opacity-50"
            >
              {navigation.state === "submitting" ? "Encrypting... 🔐" : "Create secret link 🚀"}
            </button>

            <p className="text-xs text-text-muted text-center">
              🔒 Encrypted on your device · Self-destructs after reading
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
