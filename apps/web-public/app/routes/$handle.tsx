import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useActionData, useNavigation } from "@remix-run/react";
import { useState } from "react";
import { ThemeToggle } from "../components/ThemeToggle";

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  return [
    { title: `@${data?.handle} — Secretlink.life` },
    {
      name: "description",
      content: `Send an anonymous secret to @${data?.handle} on Secretlink.life. It burns after one read.`,
    },
    { property: "og:title", content: `@${data?.handle} — Secretlink.life` },
    {
      property: "og:description",
      content: "Send me a secret. It burns after I read it.",
    },
  ];
};

export async function loader({ params }: LoaderFunctionArgs) {
  const handle = params["handle"];
  return json({ handle });
}

export async function action({ request, params }: ActionFunctionArgs) {
  const form = await request.formData();
  const message = String(form.get("message") ?? "").trim();
  const handle = params["handle"];

  if (!message) {
    return json({ error: "Secret cannot be empty", sent: false });
  }
  if (message.length > 10000) {
    return json({ error: "Secret too long (max 10,000 characters)", sent: false });
  }

  // TODO: encrypt client-side, call API gateway with recipient handle
  return json({ error: null, sent: true, handle });
}

export default function ProfilePage() {
  const { handle } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();

  if (actionData?.sent) {
    return (
      <main className="min-h-screen">
        <nav className="fixed top-0 left-0 right-0 flex items-center justify-between px-6 py-4 bg-surface/90 backdrop-blur-md z-10 border-b border-border/50">
          <a href="/" className="flex items-center gap-2">
            <img src="/secretlink.png" alt="Secretlink.life" className="w-8 h-8" />
            <span className="text-xl font-bold tracking-tight">
              secretlink<span className="text-accent">.</span>life
            </span>
          </a>
          <ThemeToggle />
        </nav>
        <div className="flex flex-col items-center justify-center min-h-screen px-4">
          <div className="max-w-md w-full text-center">
            <img src="/secretlink.png" alt="Secretlink.life" className="w-12 h-12 mx-auto mb-4" />
            <h1 className="font-display text-4xl mb-4 text-success">Sent!</h1>
            <p className="text-text-muted mb-8">
              Your anonymous secret has been delivered to @{handle}.
              It will burn after one read.
            </p>
            <a
              href={`/${handle}`}
              className="text-sm text-accent hover:text-accent-soft transition-colors"
            >
              Send another →
            </a>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 flex items-center justify-between px-6 py-4 bg-surface/90 backdrop-blur-md z-10 border-b border-border/50">
        <a href="/" className="flex items-center gap-2">
          <img src="/secretlink.png" alt="Secretlink.life" className="w-8 h-8" />
          <span className="text-xl font-bold tracking-tight">
            secretlink<span className="text-accent">.</span>life
          </span>
        </a>
        <div className="flex items-center gap-4">
          <a href="/send" className="text-sm text-text-muted hover:text-text transition-colors">Send</a>
          <ThemeToggle />
        </div>
      </nav>

      <div className="flex flex-col items-center justify-center min-h-screen px-4 pt-20">
        <div className="max-w-md w-full text-center">
          <img src="/secretlink.png" alt="Secretlink.life" className="w-12 h-12 mx-auto mb-4" />
          <h1 className="font-display text-4xl mb-2">@{handle}</h1>
          <p className="text-text-muted mb-8">Send me an anonymous secret</p>

          <form method="post" className="space-y-4">
            <textarea
              name="message"
              rows={4}
              required
              maxLength={10000}
              placeholder="Type your secret..."
              className="w-full rounded-lg bg-surface-raised border border-border px-4 py-3 text-text placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-accent resize-none"
            />
            {actionData?.error && (
              <p className="text-red-400 text-sm">{actionData.error}</p>
            )}
            <button
              type="submit"
              disabled={navigation.state === "submitting"}
              className="w-full rounded-full bg-accent px-6 py-3 text-sm font-bold text-black hover:scale-[1.02] transition-all duration-200 disabled:opacity-50"
            >
              {navigation.state === "submitting" ? "Encrypting..." : "Send anonymously"}
            </button>
          </form>

          <p className="mt-6 text-xs text-text-muted">
            End-to-end encrypted. Burns after one read.
          </p>
        </div>
      </div>
    </main>
  );
}
