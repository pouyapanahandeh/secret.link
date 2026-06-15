import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { createSessionRedirect } from "../lib/session.server";
import { API_URL } from "../lib/api.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return redirect("/login");
  }

  // Exchange magic link token for session
  const res = await fetch(`${API_URL}/v1/users/auth/magic-link/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });

  if (!res.ok) {
    return redirect("/login?error=expired");
  }

  const { token: sessionToken } = await res.json();

  return createSessionRedirect(sessionToken, "/dashboard");
}

export default function AuthVerify() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <p className="text-text-muted">Verifying your login link...</p>
    </main>
  );
}
