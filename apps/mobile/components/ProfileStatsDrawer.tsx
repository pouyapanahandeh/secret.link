import { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  ScrollView,
  Animated,
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

const RANGE_OPTIONS: Array<{ days: DayRange; label: string }> = [
  { days: 7, label: "7 days" },
  { days: 14, label: "14 days" },
  { days: 30, label: "30 days" },
];

const BREAKDOWN_ITEMS: Array<{
  key: MetricFilter;
  label: string;
  totalKey?: keyof ProfileStatsResponse["totals"];
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

function formatDayLabel(day: string, range: DayRange): string {
  const d = new Date(`${day}T00:00:00Z`);
  if (range <= 7) {
    return d.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 2);
  }
  return String(d.getUTCDate());
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

function SkeletonBlock({
  colors,
  style,
}: {
  colors: ReturnType<typeof useTheme>["colors"];
  style?: object;
}) {
  const opacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.85, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.45, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          backgroundColor: colors.surfaceRaised,
          borderRadius: radius.lg,
          opacity,
        },
        style,
      ]}
    />
  );
}

function ProfileStatsContentSkeleton({ colors }: { colors: ReturnType<typeof useTheme>["colors"] }) {
  return (
    <View style={{ minHeight: 520, gap: spacing.lg }} accessibilityElementsHidden>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonBlock key={i} colors={colors} style={{ width: "47%", height: 72 }} />
        ))}
        <SkeletonBlock colors={colors} style={{ width: "100%", height: 52 }} />
      </View>

      <View style={{ alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xs }}>
        <SkeletonBlock colors={colors} style={{ width: 112, height: 48, borderRadius: radius.xl }} />
        <SkeletonBlock colors={colors} style={{ width: 160, height: 16, borderRadius: radius.sm }} />
      </View>

      <View
        style={{
          backgroundColor: colors.surfaceRaised,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: radius.lg,
          padding: spacing.md,
        }}
      >
        <SkeletonBlock colors={colors} style={{ width: "100%", height: 120, borderRadius: radius.md }} />
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            marginTop: spacing.sm,
            paddingTop: spacing.sm,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          <SkeletonBlock colors={colors} style={{ width: 56, height: 12, borderRadius: radius.sm }} />
          <SkeletonBlock colors={colors} style={{ width: 56, height: 12, borderRadius: radius.sm }} />
        </View>
      </View>
    </View>
  );
}

