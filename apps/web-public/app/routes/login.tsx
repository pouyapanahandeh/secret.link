import type { MetaFunction, ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useActionData, useLoaderData, Link } from "@remix-run/react";
import { useEffect, useState } from "react";
import { UI_FEATURES } from "../lib/feature-flags";
import { SiteChrome } from "../components/SiteChrome";
import { createSessionRedirect, getToken } from "../lib/session.server";
import { API_URL } from "../lib/api.server";
import { extractRecoveryCode } from "@secretlink/core/user/schemas";

export const meta: MetaFunction = () => [
  { title: "Log In - Secretlink.life" },
  { name: "description", content: "Log in to your Secretlink.life account." },
];

export async function loader({ request }: LoaderFunctionArgs) {
  const token = await getToken(request);
  const apiBase = API_URL.replace(/\/v1\/?$/, "");
  return json({ isLoggedIn: Boolean(token), apiBase });
}

export async function action({ request }: ActionFunctionArgs) {
  const form = await request.formData();
  const method = String(form.get("method") ?? (UI_FEATURES.magicLink ? "magic-link" : "passkey"));
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const handle = String(form.get("handle") ?? "").trim().toLowerCase();

  // Passkey token exchange - client posts token after WebAuthn ceremony
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

const inputClass =
  "w-full min-h-12 bg-surface-raised border border-border px-4 py-3 text-text placeholder:text-text-muted/50 focus:outline-none focus:border-accent";
const labelClass = "block font-mono text-[10px] tracking-[0.18em] uppercase text-text-muted mb-2";

export default function Login() {
  const { isLoggedIn, apiBase } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [passkeyStatus, setPasskeyStatus] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [passkeyError, setPasskeyError] = useState("");
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryHandle, setRecoveryHandle] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [recoveryStatus, setRecoveryStatus] = useState<"idle" | "loading" | "error">("idle");
  const [recoveryError, setRecoveryError] = useState("");

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
    } catch (err: unknown) {
      setPasskeyStatus("error");
      setPasskeyError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  async function performRecovery() {
    setRecoveryStatus("loading");
    setRecoveryError("");
    try {
      const handle = recoveryHandle.trim().toLowerCase().replace(/^@+/, "");
      const code = extractRecoveryCode(recoveryCode);
      if (!/^[A-Z2-9]{4}-[A-Z2-9]{4}$/i.test(code)) {
        throw new Error("Enter one code, like ABCD-EFGH. You can paste the whole list.");
      }
      setRecoveryHandle(handle);
      setRecoveryCode(code);
      const res = await fetch(`${apiBase}/v1/users/auth/recovery-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle, code }),
      });
      if (!res.ok) {
        throw new Error("Could not recover this account. Check the handle and code and try again.");
      }
      const { token } = (await res.json()) as { token?: string };
      if (!token) throw new Error("Could not recover this account. Check the handle and code and try again.");
      const form = new FormData();
      form.append("intent", "begin");
      form.append("token", token);
      const setCookieRes = await fetch("/recover-passkey", { method: "POST", body: form, redirect: "follow" });
      window.location.href = setCookieRes.redirected ? setCookieRes.url : "/recover-passkey";
    } catch (err: unknown) {
      setRecoveryStatus("error");
      setRecoveryError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  if (actionData && "sent" in actionData && actionData.sent) {
    return (
      <SiteChrome isLoggedIn={isLoggedIn} currentPath="/login">
        <div className="mx-auto max-w-xl px-4 sm:px-6 pt-28 sm:pt-32 pb-20">
          <p className="text-[11px] font-semibold tracking-[0.28em] uppercase text-accent mb-4">Login</p>
          <h1 className="font-extrabold tracking-[-0.04em] text-4xl sm:text-6xl leading-[0.95] mb-4">
            Check your <span className="font-display font-bold text-accent">email</span>
          </h1>
          <p className="text-text-muted mb-8 leading-relaxed">
            We sent a login link to <strong className="text-text">{actionData.email}</strong>.
            Click it to sign in.
          </p>
          <Link to="/login" className="text-sm font-semibold text-accent hover:underline">
            ← Try again
          </Link>
        </div>
      </SiteChrome>
    );
  }

  return (
    <SiteChrome isLoggedIn={isLoggedIn} currentPath="/login">
      <div className="mx-auto max-w-xl px-4 sm:px-6 pt-28 sm:pt-32 pb-20">
        <p className="text-[11px] font-semibold tracking-[0.28em] uppercase text-accent mb-4">Login</p>
        <h1 className="font-extrabold tracking-[-0.04em] text-4xl sm:text-6xl leading-[0.95] mb-4">
          Welcome <span className="font-display font-bold text-accent">back</span>
        </h1>
        <p className="text-text-muted mb-10 leading-relaxed">
          Log in to your Secretlink.life account
        </p>

        {UI_FEATURES.magicLink && (
          <>
            <form method="post" className="space-y-5 mb-8">
              <input type="hidden" name="method" value="magic-link" />
              <div>
                <label htmlFor="email" className={labelClass}>
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  placeholder="you@example.com"
                  className={inputClass}
                />
              </div>

              {actionData && "error" in actionData && actionData.method === "magic-link" && (
                <p className="text-red-400 text-sm">{actionData.error}</p>
              )}

              <button
                type="submit"
                className="w-full min-h-12 rounded-full bg-accent px-6 text-sm font-extrabold text-black hover:bg-accent-soft transition-colors"
              >
                Send magic link
              </button>
            </form>

            <div className="relative mb-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center">
                <span className="px-3 bg-surface font-mono text-[10px] tracking-[0.22em] uppercase text-text-muted">or</span>
              </div>
            </div>
          </>
        )}

        <form method="post" className="space-y-5">
          <input type="hidden" name="method" value="passkey" />
          <div>
            <label htmlFor="handle" className={labelClass}>
              Handle
            </label>
            <div className="flex items-center min-h-12 bg-surface-raised border border-border focus-within:border-accent">
              <span className="font-mono text-sm text-text-muted pl-4 pr-1">@</span>
              <input
                id="handle"
                name="handle"
                type="text"
                placeholder="yourname"
                className="flex-1 min-h-12 bg-transparent px-2 py-3 text-text placeholder:text-text-muted/50 focus:outline-none"
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
            <p className="font-mono text-[11px] tracking-[0.16em] uppercase text-accent">Waiting for passkey…</p>
          )}

          <button
            type="submit"
            disabled={passkeyStatus === "loading"}
            className={`w-full min-h-12 rounded-full px-6 text-sm font-extrabold transition-colors disabled:opacity-50 ${
              UI_FEATURES.magicLink
                ? "border border-border bg-surface-raised text-text hover:border-accent"
                : "bg-accent text-black hover:bg-accent-soft"
            }`}
          >
            {passkeyStatus === "loading" ? "Authenticating..." : "Log in with passkey"}
          </button>
        </form>

        <p className="mt-4 text-sm text-text-muted">
          <button
            type="button"
            onClick={() => setShowRecovery((v) => !v)}
            className="font-semibold text-accent hover:underline"
          >
            Can&apos;t use your passkey?
          </button>
        </p>

        {showRecovery && (
          <form
            className="mt-6 space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              void performRecovery();
            }}
          >
            <div>
              <label htmlFor="recovery-handle" className={labelClass}>
                Handle
              </label>
              <div className="flex items-center min-h-12 bg-surface-raised border border-border focus-within:border-accent">
                <span className="font-mono text-sm text-text-muted pl-4 pr-1">@</span>
                <input
                  id="recovery-handle"
                  value={recoveryHandle}
                  onChange={(e) => setRecoveryHandle(e.target.value)}
                  type="text"
                  autoComplete="username"
                  placeholder="yourname"
                  className="flex-1 min-h-12 bg-transparent px-2 py-3 text-text placeholder:text-text-muted/50 focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label htmlFor="recovery-code" className={labelClass}>
                Recovery code
              </label>
              <input
                id="recovery-code"
                value={recoveryCode}
                onChange={(e) => setRecoveryCode(e.target.value)}
                type="text"
                autoComplete="one-time-code"
                placeholder="XXXX-XXXX"
                className={inputClass}
              />
              <p className="mt-2 text-xs text-text-muted">
                Use any one code. Pasting the whole list is fine — we only use the first.
              </p>
            </div>
            {recoveryError && <p className="text-red-400 text-sm">{recoveryError}</p>}
            <button
              type="submit"
              disabled={recoveryStatus === "loading"}
              className="w-full min-h-12 rounded-full border border-border bg-surface-raised px-6 text-sm font-extrabold text-text hover:border-accent transition-colors disabled:opacity-50"
            >
              {recoveryStatus === "loading" ? "Checking…" : "Continue with recovery code"}
            </button>
          </form>
        )}

        <p className="mt-10 text-sm text-text-muted">
          Don&apos;t have an account?{" "}
          <Link to="/signup" className="font-semibold text-accent hover:underline">Sign up</Link>
        </p>
      </div>
    </SiteChrome>
  );
}
