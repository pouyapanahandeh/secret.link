import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";

export async function loader(_args: LoaderFunctionArgs) {
  return redirect("/dashboard#map");
}

export default function MapRedirect() {
  return null;
}
