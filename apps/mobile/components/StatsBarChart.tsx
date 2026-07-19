import Svg, { Rect } from "react-native-svg";

interface StatsBarChartProps {
  values: number[];
  labels: string[];
  color: string;
  height?: number;
}

export function StatsBarChart({ values, labels, color, height = 140 }: StatsBarChartProps) {
  const width = Math.max(values.length * 12, 280);
  const max = Math.max(...values, 1);
  const barGap = 3;
  const barWidth = Math.max(4, (width - barGap * (values.length + 1)) / values.length);
  const chartHeight = height - 24;

  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
      {values.map((value, i) => {
        const barHeight = (value / max) * chartHeight;
        const x = barGap + i * (barWidth + barGap);
        const y = chartHeight - barHeight + 4;
        return (
          <Rect
            key={labels[i] ?? i}
            x={x}
            y={y}
            width={barWidth}
            height={Math.max(barHeight, value > 0 ? 2 : 0)}
            rx={2}
            fill={color}
            opacity={value > 0 ? 1 : 0.2}
          />
        );
      })}
    </Svg>
  );
}
