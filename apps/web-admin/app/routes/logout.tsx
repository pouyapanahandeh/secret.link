import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { getSession, sessionStorage } from "~/lib/session.server";

const API_URL = process.env["API_URL"] ?? "http://localhost:4000";

export async function action({ request }: ActionFunctionArgs) {
  const session = await getSession(request);
  const token = session.get("token") as string | undefined;
  if (token) {
    await fetch(`${API_URL}/v1/users/auth/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  }
  return redirect("/login", {
    headers: { "Set-Cookie": await sessionStorage.destroySession(session) },
  });
}

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getSession(request);
  return redirect("/login", {
    headers: { "Set-Cookie": await sessionStorage.destroySession(session) },
  });
}
