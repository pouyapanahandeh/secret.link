import type { ActionFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";

export async function action({ request: _request }: ActionFunctionArgs) {
  return redirect("/", {
    headers: {
      "Set-Cookie": "sl_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0",
    },
  });
}

export async function loader() {
  return redirect("/");
}
