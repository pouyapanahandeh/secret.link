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

const METRIC_OPTIONS: Array<{ id: MetricFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "profileViews", label: "Visits" },
  { id: "qrScans", label: "QR" },
  { id: "socialClicks", label: "Social" },
  { id: "secrets", label: "Secrets" },
];

const METRIC_LABELS: Record<MetricFilter, string> = {
  all: "Total interactions",
  profileViews: "Profile visits",
  qrScans: "QR scans",
  socialClicks: "Social clicks",
  secrets: "Secrets activity",
};

const BREAKDOWN_ITEMS: Array<{ key: keyof ProfileStatsTotals; label: string }> = [
  { key: "profileViews", label: "Visits" },
  { key: "qrScans", label: "QR scans" },
  { key: "socialClicks", label: "Social" },
  { key: "secretsReceived", label: "Received" },
  { key: "secretsSent", label: "Sent" },
];

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

        {/* Header */}
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
          <section>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted/70 mb-2.5">
              Time period
            </p>
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
          </section>

          {/* Metric selector */}
          <section>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted/70 mb-2.5">
              Chart
            </p>
            <div className="flex flex-wrap gap-2">
              {METRIC_OPTIONS.map((opt) => {
                const active = metric === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setMetric(opt.id)}
                    className={`px-3.5 py-2 rounded-full text-xs font-medium transition-all ${
                      active
                        ? "bg-accent text-black"
                        : "bg-surface-raised text-text-muted hover:text-text border border-border/60"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </section>

          {loading && (
            <div className="py-16 text-center">
              <div className="inline-block w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
              <p className="text-sm text-text-muted mt-3">Loading stats…</p>
            </div>
          )}

          {error && (
            <div className="py-12 text-center rounded-2xl bg-surface-raised border border-border/60">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {stats && !loading && (
            <>
              {/* Hero metric */}
              <section className="text-center py-2">
                <p className="text-4xl sm:text-5xl font-bold text-accent tabular-nums tracking-tight">
                  {periodTotal.toLocaleString()}
                </p>
                <p className="text-sm text-text-muted mt-2">{METRIC_LABELS[metric]}</p>
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

              {/* Breakdown grid */}
              <section>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted/70 mb-3">
                  Breakdown
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {BREAKDOWN_ITEMS.map(({ key, label }) => (
                    <div
                      key={key}
                      className="rounded-2xl bg-surface-raised/80 border border-border/40 px-4 py-3.5"
                    >
                      <p className="text-xs text-text-muted mb-1">{label}</p>
                      <p className="text-xl font-bold text-text tabular-nums">
                        {stats.totals[key].toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
        </div>

        <div className="px-6 py-4 shrink-0 border-t border-border/30 bg-surface pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <p className="text-[11px] text-text-muted/60 text-center leading-relaxed">
            Aggregate counts only — visible to you. No visitor identities stored.
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
