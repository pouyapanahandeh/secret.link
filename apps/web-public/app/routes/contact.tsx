import type { MetaFunction, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useActionData, useNavigation, Link } from "@remix-run/react";
import { API_URL } from "../lib/api.server";
import { getToken } from "../lib/session.server";

export const meta: MetaFunction = () => [
  { title: "Contact — Secretlink.life" },
  { name: "description", content: "Get in touch with the Secretlink.life team. Questions, privacy requests, or feedback — we read every message." },
];

interface ActionResult {
  ok: boolean;
  errors: Record<string, string>;
  values: { name: string; email: string; message: string };
}

function result(ok: boolean, errors: Record<string, string>, values: { name: string; email: string; message: string }, status?: number): ReturnType<typeof json<ActionResult>> {
  return json<ActionResult>({ ok, errors, values }, status ? { status } : undefined);
}

export async function action({ request }: ActionFunctionArgs) {
  const form = await request.formData();
  const name = String(form.get("name") ?? "").trim();
  const email = String(form.get("email") ?? "").trim();
  const message = String(form.get("message") ?? "").trim();

  const errors: Record<string, string> = {};

  if (message.length < 10) {
    errors.message = "Message must be at least 10 characters";
  } else if (message.length > 5000) {
    errors.message = "Message must be under 5000 characters";
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = "Invalid email address";
  }

  if (Object.keys(errors).length > 0) {
    return result(false, errors, { name, email, message }, 400);
  }

  const token = await getToken(request);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}/v1/public/contact`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: name || undefined,
      email: email || undefined,
      message,
    }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const errorMessage = typeof data.message === "string" ? data.message : "Something went wrong. Please try again.";
    return result(false, { message: errorMessage }, { name, email, message }, 400);
  }

  return result(true, {}, { name: "", email: "", message: "" });
}

export default function Contact() {
  const actionData = useActionData<ActionResult>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const submitted = actionData?.ok === true;

  return (
    <main className="flex min-h-screen flex-col items-center py-16 px-4">
      <div className="max-w-2xl w-full">
        <img src="/secretlink.png" alt="Secretlink.life" className="w-12 h-12 mb-4" />
        <h1 className="font-display text-4xl mb-2">Contact us</h1>
        <p className="text-candle/60 mb-8">
          Questions, privacy requests, or feedback — we read every message.
          Leave an email if you'd like a reply.
        </p>

        {submitted ? (
          <div className="rounded-xl border border-blush/30 bg-blush/10 p-6 text-center">
            <p className="text-lg mb-1">Message sent 🤫</p>
            <p className="text-candle/60 text-sm mb-4">
              Thanks for reaching out. If you left an email, we'll get back to you soon.
            </p>
            <Link to="/" className="text-blush hover:underline text-sm">
              ← Back to Secretlink.life
            </Link>
          </div>
        ) : (
          <form method="post" className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-candle/80 mb-1">
                Name <span className="text-candle/40">(optional)</span>
              </label>
              <input
                id="name"
                name="name"
                type="text"
                maxLength={100}
                defaultValue={actionData?.values?.name ?? ""}
                placeholder="How should we address you?"
                className="w-full rounded-lg bg-surface-raised border border-border px-4 py-3 text-text placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-candle/80 mb-1">
                Email <span className="text-candle/40">(optional, only if you want a reply)</span>
              </label>
              <input
                id="email"
                name="email"
                type="email"
                maxLength={254}
                defaultValue={actionData?.values?.email ?? ""}
                placeholder="you@example.com"
                className="w-full rounded-lg bg-surface-raised border border-border px-4 py-3 text-text placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-accent"
              />
              {actionData?.errors?.email && (
                <p className="text-red-400 text-sm mt-1">{actionData.errors.email}</p>
              )}
            </div>

            <div>
              <label htmlFor="message" className="block text-sm font-medium text-candle/80 mb-1">
                Message
              </label>
              <textarea
                id="message"
                name="message"
                required
                minLength={10}
                maxLength={5000}
                rows={6}
                defaultValue={actionData?.values?.message ?? ""}
                placeholder="What's on your mind?"
                className="w-full rounded-lg bg-surface-raised border border-border px-4 py-3 text-text placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-accent resize-y"
              />
              {actionData?.errors?.message && (
                <p className="text-red-400 text-sm mt-1">{actionData.errors.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-full bg-accent px-6 py-3 text-sm font-bold text-black hover:scale-[1.02] transition-all duration-200 disabled:opacity-60 disabled:hover:scale-100"
            >
              {isSubmitting ? "Sending…" : "Send message"}
            </button>
          </form>
        )}

        <p className="mt-8 text-center">
          <Link to="/" className="text-candle/40 text-sm hover:text-candle/60 transition-colors">
            ← Back to Secretlink.life
          </Link>
        </p>
      </div>
    </main>
  );
}
