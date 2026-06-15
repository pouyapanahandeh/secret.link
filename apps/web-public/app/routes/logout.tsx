import type { ActionFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { destroySessionRedirect } from "../lib/session.server";

export async function action({ request }: ActionFunctionArgs) {
  return destroySessionRedirect(request, "/");
}

export async function loader() {
  return redirect("/");
}
