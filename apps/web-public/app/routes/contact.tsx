import type { MetaFunction, ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useActionData, useLoaderData, useNavigation, Link } from "@remix-run/react";
import { SiteChrome } from "../components/SiteChrome";
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

export async function loader({ request }: LoaderFunctionArgs) {
  const token = await getToken(request);
  return json({ isLoggedIn: Boolean(token) });
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
  const { isLoggedIn } = useLoaderData<typeof loader>();
  const actionData = useActionData<ActionResult>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const submitted = actionData?.ok === true;

  return (
    <SiteChrome isLoggedIn={isLoggedIn} currentPath="/contact">
      <div className="mx-auto max-w-xl px-4 sm:px-6 pt-28 sm:pt-32 pb-20">
        <p className="text-[11px] font-semibold tracking-[0.28em] uppercase text-accent mb-4">Inbox</p>
        <h1 className="font-extrabold tracking-[-0.04em] text-4xl sm:text-6xl leading-[0.95] mb-4">
          Contact <span className="font-display font-bold text-accent">us</span>
        </h1>
        <p className="text-text-muted mb-10 leading-relaxed">
          Questions, privacy requests, or feedback — we read every message.
          Leave an email if you'd like a reply.
        </p>

        {submitted ? (
          <div className="border border-border bg-surface-raised p-8">
            <p className="text-xl font-extrabold tracking-tight mb-2">Message sent</p>
            <p className="text-text-muted text-sm mb-6">
              Thanks for reaching out. If you left an email, we'll get back to you soon.
            </p>
            <Link to="/" className="text-sm font-semibold text-accent hover:underline">
              Back to Secretlink.life
            </Link>
          </div>
        ) : (
          <form method="post" className="space-y-5">
            <div>
              <label htmlFor="name" className="block font-mono text-[10px] tracking-[0.18em] uppercase text-text-muted mb-2">
                Name <span>(optional)</span>
              </label>
              <input
                id="name"
                name="name"
                type="text"
                maxLength={100}
                defaultValue={actionData?.values?.name ?? ""}
                placeholder="How should we address you?"
                className="w-full min-h-12 bg-surface-raised border border-border px-4 py-3 text-text placeholder:text-text-muted/50 focus:outline-none focus:border-accent"
              />
            </div>

            <div>
              <label htmlFor="email" className="block font-mono text-[10px] tracking-[0.18em] uppercase text-text-muted mb-2">
                Email <span>(optional, only if you want a reply)</span>
              </label>
              <input
                id="email"
                name="email"
                type="email"
                maxLength={254}
                defaultValue={actionData?.values?.email ?? ""}
                placeholder="you@example.com"
                className="w-full min-h-12 bg-surface-raised border border-border px-4 py-3 text-text placeholder:text-text-muted/50 focus:outline-none focus:border-accent"
              />
              {actionData?.errors?.email && (
                <p className="text-red-400 text-sm mt-1">{actionData.errors.email}</p>
              )}
            </div>

            <div>
              <label htmlFor="message" className="block font-mono text-[10px] tracking-[0.18em] uppercase text-text-muted mb-2">
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
                className="w-full bg-surface-raised border border-border px-4 py-3 text-text placeholder:text-text-muted/50 focus:outline-none focus:border-accent resize-y"
              />
              {actionData?.errors?.message && (
                <p className="text-red-400 text-sm mt-1">{actionData.errors.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full min-h-12 rounded-full bg-accent px-6 text-sm font-extrabold text-black hover:bg-accent-soft transition-colors disabled:opacity-60"
            >
              {isSubmitting ? "Sending…" : "Send message"}
            </button>
          </form>
        )}
      </div>
    </SiteChrome>
  );
}
