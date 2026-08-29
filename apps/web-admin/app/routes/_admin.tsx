import { useLoaderData } from "@remix-run/react";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { AdminShell } from "~/components/AdminShell";
import { adminApi } from "~/lib/api.server";
import { requirePanelSession } from "~/lib/session.server";
import type { AdminCounts, AdminStats } from "~/lib/stats";

export async function loader({ request }: LoaderFunctionArgs) {
  const { handle, role, token } = await requirePanelSession(request);
  let counts: AdminCounts = { openReports: 0, pendingAppeals: 0, newContactMessages: 0 };

  if (role === "admin" || role === "moderator") {
    try {
      const stats = await adminApi<AdminStats>("/stats", token);
      counts = {
        openReports: stats.openReports ?? 0,
        pendingAppeals: stats.pendingAppeals ?? 0,
        newContactMessages: stats.newContactMessages ?? 0,
      };
    } catch {
      // Nav badges are optional; the page loaders still fetch their own data.
    }
  }

  return { handle, role, counts };
}

export default function AdminLayout() {
  const { handle, role, counts } = useLoaderData<typeof loader>();
  return <AdminShell handle={handle} role={role} counts={counts} />;
}
