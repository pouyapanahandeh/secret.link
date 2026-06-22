import type { MetaFunction, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useActionData, Link } from "@remix-run/react";
import { useEffect, useState } from "react";
import { AppNav } from "../components/AppNav";
import { createSessionRedirect } from "../lib/session.server";
import { API_URL } from "../lib/api.server";

export const meta: MetaFunction = () => [
  { title: "Log In — Secretlink.life" },
  { name: "description", content: "Log in to your Secretlink.life account." },
];

export async function action({ request }: ActionFunctionArgs) {
  const form = await request.formData();
  const method = String(form.get("method") ?? "magic-link");
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const handle = String(form.get("handle") ?? "").trim().toLowerCase();

  // Passkey token exchange — client posts token after WebAuthn ceremony
  if (method === "passkey-token") {
    const token = String(form.get("token") ?? "").trim();
    if (!token) {
      return json({ error: "Missing token", method }, { status: 400 });
    }
    return createSessionRedirect(token, "/dashboard");
  }

  if (method === "magic-link") {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: "Please enter a valid email address", method }, { status: 400 });
    }

    const res = await fetch(`${API_URL}/v1/users/auth/magic-link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    if (!res.ok) {
      return json({ error: "Failed to send magic link. Please try again.", method }, { status: 500 });
    }

    return json({ sent: true, email, method });
  }

  // Handle-based login (for passkey - client-side flow)
  if (!handle) {
    return json({ error: "Please enter your handle", method }, { status: 400 });
  }

  return json({ handle, method: "passkey" });
}

export default function Login() {
  const actionData = useActionData<typeof action>();
  const [passkeyStatus, setPasskeyStatus] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [passkeyError, setPasskeyError] = useState("");

  // When server returns a handle for passkey login, trigger WebAuthn ceremony
  useEffect(() => {
    if (actionData && "handle" in actionData && actionData.method === "passkey") {
      performPasskeyLogin(actionData.handle as string);
    }
  }, [actionData]);

  async function performPasskeyLogin(handle: string) {
    setPasskeyStatus("loading");
    setPasskeyError("");

    try {
      const { startAuthentication } = await import("@simplewebauthn/browser");

      const origin = window.location.origin;
      const apiBase = window.location.port === "3000" ? origin.replace(":3000", ":4000") : origin;

      // 1. Get authentication options
      const optionsRes = await fetch(`${apiBase}/v1/users/auth/passkey/login-options`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle }),
      });

      if (!optionsRes.ok) {
        const data = await optionsRes.json().catch(() => ({}));
        throw new Error(data.error === "no_passkey" ? "No passkey registered for this handle" : "Failed to get login options");
      }

      const options = await optionsRes.json();

      // 2. Start WebAuthn authentication in browser
      const credential = await startAuthentication({ optionsJSON: options });

      // 3. Verify with API
      const verifyRes = await fetch(`${apiBase}/v1/users/auth/passkey/login-verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle, credential }),
      });

      if (!verifyRes.ok) throw new Error("Passkey authentication failed");

      const { token } = await verifyRes.json();

      // 4. Post token to server action to set secure HttpOnly cookie
      const form = new FormData();
      form.append("method", "passkey-token");
      form.append("token", token);
      const setCookieRes = await fetch("/login", { method: "POST", body: form, redirect: "follow" });
      if (setCookieRes.redirected) {
        window.location.href = setCookieRes.url;
      } else {
        window.location.href = "/dashboard";
      }
    } catch (err: any) {
      setPasskeyStatus("error");
      setPasskeyError(err?.message ?? "Something went wrong");
    }
  }

  if (actionData && "sent" in actionData && actionData.sent) {
    return (
      <main className="min-h-screen">
        <AppNav />
        <div className="flex flex-col items-center justify-center min-h-screen px-4">
          <div className="max-w-md w-full text-center">
            <img src="/secretlink.png" alt="Secretlink.life" className="w-12 h-12 mx-auto mb-4" />
            <h1 className="font-display text-3xl mb-4">Check your email ✉️</h1>
            <p className="text-text-muted mb-6">
              We sent a login link to <strong className="text-text">{actionData.email}</strong>.
              Click it to sign in.
            </p>
            <Link to="/login" className="text-sm text-accent hover:text-accent-soft transition-colors">
              ← Try again
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <AppNav authLinks="signup" />

      <div className="flex flex-col items-center justify-center min-h-screen px-4 pt-20">
        <div className="max-w-md w-full">
          <img src="/secretlink.png" alt="Secretlink.life" className="w-12 h-12 mx-auto mb-4" />
          <h1 className="font-display text-4xl text-center mb-2">Welcome back</h1>
          <p className="text-text-muted text-center mb-8">
            Log in to your Secretlink.life account
          </p>

          {/* Magic Link Login */}
          <form method="post" className="space-y-4 mb-8">
            <input type="hidden" name="method" value="magic-link" />
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-text/80 mb-1">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                placeholder="you@example.com"
                className="w-full rounded-lg bg-surface-raised border border-border px-4 py-3 text-text placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>

            {actionData && "error" in actionData && actionData.method === "magic-link" && (
              <p className="text-red-400 text-sm">{actionData.error}</p>
            )}

            <button
              type="submit"
              className="w-full rounded-full bg-accent px-6 py-3 text-sm font-bold text-black hover:scale-[1.02] transition-all duration-200"
            >
              Send magic link ✨
            </button>
          </form>

          <div className="relative mb-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-3 bg-surface text-text-muted">or</span>
            </div>
          </div>

          {/* Passkey Login */}
          <form method="post" className="space-y-4">
            <input type="hidden" name="method" value="passkey" />
            <div>
              <label htmlFor="handle" className="block text-sm font-medium text-text/80 mb-1">
                Handle
              </label>
              <div className="flex items-center">
                <span className="text-text-muted mr-2">@</span>
                <input
                  id="handle"
                  name="handle"
                  type="text"
                  placeholder="yourname"
                  className="flex-1 rounded-lg bg-surface-raised border border-border px-4 py-3 text-text placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
            </div>

            {actionData && "error" in actionData && actionData.method === "passkey" && (
              <p className="text-red-400 text-sm">{actionData.error}</p>
            )}
            {passkeyError && (
              <p className="text-red-400 text-sm">{passkeyError}</p>
            )}
            {passkeyStatus === "loading" && (
              <p className="text-accent text-sm">Waiting for passkey...</p>
            )}

            <button
              type="submit"
              disabled={passkeyStatus === "loading"}
              className="w-full rounded-full bg-surface-raised border border-border px-6 py-3 text-sm font-semibold text-text hover:border-accent/50 transition-colors duration-200 disabled:opacity-50"
            >
              {passkeyStatus === "loading" ? "Authenticating..." : "Log in with passkey 🔑"}
            </button>
          </form>

          <p className="mt-8 text-sm text-text-muted text-center">
            Don't have an account?{" "}
            <Link to="/signup" className="text-accent hover:text-accent-soft transition-colors">Sign up</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
