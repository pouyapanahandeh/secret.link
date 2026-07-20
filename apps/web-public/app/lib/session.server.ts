import { createCookieSessionStorage, redirect } from "@remix-run/node";

const SESSION_SECRET = process.env["SESSION_SECRET"] ?? "dev-secret-change-me";

const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "sl_session",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60, // 7 days
    secrets: [SESSION_SECRET],
  },
});

export async function getSession(request: Request) {
  return sessionStorage.getSession(request.headers.get("Cookie"));
}

export async function getToken(request: Request): Promise<string | null> {
  const session = await getSession(request);
  return session.get("token") ?? null;
}

export async function requireToken(request: Request): Promise<string> {
  const token = await getToken(request);
  if (!token) throw redirect("/login");
  return token;
}

export async function createSessionRedirect(token: string, redirectTo: string) {
  const session = await sessionStorage.getSession();
  session.set("token", token);
  return redirect(redirectTo, {
    headers: { "Set-Cookie": await sessionStorage.commitSession(session) },
  });
}

export async function destroySessionRedirect(request: Request, redirectTo: string = "/") {
  const session = await getSession(request);
  return redirect(redirectTo, {
    headers: { "Set-Cookie": await sessionStorage.destroySession(session) },
  });
}
