import type { MetaFunction, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useActionData } from "@remix-run/react";
import { AppNav } from "../components/AppNav";
import { createSessionRedirect } from "../lib/session.server";
import { API_URL } from "../lib/api.server";

export const meta: MetaFunction = () => [
  { title: "Sign Up — Secretlink.life" },
  { name: "description", content: "Claim your @handle on Secretlink.life. Anonymous, encrypted, ephemeral." },
];

export async function action({ request }: ActionFunctionArgs) {
  const form = await request.formData();
  const handle = String(form.get("handle") ?? "").trim().toLowerCase();
  const email = String(form.get("email") ?? "").trim();

  const errors: Record<string, string> = {};

  if (!handle || handle.length < 3 || handle.length > 32) {
    errors.handle = "Handle must be 3–32 characters";
  } else if (!/^[a-z0-9_-]+$/.test(handle)) {
    errors.handle = "Only lowercase letters, numbers, hyphens, underscores";
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = "Invalid email address";
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

  const { token } = await res.json();

  // Set secure cookie and redirect to dashboard
  return createSessionRedirect(token, "/dashboard");
}

export default function Signup() {
  const actionData = useActionData<typeof action>() as { errors?: Record<string, string>; values?: { handle: string; email: string } } | undefined;

  return (
    <main className="min-h-screen">
      <AppNav authLinks="login" />

      <div className="flex flex-col items-center justify-center min-h-screen px-4 pt-20">
        <div className="max-w-md w-full">
          <img src="/secretlink.png" alt="Secretlink.life" className="w-12 h-12 mx-auto mb-4" />
          <h1 className="font-display text-4xl text-center mb-2">
            Claim your <span className="text-accent">@handle</span>
          </h1>
          <p className="text-text-muted text-center mb-8">
            One link. Your whole identity. Drop it in your bio.
          </p>

          <form method="post" className="space-y-4">
            <div>
              <label htmlFor="handle" className="block text-sm font-medium text-text/80 mb-1">
                Handle
              </label>
              <div className="flex items-center">
                <span className="text-text-muted mr-2">secretlink.life/@</span>
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
                  className="flex-1 rounded-lg bg-surface-raised border border-border px-4 py-3 text-text placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
              {actionData?.errors?.handle && (
                <p className="text-red-400 text-sm mt-1">{actionData.errors.handle}</p>
              )}
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-text/80 mb-1">
                Email <span className="text-text-muted">(optional, for Pro features)</span>
              </label>
              <input
                id="email"
                name="email"
                type="email"
                defaultValue={actionData?.values?.email ?? ""}
                placeholder="you@example.com"
                className="w-full rounded-lg bg-surface-raised border border-border px-4 py-3 text-text placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-accent"
              />
              {actionData?.errors?.email && (
                <p className="text-red-400 text-sm mt-1">{actionData.errors.email}</p>
              )}
            </div>

            <button
              type="submit"
              className="w-full rounded-full bg-accent px-6 py-3 text-sm font-bold text-black hover:scale-[1.02] transition-all duration-200"
            >
              Claim @handle
            </button>
          </form>

          <p className="mt-4 text-xs text-text-muted text-center">
            By signing up, you confirm you are 18+ and accept our{" "}
            <a href="/privacy" className="text-accent hover:underline">Privacy Policy</a>.
          </p>
          <p className="mt-3 text-xs text-text-muted text-center">
            No password needed. Authenticate with biometrics on your device.
          </p>
          <p className="mt-4 text-sm text-text-muted text-center">
            Already have an account?{" "}
            <a href="/login" className="text-accent hover:text-accent-soft transition-colors">Log in</a>
          </p>
        </div>
      </div>
    </main>
  );
}
