interface StatsBarChartProps {
  values: number[];
  labels: string[];
  className?: string;
}

export function StatsBarChart({ values, labels, className }: StatsBarChartProps) {
  if (values.length === 0) {
    return (
      <div className={`flex items-center justify-center text-xs text-text-muted ${className ?? "h-[120px]"}`}>
        No activity in this period
      </div>
    );
  }

  const height = 130;
  const width = Math.max(values.length * 10, 300);
  const max = Math.max(...values, 1);
  const barGap = 2;
  const barWidth = Math.max(3, (width - barGap * (values.length + 1)) / values.length);
  const chartHeight = height - 8;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={className ?? "w-full h-[120px]"}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      {/* Baseline */}
      <line
        x1={0}
        y1={chartHeight}
        x2={width}
        y2={chartHeight}
        className="stroke-border/40"
        strokeWidth={1}
      />
      {values.map((value, i) => {
        const barHeight = (value / max) * (chartHeight - 12);
        const x = barGap + i * (barWidth + barGap);
        const y = chartHeight - barHeight;
        const isPeak = value === max && value > 0;
        return (
          <rect
            key={labels[i] ?? i}
            x={x}
            y={y}
            width={barWidth}
            height={Math.max(barHeight, value > 0 ? 3 : 0)}
            rx={Math.min(barWidth / 2, 3)}
            className={isPeak ? "fill-accent" : "fill-accent/70"}
            opacity={value > 0 ? 1 : 0.15}
          />
        );
      })}
    </svg>
  );
}
