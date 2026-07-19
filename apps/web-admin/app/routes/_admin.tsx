import { useLoaderData } from "@remix-run/react";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { AdminShell } from "~/components/AdminShell";
import { requireAdminSession } from "~/lib/session.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { handle, role } = await requireAdminSession(request);
  return { handle, role };
}

export default function AdminLayout() {
  const { handle, role } = useLoaderData<typeof loader>();
  return <AdminShell handle={handle} role={role} />;
}
