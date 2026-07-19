import type { LoaderFunctionArgs } from "@remix-run/node";
import { requireAdminSession } from "~/lib/session.server";
import { adminApi } from "~/lib/api.server";
import { useLoaderData } from "@remix-run/react";
import { PageHeader } from "~/components/PageHeader";

export async function loader({ request }: LoaderFunctionArgs) {
  const { token } = await requireAdminSession(request);
  const stats = await adminApi("/stats", token);
  return { stats };
}

export default function Dashboard() {
  const { stats } = useLoaderData<typeof loader>();
  const s = stats as Record<string, number>;

  const cards = [
    { label: "Open Reports", value: s.openReports, icon: "🚩", color: "var(--warning)" },
    { label: "Pending Appeals", value: s.pendingAppeals, icon: "⚖️", color: "var(--accent)" },
    { label: "New Contact Messages", value: s.newContactMessages, icon: "📬", color: "var(--accent)" },
    { label: "Total Users", value: s.users, icon: "👥", color: "var(--text)" },
    { label: "Active Secrets", value: s.activeSecrets, icon: "🗺️", color: "var(--success)" },
    { label: "Suspended Users", value: s.suspendedUsers, icon: "🚫", color: "var(--danger)" },
    { label: "Pending Deletions", value: s.pendingDeletions, icon: "🗑️", color: "var(--text-muted)" },
    { label: "Total Reports", value: s.totalReports, icon: "📋", color: "var(--text-muted)" },
  ];

  return (
    <div>
      <PageHeader title="Dashboard" />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="card">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-2xl">{card.icon}</span>
              <span className="text-3xl font-bold" style={{ color: card.color }}>
                {card.value}
              </span>
            </div>
            <p className="text-sm text-[var(--text-muted)]">{card.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
