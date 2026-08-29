import type { DayCount } from "~/lib/stats";

export function MiniBarChart({
  values,
  color = "var(--color-accent)",
  height = 64,
}: {
  values: number[];
  color?: string;
  height?: number;
}) {
  const max = Math.max(...values, 1);

  return (
    <div className="flex items-end gap-[3px]" style={{ height }} aria-hidden="true">
      {values.map((value, i) => (
        <div
          key={i}
          className="min-h-px flex-1 rounded-sm"
          style={{
            height: `${Math.max((value / max) * 100, value > 0 ? 8 : 4)}%`,
            background: color,
            opacity: value > 0 ? 1 : 0.18,
          }}
        />
      ))}
    </div>
  );
}

export function HorizontalBars({
  items,
  color = "var(--color-accent)",
  empty = "No data yet",
}: {
  items: { label: string; value: number }[];
  color?: string;
  empty?: string;
}) {
  if (items.length === 0) {
    return <p className="py-6 text-center text-sm text-text-muted">{empty}</p>;
  }

  const max = Math.max(...items.map((item) => item.value), 1);

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <span className="truncate text-sm text-text">{item.label}</span>
            <span className="shrink-0 font-mono text-xs tabular-nums text-text-muted">{item.value}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-surface">
            <div
              className="h-full rounded-full"
              style={{ width: `${(item.value / max) * 100}%`, background: color }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function DonutChart({
  segments,
  size = 148,
}: {
  segments: { label: string; value: number; color: string }[];
  size?: number;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const r = 36;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="flex items-center gap-5">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          <circle cx="50" cy="50" r={r} fill="none" stroke="var(--color-border)" strokeWidth="10" />
          {total > 0 &&
            segments.map((segment) => {
              const dash = (segment.value / total) * c;
              const circle = (
                <circle
                  key={segment.label}
                  cx="50"
                  cy="50"
                  r={r}
                  fill="none"
                  stroke={segment.color}
                  strokeWidth="10"
                  strokeDasharray={`${dash} ${c - dash}`}
                  strokeDashoffset={-offset}
                  strokeLinecap="butt"
                />
              );
              offset += dash;
              return circle;
            })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-extrabold tabular-nums">{total}</span>
          <span className="label-mono">total</span>
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-2">
        {segments.map((segment) => (
          <li key={segment.label} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: segment.color }} />
              <span className="truncate capitalize text-text-muted">{segment.label}</span>
            </span>
            <span className="font-mono text-xs tabular-nums">{segment.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RatioBar({
  parts,
}: {
  parts: { label: string; value: number; color: string }[];
}) {
  const total = parts.reduce((sum, p) => sum + p.value, 0) || 1;

  return (
    <div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-surface">
        {parts.map((part) => (
          <div
            key={part.label}
            style={{ width: `${(part.value / total) * 100}%`, background: part.color }}
            title={`${part.label}: ${part.value}`}
          />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
        {parts.map((part) => (
          <span key={part.label} className="flex items-center gap-1.5 text-xs text-text-muted">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: part.color }} />
            {part.label}
            <span className="font-mono tabular-nums text-text">{part.value}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export function formatChartDay(day: string) {
  const date = new Date(`${day}T00:00:00Z`);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
}

export function seriesValues(series: DayCount[] | undefined): number[] {
  return (series ?? []).map((d) => d.count);
}
