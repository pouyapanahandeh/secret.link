import type { LoaderFunctionArgs } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { PageHeader } from "~/components/PageHeader";
import { DonutChart, HorizontalBars, MiniBarChart, seriesValues } from "~/components/charts";
import { adminApi } from "~/lib/api.server";
import { requireAdminSession } from "~/lib/session.server";
import { seriesTotal, weekDelta, type AdminStats } from "~/lib/stats";

export async function loader({ request }: LoaderFunctionArgs) {
  const { token } = await requireAdminSession(request);
  const stats = await adminApi<AdminStats>("/stats", token);
  return { stats };
}

function deltaLabel(delta: number) {
  if (delta === 0) return "flat vs prior week";
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta} vs prior week`;
}

export default function Dashboard() {
  const { stats } = useLoaderData<typeof loader>();
  const s = stats;

  const attention = [
    {
      label: "Open reports",
      value: s.openReports,
      href: "/reports",
      color: "var(--color-warning)",
      hint: "Needs review",
    },
    {
      label: "Pending appeals",
      value: s.pendingAppeals,
      href: "/appeals",
      color: "var(--color-accent)",
      hint: "Waiting on a decision",
    },
    {
      label: "New messages",
      value: s.newContactMessages,
      href: "/contact-messages",
      color: "var(--color-accent-soft)",
      hint: "Unread contact inbox",
    },
  ];

  const platform = [
    { label: "Total users", value: s.users, color: "var(--color-text)", href: "/users" },
    { label: "Active secrets", value: s.activeSecrets, color: "var(--color-success)" },
    { label: "Suspended", value: s.suspendedUsers, color: "var(--color-danger)", href: "/users" },
    { label: "Pending deletions", value: s.pendingDeletions, color: "var(--color-text-muted)" },
  ];

  const activity = [
    {
      label: "New users",
      series: s.series?.users,
      color: "var(--color-accent)",
    },
    {
      label: "Reports filed",
      series: s.series?.reports,
      color: "var(--color-warning)",
    },
    {
      label: "Secrets posted",
      series: s.series?.secrets,
      color: "var(--color-success)",
    },
  ];

  const statusSegments = (s.reportsByStatus ?? []).map((row) => ({
    label: row.status,
    value: row.count,
    color:
      row.status === "open"
        ? "var(--color-warning)"
        : row.status === "actioned"
          ? "var(--color-success)"
          : "var(--color-border)",
  }));

  const reasonBars = (s.reportsByReason ?? []).map((row) => ({
    label: row.reason.replace(/_/g, " "),
    value: row.count,
  }));

  const roleBars = (s.usersByRole ?? []).map((row) => ({
    label: row.role,
    value: row.count,
  }));

  const queueTotal = s.openReports + s.pendingAppeals + s.newContactMessages;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={
          queueTotal > 0
            ? `${queueTotal} item${queueTotal === 1 ? "" : "s"} in the moderation queue`
            : "Queue is clear"
        }
      />

      <section className="mb-8">
        <h3 className="label-mono mb-3">Needs attention</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {attention.map((item) => (
            <Link
              key={item.label}
              to={item.href}
              className="card group relative overflow-hidden p-5 transition-colors hover:border-accent/40"
            >
              <div
                className="absolute inset-y-0 left-0 w-1"
                style={{ background: item.value > 0 ? item.color : "var(--color-border)" }}
              />
              <p className="label-mono">{item.label}</p>
              <p className="mt-2 text-4xl font-extrabold tabular-nums tracking-tight" style={{ color: item.color }}>
                {item.value}
              </p>
              <p className="mt-1 text-xs text-text-muted">{item.hint}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <h3 className="label-mono mb-3">Last 14 days</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {activity.map((item) => {
            const values = seriesValues(item.series);
            const total = seriesTotal(item.series);
            const delta = weekDelta(item.series);
            return (
              <div key={item.label} className="card">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <p className="label-mono">{item.label}</p>
                    <p className="mt-1 text-2xl font-extrabold tabular-nums">{total}</p>
                  </div>
                  <p className="text-right font-mono text-[10px] text-text-muted">{deltaLabel(delta)}</p>
                </div>
                <MiniBarChart values={values} color={item.color} />
              </div>
            );
          })}
        </div>
      </section>

      <section className="mb-8">
        <h3 className="label-mono mb-3">Platform</h3>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {platform.map((item) => {
            const body = (
              <>
                <p className="label-mono">{item.label}</p>
                <p className="mt-2 text-3xl font-extrabold tabular-nums tracking-tight" style={{ color: item.color }}>
                  {item.value}
                </p>
              </>
            );
            const className = "card p-5";
            return item.href ? (
              <Link key={item.label} to={item.href} className={`${className} transition-colors hover:border-accent/40`}>
                {body}
              </Link>
            ) : (
              <div key={item.label} className={className}>
                {body}
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="card">
          <h3 className="label-mono mb-5">Reports by status</h3>
          <DonutChart
            segments={
              statusSegments.length > 0
                ? statusSegments
                : [{ label: "none", value: 0, color: "var(--color-border)" }]
            }
          />
        </div>
        <div className="card">
          <h3 className="label-mono mb-5">Reports by reason</h3>
          <HorizontalBars items={reasonBars} empty="No reports yet" />
        </div>
        <div className="card lg:col-span-2">
          <h3 className="label-mono mb-5">Users by role</h3>
          <HorizontalBars items={roleBars} color="var(--color-accent-soft)" empty="No users yet" />
        </div>
      </section>
    </div>
  );
}
