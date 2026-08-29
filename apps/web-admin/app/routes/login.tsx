import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { Form, useActionData, useNavigation } from "@remix-run/react";
import { useEffect, useRef, useState } from "react";
import { sessionStorage, getSession } from "~/lib/session.server";

const API_URL = process.env["API_URL"] ?? "http://localhost:4000";

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getSession(request);
  if (session.get("token") && session.get("role")) {
    const role = session.get("role") as string;
    return redirect(role === "editor" ? "/blog" : "/dashboard");
  }
  return null;
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const handle = (formData.get("handle") as string)?.trim().toLowerCase().replace(/^@+/, "");
  const step = formData.get("step") as string;

  if (step === "get-options") {
    const res = await fetch(`${API_URL}/v1/users/auth/passkey/login-options`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handle }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return {
        error: data.error === "no_passkey" ? "No passkey found for this handle" : "Login failed",
        handle,
      };
    }

    const options = await res.json();
    return { options, handle };
  }

  if (step === "verify") {
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

    const meRes = await fetch(`${API_URL}/v1/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!meRes.ok) {
      return { error: "Failed to verify user" };
    }

    const me = (await meRes.json()) as { handle: string; role: string };
    if (!["admin", "moderator", "editor"].includes(me.role)) {
      return { error: "Access denied. Admin, moderator, or editor role required." };
    }

    const session = await getSession(request);
    session.set("token", token);
    session.set("handle", me.handle);
    session.set("role", me.role);

    const destination = me.role === "editor" ? "/blog" : "/dashboard";
    return redirect(destination, {
      headers: { "Set-Cookie": await sessionStorage.commitSession(session) },
    });
  }

  return { error: "Invalid step" };
}

export default function Login() {
  const actionData = useActionData<typeof action>() as { error?: string; options?: unknown; handle?: string } | undefined;
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="relative flex min-h-screen min-h-[100dvh] items-center justify-center overflow-hidden p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="pointer-events-none absolute -top-24 right-[-20%] h-[70vw] w-[70vw] max-h-[520px] max-w-[520px] rounded-full bg-accent/10 blur-[120px]" />

      <div className="card relative w-full max-w-sm p-6 sm:p-8">
        <div className="mb-8 text-center">
          <img src="/secretlink.png" alt="" className="mx-auto mb-4 h-12 w-12" />
          <h1 className="text-xl font-extrabold tracking-tight">
            secretlink<span className="text-accent">.</span>life
          </h1>
          <p className="label-mono mt-2">Admin panel</p>
        </div>

        {actionData?.error && (
          <div className="mb-4 rounded-xl border border-danger/40 bg-danger/10 p-3">
            <p className="text-sm text-danger">{actionData.error}</p>
          </div>
        )}

        {!actionData?.options && (
          <Form method="post">
            <input type="hidden" name="step" value="get-options" />
            <label className="label-mono mb-2 block">Handle</label>
            <input
              name="handle"
              type="text"
              placeholder="your-handle"
              required
              defaultValue={actionData?.handle ?? ""}
              className="input mb-4 min-h-12"
              autoComplete="username webauthn"
            />
            <button type="submit" disabled={isSubmitting} className="btn btn-primary w-full min-h-12">
              {isSubmitting ? "Loading..." : "Sign in with Passkey"}
            </button>
          </Form>
        )}

        {actionData?.options ? (
          <PasskeyVerify options={actionData.options} handle={actionData.handle!} />
        ) : null}

        <p className="mt-8 text-center font-mono text-[10px] uppercase tracking-[0.16em] text-text-muted">
          Admin, moderator, and editor only
        </p>
      </div>
    </div>
  );
}

function PasskeyVerify({ options, handle }: { options: unknown; handle: string }) {
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const credentialRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { startAuthentication } = await import("@simplewebauthn/browser");
        const credential = await startAuthentication({ optionsJSON: options as never });
        if (cancelled) return;
        credentialRef.current!.value = JSON.stringify(credential);
        formRef.current!.submit();
      } catch (e: unknown) {
        if (cancelled) return;
        const message = e instanceof Error ? e.message : "Passkey authentication failed";
        setError(message);
      }
    })();
    return () => { cancelled = true; };
  }, [options]);

  return (
    <div>
      <p className="mb-4 text-sm text-text-muted">Passkey challenge received. Complete authentication on your device.</p>
      <form method="post" ref={formRef} action="/login">
        <input type="hidden" name="step" value="verify" />
        <input type="hidden" name="verifyHandle" value={handle} />
        <input type="hidden" name="credential" ref={credentialRef} />
      </form>
      {error ? (
        <p className="mt-2 text-sm text-danger">
          {error}. <a href="/login" className="text-accent underline">Try again</a>
        </p>
      ) : (
        <p className="animate-pulse text-sm text-text-muted">Waiting for passkey...</p>
      )}
    </div>
  );
}
