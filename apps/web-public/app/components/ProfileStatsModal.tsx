import { useEffect, useMemo, useState } from "react";
import { getApiBase } from "../lib/api.client";
import { StatsBarChart } from "./StatsBarChart";

export interface ProfileStatsTotals {
  profileViews: number;
  qrScans: number;
  socialClicks: number;
  secretsReceived: number;
  secretsSent: number;
}

export interface ProfileStatsDay extends ProfileStatsTotals {
  day: string;
}

export interface ProfileStatsResponse {
  days: number;
  totals: ProfileStatsTotals;
  series: ProfileStatsDay[];
}

interface ProfileStatsModalProps {
  token: string;
  onClose: () => void;
}

type DayRange = 7 | 14 | 30;
type MetricFilter = "all" | "profileViews" | "qrScans" | "socialClicks" | "secrets";

const RANGE_OPTIONS: Array<{ days: DayRange; label: string }> = [
  { days: 7, label: "7 days" },
  { days: 14, label: "14 days" },
  { days: 30, label: "30 days" },
];

const BREAKDOWN_ITEMS: Array<{
  key: MetricFilter;
  label: string;
  totalKey?: keyof ProfileStatsTotals;
}> = [
  { key: "profileViews", label: "Visits", totalKey: "profileViews" },
  { key: "qrScans", label: "QR scans", totalKey: "qrScans" },
  { key: "socialClicks", label: "Social", totalKey: "socialClicks" },
  { key: "secrets", label: "Secrets", totalKey: undefined },
];

const METRIC_LABELS: Record<MetricFilter, string> = {
  all: "Total interactions",
  profileViews: "Profile visits",
  qrScans: "QR scans",
  socialClicks: "Social clicks",
  secrets: "Secrets activity",
};

function valueForDay(day: ProfileStatsDay, metric: MetricFilter): number {
  switch (metric) {
    case "all":
      return (
        day.profileViews +
        day.qrScans +
        day.socialClicks +
        day.secretsReceived +
        day.secretsSent
      );
    case "secrets":
      return day.secretsReceived + day.secretsSent;
    case "profileViews":
    case "qrScans":
    case "socialClicks":
      return day[metric];
    default:
      return 0;
  }
}

