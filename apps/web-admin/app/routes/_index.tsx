import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { getSession } from "~/lib/session.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getSession(request);
  const role = session.get("role") as string | undefined;
  if (session.get("token") && role) {
    return redirect(role === "editor" ? "/blog" : "/dashboard");
  }
  return redirect("/login");
}
