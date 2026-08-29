import type { LoaderFunctionArgs } from "@remix-run/node";
import { requireAdminSession } from "~/lib/session.server";
import { adminApi } from "~/lib/api.server";
import { useLoaderData } from "@remix-run/react";
import { PageHeader } from "~/components/PageHeader";
import { DonutChart, HorizontalBars, RatioBar } from "~/components/charts";

export async function loader({ request }: LoaderFunctionArgs) {
  const { token } = await requireAdminSession(request);
  const data = await adminApi("/transparency", token);
  return { stats: data as TransparencyStats };
}

interface TransparencyStats {
  period: { from: string; to: string };
  reports: {
    total: number;
    actioned: number;
    dismissed: number;
    byReason: { reason: string; count: number }[];
  };
  actions: { removals: number; warnings: number; suspensions: number; bans: number };
  appeals: { total: number; upheld: number; reversed: number };
}

export default function Transparency() {
  const { stats } = useLoaderData<typeof loader>();
  const reports = stats.reports;
  const openish = Math.max(reports.total - reports.actioned - reports.dismissed, 0);

  return (
    <div>
      <PageHeader
        title="Transparency"
        subtitle={`${new Date(stats.period.from).toLocaleDateString()} – ${new Date(stats.period.to).toLocaleDateString()}`}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <h3 className="label-mono mb-5">Reports</h3>
          <RatioBar
            parts={[
              { label: "Actioned", value: reports.actioned, color: "var(--color-success)" },
              { label: "Dismissed", value: reports.dismissed, color: "var(--color-text-muted)" },
              { label: "Other", value: openish, color: "var(--color-warning)" },
            ]}
          />
          <div className="mt-6">
            <HorizontalBars
              items={(reports.byReason ?? []).map((r) => ({
                label: r.reason.replace(/_/g, " "),
                value: r.count,
              }))}
              empty="No reports in this period"
            />
          </div>
        </div>

        <div className="card">
          <h3 className="label-mono mb-5">Volume</h3>
          <p className="text-4xl font-extrabold tabular-nums tracking-tight">{reports.total}</p>
          <p className="mt-1 text-sm text-text-muted">reports received</p>
          <dl className="mt-6 space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-text-muted">Actioned</dt>
              <dd className="font-semibold tabular-nums text-success">{reports.actioned}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-muted">Dismissed</dt>
              <dd className="font-semibold tabular-nums">{reports.dismissed}</dd>
            </div>
          </dl>
        </div>

        <div className="card">
          <h3 className="label-mono mb-5">Actions taken</h3>
          <DonutChart
            segments={[
              { label: "Removals", value: stats.actions.removals, color: "var(--color-danger)" },
              { label: "Warnings", value: stats.actions.warnings, color: "var(--color-warning)" },
              { label: "Suspensions", value: stats.actions.suspensions, color: "var(--color-accent)" },
              { label: "Bans", value: stats.actions.bans, color: "var(--color-text-muted)" },
            ]}
          />
        </div>

        <div className="card lg:col-span-2">
          <h3 className="label-mono mb-5">Appeals</h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl border border-border bg-surface p-4">
              <p className="label-mono">Received</p>
              <p className="mt-2 text-3xl font-extrabold tabular-nums">{stats.appeals.total}</p>
            </div>
            <div className="rounded-2xl border border-border bg-surface p-4">
              <p className="label-mono">Upheld</p>
              <p className="mt-2 text-3xl font-extrabold tabular-nums">{stats.appeals.upheld}</p>
            </div>
            <div className="rounded-2xl border border-border bg-surface p-4">
              <p className="label-mono">Reversed</p>
              <p className="mt-2 text-3xl font-extrabold tabular-nums text-success">{stats.appeals.reversed}</p>
            </div>
          </div>
          <div className="mt-6">
            <RatioBar
              parts={[
                { label: "Upheld", value: stats.appeals.upheld, color: "var(--color-text-muted)" },
                { label: "Reversed", value: stats.appeals.reversed, color: "var(--color-success)" },
              ]}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
