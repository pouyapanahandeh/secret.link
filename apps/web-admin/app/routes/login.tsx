import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { Form, useActionData, useNavigation } from "@remix-run/react";
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
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="card w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-[var(--accent)]">🔒 Secretlink</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">Admin Panel</p>
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
  return (
    <div>
      <p className="text-sm text-[var(--text-muted)] mb-4">Passkey challenge received. Complete authentication on your device.</p>
      <Form method="post" id="verify-form">
        <input type="hidden" name="step" value="verify" />
        <input type="hidden" name="verifyHandle" value={handle} />
        <input type="hidden" name="credential" id="credential-input" />
      </Form>
      <script
        dangerouslySetInnerHTML={{
          __html: `
            (async function() {
              try {
                const options = ${JSON.stringify(options)};
                const { startAuthentication } = await import("https://cdn.jsdelivr.net/npm/@simplewebauthn/browser@13/dist/bundle/index.js");
                const credential = await startAuthentication({ optionsJSON: options });
                document.getElementById("credential-input").value = JSON.stringify(credential);
                document.getElementById("verify-form").submit();
              } catch (e) {
                console.error("Passkey auth failed:", e);
                document.querySelector(".card").innerHTML += '<p style="color:var(--danger);font-size:0.875rem;margin-top:1rem;">Passkey authentication failed. <a href="/login" style="color:var(--accent);">Try again</a></p>';
              }
            })();
          `,
        }}
      />
      <p className="text-sm text-[var(--text-muted)] animate-pulse">Waiting for passkey...</p>
    </div>
  );
}
