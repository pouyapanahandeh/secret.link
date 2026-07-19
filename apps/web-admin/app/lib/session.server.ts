import { createCookieSessionStorage } from "@remix-run/node";

const SESSION_SECRET = process.env["SESSION_SECRET"] ?? "admin-dev-secret-change-me";

export const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "sl_admin",
    httpOnly: true,
    secure: process.env["NODE_ENV"] === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24, // 24 hours
    secrets: [SESSION_SECRET],
  },
});

export async function getSession(request: Request) {
  return sessionStorage.getSession(request.headers.get("Cookie"));
}

export async function requireAdminSession(request: Request) {
  const session = await getSession(request);
  const token = session.get("token");
  const handle = session.get("handle");
  const role = session.get("role");

  if (!token || !handle || !role) {
    throw new Response(null, { status: 302, headers: { Location: "/login" } });
  }

  if (role !== "admin" && role !== "moderator") {
    throw new Response("Forbidden", { status: 403 });
  }

  return { token, handle, role };
}

export async function requirePanelSession(request: Request) {
  const session = await getSession(request);
  const token = session.get("token");
  const handle = session.get("handle");
  const role = session.get("role");

  if (!token || !handle || !role) {
    throw new Response(null, { status: 302, headers: { Location: "/login" } });
  }

  if (!["admin", "moderator", "editor"].includes(role)) {
    throw new Response("Forbidden", { status: 403 });
  }

  return { token, handle, role };
}

export async function requireBlogEditorSession(request: Request) {
  const session = await requirePanelSession(request);
  if (session.role !== "admin" && session.role !== "editor") {
    throw new Response("Forbidden", { status: 403 });
  }
  return session;
}

export async function requireBlogReaderSession(request: Request) {
  return requirePanelSession(request);
}
