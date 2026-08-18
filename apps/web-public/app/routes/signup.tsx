import type { MetaFunction, ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useActionData, useLoaderData, Link, Form } from "@remix-run/react";
import { useState } from "react";
import { SiteChrome } from "../components/SiteChrome";
import { createSessionRedirect, getToken } from "../lib/session.server";
import { API_URL } from "../lib/api.server";

export const meta: MetaFunction = () => [
  { title: "Sign Up - Secretlink.life" },
  { name: "description", content: "Claim your @handle on Secretlink.life. Anonymous, encrypted, ephemeral." },
];

export async function loader({ request }: LoaderFunctionArgs) {
  const token = await getToken(request);
  return json({ isLoggedIn: Boolean(token) });
}

export async function action({ request }: ActionFunctionArgs) {
  const form = await request.formData();
  const handle = String(form.get("handle") ?? "").trim().toLowerCase();
  const email = String(form.get("email") ?? "").trim();
  const ageConfirmed = form.get("ageConfirmed") === "on";

  const errors: Record<string, string> = {};

  if (!handle || handle.length < 3 || handle.length > 32) {
    errors.handle = "Handle must be 3–32 characters";
  } else if (!/^[a-z0-9_-]+$/.test(handle)) {
    errors.handle = "Only lowercase letters, numbers, hyphens, underscores";
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = "Invalid email address";
  }

  if (!ageConfirmed) {
    errors.age = "You must confirm you are 16 or older";
  }

  if (Object.keys(errors).length > 0) {
    return json({ errors, values: { handle, email } }, { status: 400 });
  }

  // Create user via API
  const res = await fetch(`${API_URL}/v1/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ handle, email: email || undefined }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    if (data.error === "handle_taken") {
      return json({ errors: { handle: "This handle is already taken" }, values: { handle, email } }, { status: 400 });
    }
    return json({ errors: { handle: data.error ?? "Something went wrong" }, values: { handle, email } }, { status: 400 });
  }

  // The API no longer returns the token in the body - it is delivered via an
  // HttpOnly Set-Cookie header. Extract it here (server-to-server) and re-wrap
  // it into our own encrypted Remix session so it never touches page JS.
  const token = extractSlToken(res.headers.get("set-cookie"));
  if (!token) {
    return json({ errors: { handle: "Something went wrong" }, values: { handle, email } }, { status: 500 });
  }

  return createSessionRedirect(token, "/onboarding");
}

/** Pull the sl_token value out of an upstream Set-Cookie header. */
function extractSlToken(setCookie: string | null): string | null {
  if (!setCookie) return null;
  const match = /(?:^|,\s*)sl_token=([^;]+)/.exec(setCookie);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export default function Signup() {
  const { isLoggedIn } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>() as {
    errors?: Record<string, string>;
    values?: { handle: string; email: string };
  } | undefined;
  const [ageConfirmed, setAgeConfirmed] = useState(false);

  const inputClass =
    "w-full min-h-12 bg-surface-raised border border-border px-4 py-3 text-text placeholder:text-text-muted/50 focus:outline-none focus:border-accent";
  const labelClass = "block font-mono text-[10px] tracking-[0.18em] uppercase text-text-muted mb-2";

  return (
    <SiteChrome isLoggedIn={isLoggedIn} currentPath="/signup">
      <div className="mx-auto max-w-xl px-4 sm:px-6 pt-28 sm:pt-32 pb-20">
        <p className="text-[11px] font-semibold tracking-[0.28em] uppercase text-accent mb-4">Join</p>
        <h1 className="font-extrabold tracking-[-0.04em] text-4xl sm:text-6xl leading-[0.95] mb-4">
          Claim your <span className="font-display font-bold text-accent">@handle</span>
        </h1>
        <p className="text-text-muted mb-10 leading-relaxed">
          One link. Your whole identity. Drop it in your bio.
        </p>

        <Form method="post" className="space-y-5">
          <div>
            <label htmlFor="handle" className={labelClass}>
              Handle
            </label>
            <div className="flex items-center min-h-12 bg-surface-raised border border-border focus-within:border-accent">
              <span className="font-mono text-[11px] text-text-muted pl-4 pr-1 shrink-0">secretlink.life/@</span>
              <input
                id="handle"
                name="handle"
                type="text"
                required
                minLength={3}
                maxLength={32}
                pattern="[a-z0-9_-]+"
                defaultValue={actionData?.values?.handle ?? ""}
                placeholder="yourname"
                className="flex-1 min-w-0 min-h-12 bg-transparent px-2 py-3 text-text placeholder:text-text-muted/50 focus:outline-none"
              />
            </div>
            {actionData?.errors?.handle && (
              <p className="text-red-400 text-sm mt-1">{actionData.errors.handle}</p>
            )}
          </div>

          <div>
            <label htmlFor="email" className={labelClass}>
              Email <span>(optional, for Pro features)</span>
            </label>
            <input
              id="email"
              name="email"
              type="email"
              defaultValue={actionData?.values?.email ?? ""}
              placeholder="you@example.com"
              className={inputClass}
            />
            {actionData?.errors?.email && (
              <p className="text-red-400 text-sm mt-1">{actionData.errors.email}</p>
            )}
          </div>

          <label className="flex items-start gap-3 cursor-pointer border border-border bg-surface-raised px-4 py-3">
            <input
              type="checkbox"
              name="ageConfirmed"
              value="on"
              checked={ageConfirmed}
              onChange={(e) => setAgeConfirmed(e.target.checked)}
              className="mt-1 rounded border-border text-accent focus:ring-accent"
              required
            />
            <span className="text-sm text-text">
              I confirm I am 16 or older
            </span>
          </label>
          {actionData?.errors?.age && (
            <p className="text-red-400 text-sm">{actionData.errors.age}</p>
          )}

          <button
            type="submit"
            disabled={!ageConfirmed}
            className="w-full min-h-12 rounded-full bg-accent px-6 text-sm font-extrabold text-black hover:bg-accent-soft transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Claim @handle
          </button>
        </Form>

        <p className="mt-6 text-xs text-text-muted">
          By signing up, you confirm you are 16+ and accept our{" "}
          <Link to="/privacy" className="text-accent hover:underline">Privacy Policy</Link>
          {" "}and{" "}
          <Link to="/terms" className="text-accent hover:underline">Terms</Link>.
        </p>
        <p className="mt-3 font-mono text-[10px] tracking-[0.14em] uppercase text-text-muted">
          No password needed. Authenticate with biometrics on your device.
        </p>
        <p className="mt-8 text-sm text-text-muted">
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-accent hover:underline">Log in</Link>
        </p>
      </div>
    </SiteChrome>
  );
}