function formatShortDate(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function getBreakdownValue(
  stats: ProfileStatsResponse,
  item: (typeof BREAKDOWN_ITEMS)[number],
): number {
  if (item.key === "secrets") {
    return stats.totals.secretsReceived + stats.totals.secretsSent;
  }
  if (item.totalKey) {
    return stats.totals[item.totalKey];
  }
  return 0;
}

function getAllTotal(stats: ProfileStatsResponse): number {
  const t = stats.totals;
  return t.profileViews + t.qrScans + t.socialClicks + t.secretsReceived + t.secretsSent;
}

function Pulse({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-xl bg-surface-raised ${className}`} />;
}

function ProfileStatsContentSkeleton() {
  return (
    <div className="space-y-6 min-h-[520px]" aria-hidden="true">
      <section>
        <Pulse className="h-3 w-40 mb-3" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Pulse key={i} className="h-[72px] rounded-2xl" />
          ))}
        </div>
        <Pulse className="h-[52px] w-full mt-3 rounded-2xl" />
      </section>

      <section className="text-center py-1 space-y-2">
        <Pulse className="h-12 w-28 mx-auto rounded-2xl" />
        <Pulse className="h-4 w-40 mx-auto rounded-lg" />
      </section>

      <section className="rounded-2xl bg-surface-raised/50 border border-border/40 px-4 py-5">
        <Pulse className="h-[120px] sm:h-[130px] w-full rounded-xl" />
        <div className="flex justify-between mt-4 pt-3 border-t border-border/30">
          <Pulse className="h-3 w-14 rounded-lg" />
          <Pulse className="h-3 w-14 rounded-lg" />
        </div>
      </section>
    </div>
  );
}

export function ProfileStatsModal({ token, onClose }: ProfileStatsModalProps) {
  const [range, setRange] = useState<DayRange>(30);
  const [metric, setMetric] = useState<MetricFilter>("all");
  const [stats, setStats] = useState<ProfileStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetch(`${getApiBase()}/v1/users/me/stats?days=${range}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load stats");
        return r.json();
      })
      .then((data: ProfileStatsResponse) => {
        if (!cancelled) setStats(data);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load statistics");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, range]);

  const chartValues = useMemo(() => {
    if (!stats) return [] as number[];
    return stats.series.map((day) => valueForDay(day, metric));
  }, [stats, metric]);

  const periodTotal = useMemo(
    () => chartValues.reduce((sum, n) => sum + n, 0),
    [chartValues],
  );

  const rangeLabel = RANGE_OPTIONS.find((r) => r.days === range)?.label ?? `${range} days`;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/50" aria-hidden="true" onClick={onClose} />

      <div
        role="dialog"
        aria-label="Profile statistics"
        className="relative z-10 w-full sm:max-w-md max-h-[92vh] sm:max-h-[88vh] bg-surface border border-border/40 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-[slideUp_0.28s_cubic-bezier(0.32,0.72,0,1)] sm:animate-none"
      >
        <div className="sm:hidden flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-border/80" />
        </div>

        <div className="px-6 pt-2 sm:pt-5 pb-4 shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-text tracking-tight">Statistics</h2>
              <p className="text-sm text-text-muted mt-0.5">{rangeLabel} overview</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-surface-raised border border-border text-text-muted hover:text-text flex items-center justify-center text-lg leading-none shrink-0"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>

        <div className="px-6 pb-6 overflow-y-auto flex-1 space-y-6">
          {/* Period selector */}
          <div className="flex p-1 rounded-2xl bg-surface-raised border border-border/60">
            {RANGE_OPTIONS.map(({ days, label }) => {
              const active = range === days;
              return (
                <button
                  key={days}
                  type="button"
                  onClick={() => setRange(days)}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    active
                      ? "bg-surface text-text shadow-sm"
                      : "text-text-muted hover:text-text"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {loading && <ProfileStatsContentSkeleton />}

          {error && !loading && (
            <div className="py-12 text-center rounded-2xl bg-surface-raised border border-border/60 min-h-[520px] flex items-center justify-center">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {stats && !loading && (
            <div className="min-h-[520px] space-y-6">
              {/* Breakdown - tap to filter chart */}
              <section>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted/70 mb-3">
                  Overview · tap to filter chart
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {BREAKDOWN_ITEMS.map((item) => {
                    const active = metric === item.key;
                    const value = getBreakdownValue(stats, item);
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setMetric(item.key)}
                        className={`rounded-2xl border px-4 py-3.5 text-left transition-all ${
                          active
                            ? "bg-accent/10 border-accent"
                            : "bg-surface-raised/80 border-border/40 hover:border-accent/30"
                        }`}
                      >
                        <p className="text-xs text-text-muted mb-1">{item.label}</p>
                        <p
                          className={`text-xl font-bold tabular-nums ${
                            active ? "text-accent" : "text-text"
                          }`}
                        >
                          {value.toLocaleString()}
                        </p>
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => setMetric("all")}
                  className={`w-full mt-3 rounded-2xl border px-4 py-3.5 flex items-center justify-between transition-all ${
                    metric === "all"
                      ? "bg-accent/10 border-accent"
                      : "bg-surface-raised/80 border-border/40 hover:border-accent/30"
                  }`}
                >
                  <span className="text-xs text-text-muted">All interactions</span>
                  <span
                    className={`text-xl font-bold tabular-nums ${
                      metric === "all" ? "text-accent" : "text-text"
                    }`}
                  >
                    {getAllTotal(stats).toLocaleString()}
                  </span>
                </button>
              </section>

              {/* Hero metric */}
              <section className="text-center py-1">
                <p className="text-4xl sm:text-5xl font-bold text-accent tabular-nums tracking-tight">
                  {periodTotal.toLocaleString()}
                </p>
                <p className="text-sm text-text-muted mt-2">
                  {METRIC_LABELS[metric]} · {rangeLabel.toLowerCase()}
                </p>
              </section>

              {/* Chart */}
              <section className="rounded-2xl bg-surface-raised/50 border border-border/40 px-4 py-5">
                <StatsBarChart
                  values={chartValues}
                  labels={stats.series.map((d) => d.day)}
                  className="w-full h-[120px] sm:h-[130px]"
                />
                <div className="flex justify-between mt-4 pt-3 border-t border-border/30">
                  <span className="text-[11px] text-text-muted">
                    {formatShortDate(stats.series[0]?.day ?? "")}
                  </span>
                  <span className="text-[11px] text-text-muted">
                    {formatShortDate(stats.series[stats.series.length - 1]?.day ?? "")}
                  </span>
                </div>
              </section>
            </div>
          )}
        </div>

        <div className="px-6 py-4 shrink-0 border-t border-border/30 bg-surface pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <p className="text-[11px] text-text-muted/60 text-center leading-relaxed">
            Aggregate counts only - no visitor identities stored.
          </p>
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0.6; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
