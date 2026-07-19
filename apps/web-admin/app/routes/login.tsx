import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { Form, useActionData, useNavigation } from "@remix-run/react";
import { useEffect, useRef, useState } from "react";
import { sessionStorage, getSession } from "~/lib/session.server";

const API_URL = process.env["API_URL"] ?? "http://localhost:4000";

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getSession(request);
  if (session.get("token") && session.get("role")) {
    return redirect("/dashboard");
  }
  return null;
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const handle = (formData.get("handle") as string)?.trim().toLowerCase();
  const step = formData.get("step") as string;

  if (step === "get-options") {
    // Step 1: Get passkey challenge
    const res = await fetch(`${API_URL}/v1/users/auth/passkey/login-options`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handle }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { error: data.error === "no_passkey" ? "No passkey found for this handle" : "Login failed" };
    }

    const options = await res.json();
    return { options, handle };
  }

  if (step === "verify") {
    // Step 2: Verify the passkey response
    const credential = formData.get("credential") as string;
    const verifyHandle = formData.get("verifyHandle") as string;

    const res = await fetch(`${API_URL}/v1/users/auth/passkey/login-verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handle: verifyHandle, credential: JSON.parse(credential) }),
    });

    if (!res.ok) {
      return { error: "Passkey verification failed" };
    }

    const { token } = (await res.json()) as { token: string };

    // Check if user is admin/moderator
    const meRes = await fetch(`${API_URL}/v1/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!meRes.ok) {
      return { error: "Failed to verify user" };
    }

    const me = (await meRes.json()) as any;
    if (me.role !== "admin" && me.role !== "moderator") {
      return { error: "Access denied. Admin or moderator role required." };
    }

    // Set session
    const session = await getSession(request);
    session.set("token", token);
    session.set("handle", me.handle);
    session.set("role", me.role);

    return redirect("/dashboard", {
      headers: { "Set-Cookie": await sessionStorage.commitSession(session) },
    });
  }

  return { error: "Invalid step" };
}

export default function Login() {
  const actionData = useActionData<typeof action>() as { error?: string; options?: any; handle?: string } | undefined;
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="flex min-h-screen min-h-[100dvh] items-center justify-center p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="card w-full max-w-sm">
        <div className="text-center mb-6">
          <img src="/secretlink.png" alt="Secretlink" className="mx-auto mb-3 h-12 w-12" />
          <h1 className="text-2xl font-bold text-[var(--accent)]">Secretlink</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Admin Panel</p>
        </div>

        {actionData?.error && (
          <div className="bg-[var(--danger)] bg-opacity-10 border border-[var(--danger)] rounded-lg p-3 mb-4">
            <p className="text-sm text-[var(--danger)]">{actionData.error}</p>
          </div>
        )}

        {/* Step 1: Handle input + get options */}
        {!actionData?.options && (
          <Form method="post">
            <input type="hidden" name="step" value="get-options" />
            <label className="block text-sm text-[var(--text-muted)] mb-1">Handle</label>
            <input
              name="handle"
              type="text"
              placeholder="your-handle"
              required
              className="input mb-4"
              autoComplete="username webauthn"
            />
            <button type="submit" disabled={isSubmitting} className="btn btn-primary w-full">
              {isSubmitting ? "Loading..." : "Sign in with Passkey"}
            </button>
          </Form>
        )}

        {/* Step 2: Passkey challenge (handled client-side) */}
        {actionData?.options && (
          <PasskeyVerify options={actionData.options} handle={actionData.handle!} />
        )}

        <p className="text-xs text-[var(--text-muted)] text-center mt-6">
          Only admin and moderator accounts can access this panel.
        </p>
      </div>
    </div>
  );
}

function PasskeyVerify({ options, handle }: { options: any; handle: string }) {
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const credentialRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { startAuthentication } = await import("@simplewebauthn/browser");
        const credential = await startAuthentication({ optionsJSON: options });
        if (cancelled) return;
        credentialRef.current!.value = JSON.stringify(credential);
        formRef.current!.submit();
      } catch (e: any) {
        if (cancelled) return;
        console.error("Passkey auth failed:", e);
        setError(e?.message || "Passkey authentication failed");
      }
    })();
    return () => { cancelled = true; };
  }, [options]);

  return (
    <div>
      <p className="text-sm text-[var(--text-muted)] mb-4">Passkey challenge received. Complete authentication on your device.</p>
      <form method="post" ref={formRef} action="/login">
        <input type="hidden" name="step" value="verify" />
        <input type="hidden" name="verifyHandle" value={handle} />
        <input type="hidden" name="credential" ref={credentialRef} />
      </form>
      {error ? (
        <p className="text-sm text-[var(--danger)] mt-2">
          {error}. <a href="/login" className="text-[var(--accent)] underline">Try again</a>
        </p>
      ) : (
        <p className="text-sm text-[var(--text-muted)] animate-pulse">Waiting for passkey...</p>
      )}
    </div>
  );
}