export function ProfileStatsDrawer({ visible, onClose }: ProfileStatsDrawerProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

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

  const rangeLabel = RANGE_OPTIONS.find((r) => r.days === range)?.label ?? `${range} days`;

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
            maxHeight: "92%",
            paddingBottom: insets.bottom + spacing.md,
          }}
        >
          <View style={{ alignItems: "center", paddingTop: spacing.sm, paddingBottom: spacing.xs }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
          </View>

          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-start",
              justifyContent: "space-between",
              paddingHorizontal: spacing.lg,
              paddingBottom: spacing.md,
            }}
          >
            <View>
              <Text style={{ fontSize: fontSize.lg, fontWeight: "700", color: colors.text }}>
                Statistics
              </Text>
              <Text style={{ fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 }}>
                {rangeLabel} overview
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={{ fontSize: fontSize.xl, color: colors.textMuted }}>×</Text>
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.lg }}
            showsVerticalScrollIndicator={false}
          >
            {/* Time range */}
            <View
              style={{
                flexDirection: "row",
                padding: 4,
                borderRadius: radius.lg,
                backgroundColor: colors.surfaceRaised,
                borderWidth: 1,
                borderColor: colors.border,
                marginBottom: spacing.lg,
              }}
            >
              {RANGE_OPTIONS.map(({ days, label }) => {
                const active = range === days;
                return (
                  <Pressable
                    key={days}
                    onPress={() => setRange(days)}
                    style={{
                      flex: 1,
                      paddingVertical: spacing.sm,
                      borderRadius: radius.md,
                      alignItems: "center",
                      backgroundColor: active ? colors.surface : colors.transparent,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: fontSize.xs,
                        fontWeight: "600",
                        color: active ? colors.text : colors.textMuted,
                      }}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {loading && <ProfileStatsContentSkeleton colors={colors} />}

            {error && !loading ? (
              <View
                style={{
                  minHeight: 520,
                  justifyContent: "center",
                  alignItems: "center",
                  backgroundColor: colors.surfaceRaised,
                  borderRadius: radius.lg,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ fontSize: fontSize.sm, color: colors.danger }}>{error}</Text>
              </View>
            ) : null}

            {stats && !loading && (
              <View style={{ minHeight: 520, gap: spacing.lg }}>
                {/* Breakdown grid - tap to filter chart */}
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: spacing.sm,
                    marginBottom: spacing.lg,
                  }}
                >
                  {BREAKDOWN_ITEMS.map((item) => {
                    const active = metric === item.key;
                    const value = getBreakdownValue(stats, item);
                    return (
                      <Pressable
                        key={item.key}
                        onPress={() => setMetric(item.key)}
                        style={{
                          width: "47%",
                          backgroundColor: active ? colors.accent + "18" : colors.surfaceRaised,
                          borderWidth: 1,
                          borderColor: active ? colors.accent : colors.border,
                          borderRadius: radius.lg,
                          padding: spacing.md,
                        }}
                      >
                        <Text style={{ fontSize: fontSize.xs, color: colors.textMuted, marginBottom: 4 }}>
                          {item.label}
                        </Text>
                        <Text
                          style={{
                            fontSize: fontSize.xl,
                            fontWeight: "800",
                            color: active ? colors.accent : colors.text,
                          }}
                        >
                          {value.toLocaleString()}
                        </Text>
                      </Pressable>
                    );
                  })}
                  <Pressable
                    onPress={() => setMetric("all")}
                    style={{
                      width: "100%",
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      backgroundColor: metric === "all" ? colors.accent + "18" : colors.surfaceRaised,
                      borderWidth: 1,
                      borderColor: metric === "all" ? colors.accent : colors.border,
                      borderRadius: radius.lg,
                      padding: spacing.md,
                    }}
                  >
                    <Text style={{ fontSize: fontSize.xs, color: colors.textMuted }}>All interactions</Text>
                    <Text
                      style={{
                        fontSize: fontSize.xl,
                        fontWeight: "800",
                        color: metric === "all" ? colors.accent : colors.text,
                      }}
                    >
                      {(
                        stats.totals.profileViews +
                        stats.totals.qrScans +
                        stats.totals.socialClicks +
                        stats.totals.secretsReceived +
                        stats.totals.secretsSent
                      ).toLocaleString()}
                    </Text>
                  </Pressable>
                </View>

                {/* Hero + chart */}
                <View style={{ alignItems: "center", marginBottom: spacing.md }}>
                  <Text style={{ fontSize: fontSize["3xl"], fontWeight: "800", color: colors.accent }}>
                    {periodTotal.toLocaleString()}
                  </Text>
                  <Text style={{ fontSize: fontSize.sm, color: colors.textMuted, marginTop: 4 }}>
                    {METRIC_LABELS[metric]} · {rangeLabel.toLowerCase()}
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
                  }}
                >
                  <StatsBarChart
                    values={chartData.values}
                    labels={chartData.labels}
                    color={colors.accent}
                    height={120}
                  />
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      marginTop: spacing.sm,
                      paddingTop: spacing.sm,
                      borderTopWidth: 1,
                      borderTopColor: colors.border,
                    }}
                  >
                    <Text style={{ fontSize: fontSize.xs, color: colors.textMuted }}>
                      {stats.series[0]?.day ? formatShortDate(stats.series[0].day) : ""}
                    </Text>
                    <Text style={{ fontSize: fontSize.xs, color: colors.textMuted }}>
                      {stats.series[stats.series.length - 1]?.day
                        ? formatShortDate(stats.series[stats.series.length - 1]!.day)
                        : ""}
                    </Text>
                  </View>
                </View>

                <Text
                  style={{
                    fontSize: fontSize.xs,
                    color: colors.textMuted,
                    textAlign: "center",
                    lineHeight: 16,
                    opacity: 0.7,
                  }}
                >
                  Aggregate counts only - no visitor identities stored.
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
