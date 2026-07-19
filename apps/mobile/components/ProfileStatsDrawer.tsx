import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  ActivityIndicator,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme, spacing, radius, fontSize } from "@/lib/theme";
import { usersApi, type ProfileStatsDay, type ProfileStatsResponse } from "@/lib/api";
import { StatsBarChart } from "@/components/StatsBarChart";

interface ProfileStatsDrawerProps {
  visible: boolean;
  onClose: () => void;
}

type DayRange = 7 | 14 | 30;
type MetricFilter = "all" | "profileViews" | "qrScans" | "socialClicks" | "secrets";

const RANGE_OPTIONS: DayRange[] = [7, 14, 30];

const METRIC_OPTIONS: Array<{ id: MetricFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "profileViews", label: "Visits" },
  { id: "qrScans", label: "QR" },
  { id: "socialClicks", label: "Social" },
  { id: "secrets", label: "Secrets" },
];

const STAT_LABELS: Record<Exclude<MetricFilter, "all" | "secrets">, string> = {
  profileViews: "Profile visits",
  qrScans: "QR scans",
  socialClicks: "Social clicks",
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

function formatDayLabel(day: string, range: DayRange): string {
  const d = new Date(`${day}T00:00:00Z`);
  if (range <= 7) {
    return d.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 2);
  }
  return String(d.getUTCDate());
}

export function ProfileStatsDrawer({ visible, onClose }: ProfileStatsDrawerProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();

  const [range, setRange] = useState<DayRange>(30);
  const [metric, setMetric] = useState<MetricFilter>("all");
  const [stats, setStats] = useState<ProfileStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    usersApi
      .getStats(range)
      .then((data) => {
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
  }, [visible, range]);

  const chartData = useMemo(() => {
    if (!stats) return { values: [] as number[], labels: [] as string[] };
    const values = stats.series.map((day) => valueForDay(day, metric));
    const labels = stats.series.map((day) => formatDayLabel(day.day, range));
    return { values, labels };
  }, [stats, metric, range]);

  const periodTotal = useMemo(() => {
    if (!stats) return 0;
    return chartData.values.reduce((sum, n) => sum + n, 0);
  }, [stats, chartData.values]);

  const summaryItems = useMemo(() => {
    if (!stats) return [];
    const t = stats.totals;
    return [
      { label: "Visits", value: t.profileViews },
      { label: "QR scans", value: t.qrScans },
      { label: "Social", value: t.socialClicks },
      { label: "Received", value: t.secretsReceived },
      { label: "Sent", value: t.secretsSent },
    ];
  }, [stats]);

  const metricLabel =
    metric === "all"
      ? "All interactions"
      : metric === "secrets"
        ? "Secrets"
        : STAT_LABELS[metric];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)" }}
          onPress={onClose}
        />

        <View
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            borderWidth: 1,
            borderBottomWidth: 0,
            borderColor: colors.border,
            maxHeight: "88%",
            paddingBottom: insets.bottom + spacing.md,
          }}
        >
          <View style={{ alignItems: "center", paddingTop: spacing.sm, paddingBottom: spacing.xs }}>
            <View
              style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                backgroundColor: colors.border,
              }}
            />
          </View>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: spacing.lg,
              paddingBottom: spacing.md,
            }}
          >
            <Text style={{ fontSize: fontSize.lg, fontWeight: "700", color: colors.text }}>
              Statistics
            </Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={{ fontSize: fontSize.xl, color: colors.textMuted }}>×</Text>
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.lg }}
            showsVerticalScrollIndicator={false}
          >
            <Text style={{ fontSize: fontSize.xs, color: colors.textMuted, marginBottom: spacing.md }}>
              Last {range} days · aggregate only · no visitor identities stored
            </Text>

            {/* Time range filter */}
            <View style={{ flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md }}>
              {RANGE_OPTIONS.map((days) => {
                const active = range === days;
                return (
                  <Pressable
                    key={days}
                    onPress={() => setRange(days)}
                    style={{
                      flex: 1,
                      paddingVertical: spacing.sm,
                      borderRadius: radius.full,
                      alignItems: "center",
                      backgroundColor: active ? colors.accent : colors.surfaceRaised,
                      borderWidth: 1,
                      borderColor: active ? colors.accent : colors.border,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: fontSize.xs,
                        fontWeight: "700",
                        color: active ? "#000" : colors.textMuted,
                      }}
                    >
                      {days}d
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Metric filter */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: spacing.sm, marginBottom: spacing.lg }}
            >
              {METRIC_OPTIONS.map((opt) => {
                const active = metric === opt.id;
                return (
                  <Pressable
                    key={opt.id}
                    onPress={() => setMetric(opt.id)}
                    style={{
                      paddingHorizontal: spacing.md,
                      paddingVertical: spacing.sm,
                      borderRadius: radius.full,
                      backgroundColor: active ? colors.surfaceRaised : colors.transparent,
                      borderWidth: 1,
                      borderColor: active ? colors.accent : colors.border,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: fontSize.xs,
                        fontWeight: "600",
                        color: active ? colors.text : colors.textMuted,
                      }}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {loading && (
              <ActivityIndicator size="small" color={colors.accent} style={{ marginVertical: spacing.xl }} />
            )}
            {error ? (
              <Text style={{ fontSize: fontSize.sm, color: colors.danger, textAlign: "center" }}>
                {error}
              </Text>
            ) : null}

            {stats && !loading && (
              <>
                <View
                  style={{
                    backgroundColor: colors.surfaceRaised,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: radius.lg,
                    padding: spacing.md,
                    marginBottom: spacing.lg,
                  }}
                >
                  <Text style={{ fontSize: fontSize.xs, color: colors.textMuted, marginBottom: 4 }}>
                    {metricLabel} · last {range} days
                  </Text>
                  <Text style={{ fontSize: fontSize["2xl"], fontWeight: "800", color: colors.accent }}>
                    {periodTotal.toLocaleString()}
                  </Text>
                </View>

                <View
                  style={{
                    backgroundColor: colors.surfaceRaised,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: radius.lg,
                    padding: spacing.md,
                    marginBottom: spacing.lg,
                    overflow: "hidden",
                  }}
                >
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={{ width: Math.max(screenWidth - spacing.lg * 2 - spacing.md * 2, chartData.values.length * 12) }}>
                      <StatsBarChart
                        values={chartData.values}
                        labels={chartData.labels}
                        color={colors.accent}
                      />
                    </View>
                  </ScrollView>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: spacing.sm }}>
                    <Text style={{ fontSize: fontSize.xs, color: colors.textMuted }}>
                      {stats.series[0]?.day.slice(5).replace("-", "/")}
                    </Text>
                    <Text style={{ fontSize: fontSize.xs, color: colors.textMuted }}>
                      {stats.series[stats.series.length - 1]?.day.slice(5).replace("-", "/")}
                    </Text>
                  </View>
                </View>

                <Text
                  style={{
                    fontSize: fontSize.sm,
                    fontWeight: "600",
                    color: colors.text,
                    marginBottom: spacing.sm,
                  }}
                >
                  Breakdown
                </Text>
                {summaryItems.map((item) => (
                  <View
                    key={item.label}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      backgroundColor: colors.surfaceRaised,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: radius.lg,
                      padding: spacing.md,
                      marginBottom: spacing.sm,
                    }}
                  >
                    <Text style={{ fontSize: fontSize.sm, color: colors.text }}>{item.label}</Text>
                    <Text style={{ fontSize: fontSize.base, fontWeight: "700", color: colors.accent }}>
                      {item.value.toLocaleString()}
                    </Text>
                  </View>
                ))}
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
