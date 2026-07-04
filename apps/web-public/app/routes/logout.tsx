import type { ActionFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { destroySessionRedirect } from "../lib/session.server";
import { getToken } from "../lib/session.server";
import { API_URL } from "../lib/api.server";

export async function action({ request }: ActionFunctionArgs) {
  // Revoke the JWT server-side so it can't be reused, then clear our session.
  const token = await getToken(request);
  if (token) {
    await fetch(`${API_URL}/v1/users/auth/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  }
  return destroySessionRedirect(request, "/");
}

export async function loader() {
  return redirect("/");
}
