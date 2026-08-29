import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Link, useLoaderData, useNavigate } from "@remix-run/react";
import { useState } from "react";
import { commitTokenCookie, createSessionRedirect, requireToken } from "../lib/session.server";
import { API_URL, publicApiBase } from "../lib/api.server";
import { SiteChrome } from "../components/SiteChrome";
import { AddPasskeyButton } from "../components/passkeys/AddPasskeyButton";
import { RecoveryCodesPanel } from "../components/passkeys/RecoveryCodesPanel";

export const meta: MetaFunction = () => [
  { title: "Recover account - Secretlink.life" },
];

export async function loader({ request }: LoaderFunctionArgs) {
  const token = await requireToken(request);
  try {
    const res = await fetch(`${API_URL}/v1/users/me/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw redirect("/login");
    const user = await res.json();
    if (!user?.handle) throw redirect("/login");
    if (!user.enrollmentRequired) throw redirect("/dashboard");
    return json({ user, token, apiBase: publicApiBase(request) });
  } catch (err) {
    if (err instanceof Response) throw err;
    throw redirect("/login");
  }
}

export async function action({ request }: ActionFunctionArgs) {
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");
  const token = String(form.get("token") ?? "").trim();
  if (!token) {
    return json({ error: "Missing token" }, { status: 400 });
  }
  if (intent === "begin") {
    return createSessionRedirect(token, "/recover-passkey");
  }
  if (intent === "commit") {
    return json({ ok: true }, { headers: { "Set-Cookie": await commitTokenCookie(token) } });
  }
  return json({ error: "Unknown intent" }, { status: 400 });
}

export default function RecoverPasskey() {
  const { user, token, apiBase } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);

  return (
    <SiteChrome isLoggedIn currentPath="/login">
      <div className="mx-auto max-w-xl px-4 sm:px-6 pt-28 sm:pt-32 pb-20">
        {recoveryCodes ? (
          <RecoveryCodesPanel
            codes={recoveryCodes}
            confirmLabel="Go to dashboard"
            onConfirmed={() => navigate("/dashboard")}
          />
        ) : (
          <div className="space-y-6">
            <p className="text-[11px] font-semibold tracking-[0.28em] uppercase text-accent">
              Recover
            </p>
            <h1 className="font-extrabold tracking-[-0.04em] text-3xl sm:text-5xl leading-[0.95]">
              Add a new passkey
            </h1>
            <p className="text-text-muted text-sm leading-relaxed">
              Sign in as @{user.handle} with a passkey on this device. Other passkeys will be
              removed so a lost device cannot be used.
            </p>
            <AddPasskeyButton
              token={token}
              apiBase={apiBase}
              label="Add passkey"
              onSuccess={async (result) => {
                if (result.token) {
                  const form = new FormData();
                  form.append("intent", "commit");
                  form.append("token", result.token);
                  await fetch("/recover-passkey", { method: "POST", body: form });
                }
                if (result.recoveryCodes?.length) {
                  setRecoveryCodes(result.recoveryCodes);
                } else {
                  navigate("/dashboard");
                }
              }}
            />
          </div>
        )}
      </div>
    </SiteChrome>
  );
}

export function ErrorBoundary() {
  return (
    <SiteChrome currentPath="/login">
      <div className="mx-auto max-w-xl px-4 sm:px-6 pt-28 sm:pt-32 pb-20">
        <h1 className="font-extrabold tracking-[-0.04em] text-3xl mb-4">
          Could not open recovery
        </h1>
        <p className="text-text-muted text-sm mb-6">
          This page only works right after you enter a recovery code. Start again from login.
        </p>
        <Link to="/login" className="text-sm font-semibold text-accent hover:underline">
          Back to login
        </Link>
      </div>
    </SiteChrome>
  );
}
