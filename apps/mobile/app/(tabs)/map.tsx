import { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Modal,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView, { Marker, type Region } from "react-native-maps";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";
import { useTheme, spacing, radius, fontSize } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { secretsApi, type MapSecret } from "@/lib/api";

// ─── Constants ──────────────────────────────────────────────────────────────

const EMOJIS = ["💬", "❤️", "🔥", "👀", "🤫", "💀", "🎉", "😂"];
const REPORT_REASONS = [
  { value: "spam", label: "Spam / scam" },
  { value: "harassment", label: "Harassment" },
  { value: "hate", label: "Hate speech" },
  { value: "sexual", label: "Sexual content" },
  { value: "violence", label: "Violence" },
  { value: "illegal", label: "Illegal content" },
  { value: "other", label: "Other" },
];

const TTL_OPTIONS = [
  { value: 5, label: "5 min" },
  { value: 30, label: "30 min" },
  { value: 60, label: "1 hour" },
  { value: 360, label: "6 hours" },
  { value: 1440, label: "24 hours" },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function cityFromSecret(s: MapSecret): string {
  if (s.cityName) return s.cityName;
  if (s.locationName) return s.locationName.split(",")[0]?.trim() ?? "";
  return "";
}

function timeRemaining(expiresAt: string): string {
  const normalized = expiresAt.includes("T") ? expiresAt : expiresAt.replace(" ", "T") + "Z";
  const ms = new Date(normalized).getTime() - Date.now();
  if (isNaN(ms) || ms <= 0) return "Expired";
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m left`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m left`;
}

// ─── Map Tab ────────────────────────────────────────────────────────────────

export default function MapTab() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const mapRef = useRef<MapView>(null);

  // Data
  const [secrets, setSecrets] = useState<MapSecret[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Selected secret
  const [selected, setSelected] = useState<MapSecret | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [revealCountdown, setRevealCountdown] = useState<number | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // City filter
  const [cityFilter, setCityFilter] = useState<string | null>(null);

  // Post form
  const [showPost, setShowPost] = useState(false);
  const [postCoords, setPostCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [postMessage, setPostMessage] = useState("");
  const [postEmoji, setPostEmoji] = useState("💬");
  const [postTtl, setPostTtl] = useState(60);
  const [postAnonymous, setPostAnonymous] = useState(false);
  const [posting, setPosting] = useState(false);

  // Report
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState("spam");
  const [reportDetails, setReportDetails] = useState("");
  const [reporting, setReporting] = useState(false);

  // ─── Location ───────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { status: existingStatus } = await Location.getForegroundPermissionsAsync();
      let granted = existingStatus === "granted";
      if (!granted) {
        const { status } = await Location.requestForegroundPermissionsAsync();
        granted = status === "granted";
      }
      if (!granted) return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setUserLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
    })();
  }, []);

  // ─── Load secrets ─────────────────────────────────────────────────────
  const loadSecrets = useCallback(async () => {
    try {
      const data = await secretsApi.getMapSecrets();
      setSecrets(data);
    } catch {}
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSecrets();
    }, [loadSecrets]),
  );

  // ─── Cleanup countdown on unmount ─────────────────────────────────────
  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  // ─── Derived ──────────────────────────────────────────────────────────
  const cityGroups = Object.values(
    secrets.reduce(
      (acc: Record<string, { city: string; count: number }>, s) => {
        const city = cityFromSecret(s);
        if (!city) return acc;
        if (!acc[city]) acc[city] = { city, count: 0 };
        acc[city]!.count += 1;
        return acc;
      },
      {} as Record<string, { city: string; count: number }>,
    ),
  ).sort((a, b) => b.count - a.count);

  const visibleSecrets = cityFilter
    ? secrets.filter((s) => cityFromSecret(s).toLowerCase() === cityFilter.toLowerCase())
    : secrets;

  const initialRegion: Region = userLocation
    ? { latitude: userLocation.lat, longitude: userLocation.lng, latitudeDelta: 0.05, longitudeDelta: 0.05 }
    : { latitude: 51.505, longitude: -0.09, latitudeDelta: 50, longitudeDelta: 50 };

  // ─── Actions ──────────────────────────────────────────────────────────
  async function handleReveal() {
    if (!selected) return;
    try {
      const data = await secretsApi.revealMapSecret(selected.id);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setSelected({ ...selected, ...data });
      setRevealed(true);
      if (data.revealMode === "timer") {
        const secs = data.revealTimerSeconds ?? 30;
        setRevealCountdown(secs);
        if (countdownRef.current) clearInterval(countdownRef.current);
        countdownRef.current = setInterval(() => {
          setRevealCountdown((prev) => {
            if (prev === null || prev <= 1) {
              if (countdownRef.current) clearInterval(countdownRef.current);
              setRevealed(false);
              setSelected(null);
              return null;
            }
            return prev - 1;
          });
        }, 1000);
      }
    } catch (err: any) {
      if (err?.data?.error === "limit_reached") {
        Alert.alert("Limit reached", err.data.message ?? "No more reveals available.");
      }
    }
  }

  async function handlePost() {
    if (!postCoords || !postMessage.trim()) return;
    setPosting(true);
    try {
      await secretsApi.createMapSecret({
        message: postMessage.trim(),
        lat: postCoords.lat,
        lng: postCoords.lng,
        emoji: postEmoji,
        ttlMinutes: postTtl,
        handle: postAnonymous ? undefined : user?.handle,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowPost(false);
      setPostMessage("");
      setPostCoords(null);
      loadSecrets();
    } catch {
      Alert.alert("Error", "Couldn't drop your secret. Try again.");
    } finally {
      setPosting(false);
    }
  }

  async function handleReport() {
    if (!selected) return;
    setReporting(true);
    try {
      await secretsApi.reportMapSecret(selected.id, reportReason, reportDetails.trim());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Thanks", "Your report was submitted.");
      setShowReport(false);
      setReportDetails("");
    } catch {
      Alert.alert("Error", "Could not send report. Try again.");
    } finally {
      setReporting(false);
    }
  }

  function handleMapPress(e: any) {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setPostCoords({ lat: latitude, lng: longitude });
    setSelected(null);
    setRevealed(false);
    setShowPost(true);
  }

  function handleMarkerPress(secret: MapSecret) {
    setSelected(secret);
    setRevealed(false);
    setShowPost(false);
    setShowReport(false);
    if (countdownRef.current) clearInterval(countdownRef.current);
    setRevealCountdown(null);
  }

  function closeSelected() {
    setSelected(null);
    setRevealed(false);
    if (countdownRef.current) clearInterval(countdownRef.current);
    setRevealCountdown(null);
  }

  function goToCity(city: string) {
    setCityFilter(city);
    const first = secrets.find((s) => cityFromSecret(s).toLowerCase() === city.toLowerCase());
    if (first && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: first.lat,
        longitude: first.lng,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      });
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      {/* Header */}
      <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
        <Text style={{ color: colors.text, fontSize: fontSize["2xl"], fontWeight: "700" }}>
          🗺️ Secret Map
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: fontSize.sm, marginTop: spacing.xs }}>
          Tap the map to drop a secret
        </Text>
      </View>

      {/* City filter chips */}
      {cityGroups.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, gap: spacing.sm }}
        >
          <Pressable
            onPress={() => setCityFilter(null)}
            style={{
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              borderRadius: radius.full,
              borderWidth: 1,
              borderColor: cityFilter === null ? colors.accent : colors.border,
              backgroundColor: cityFilter === null ? colors.accent + "33" : colors.surfaceRaised,
            }}
          >
            <Text style={{ color: cityFilter === null ? colors.accent : colors.textMuted, fontSize: fontSize.xs }}>
              All cities
            </Text>
          </Pressable>
          {cityGroups.map((g) => (
            <Pressable
              key={g.city}
              onPress={() => goToCity(g.city)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.xs,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                borderRadius: radius.full,
                borderWidth: 1,
                borderColor: cityFilter === g.city ? colors.accent : colors.border,
                backgroundColor: cityFilter === g.city ? colors.accent + "33" : colors.surfaceRaised,
              }}
            >
              <Text style={{ color: colors.text, fontSize: fontSize.xs }}>{g.city}</Text>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>{g.count}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {/* Map */}
      <View style={{ flex: 1, borderRadius: radius.lg, overflow: "hidden", marginHorizontal: spacing.lg, marginBottom: spacing.sm }}>
        {loading ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.surfaceRaised }}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : (
          <MapView
            ref={mapRef}
            style={{ flex: 1 }}
            initialRegion={initialRegion}
            showsUserLocation
            showsMyLocationButton
            onPress={handleMapPress}
            customMapStyle={darkMapStyle}
          >
            {visibleSecrets.map((s) => (
              <Marker
                key={s.id}
                coordinate={{ latitude: s.lat, longitude: s.lng }}
                onPress={() => handleMarkerPress(s)}
              >
                <View style={{ alignItems: "center" }}>
                  <Text style={{ fontSize: 28 }}>{s.emoji}</Text>
                </View>
              </Marker>
            ))}
            {postCoords && (
              <Marker coordinate={{ latitude: postCoords.lat, longitude: postCoords.lng }}>
                <Text style={{ fontSize: 28 }}>📍</Text>
              </Marker>
            )}
          </MapView>
        )}
      </View>

      {/* Selected secret card */}
      {selected && (
        <View style={{
          marginHorizontal: spacing.lg,
          marginBottom: spacing.sm,
          padding: spacing.lg,
          backgroundColor: colors.surfaceRaised,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
        }}>
          {!revealed ? (
            /* Pre-reveal */
            <View style={{ alignItems: "center" }}>
              <Text style={{ fontSize: 40, marginBottom: spacing.md }}>{selected.emoji}</Text>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.sm, marginBottom: spacing.xs }}>
                {selected.handle ? `@${selected.handle} dropped a secret` : "Someone dropped a secret"}
              </Text>
              {(selected.locationName || selected.cityName) && (
                <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginBottom: spacing.xs }}>
                  📍 {selected.locationName || selected.cityName}
                </Text>
              )}
              <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginBottom: spacing.xs }}>
                ⏳ {timeRemaining(selected.expiresAt)}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginBottom: spacing.lg }}>
                {selected.revealMode === "clicks"
                  ? `👆 ${selected.clickCount}/${selected.maxClicks} reveals used`
                  : `⏱️ Disappears ${selected.revealTimerSeconds}s after reveal`}
              </Text>
              <View style={{ flexDirection: "row", gap: spacing.md }}>
                <Pressable
                  onPress={handleReveal}
                  style={{
                    flex: 1,
                    backgroundColor: colors.accent,
                    paddingVertical: spacing.md,
                    borderRadius: radius.full,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ color: "#000", fontWeight: "700", fontSize: fontSize.sm }}>
                    Tap to reveal 👁️
                  </Text>
                </Pressable>
                <Pressable
                  onPress={closeSelected}
                  style={{
                    paddingVertical: spacing.md,
                    paddingHorizontal: spacing.lg,
                    borderRadius: radius.full,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>✕</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            /* Revealed */
            <View>
              {revealCountdown !== null && (
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: spacing.md }}>
                  <View style={{ flex: 1, height: 4, backgroundColor: colors.border, borderRadius: 2, overflow: "hidden" }}>
                    <View style={{
                      height: 4,
                      backgroundColor: colors.accent,
                      borderRadius: 2,
                      width: `${(revealCountdown / (selected.revealTimerSeconds ?? 30)) * 100}%`,
                    }} />
                  </View>
                  <Text style={{ color: colors.accent, fontSize: fontSize.xs, fontVariant: ["tabular-nums"], marginLeft: spacing.sm }}>
                    {revealCountdown}s
                  </Text>
                </View>
              )}
              <View style={{ flexDirection: "row", gap: spacing.md }}>
                <Text style={{ fontSize: 28 }}>{selected.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontSize: fontSize.base, lineHeight: 22 }}>
                    {selected.message}
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.sm, flexWrap: "wrap" }}>
                    {selected.handle && (
                      <Text style={{ color: colors.accent, fontSize: fontSize.xs }}>@{selected.handle}</Text>
                    )}
                    {(selected.locationName || selected.cityName) && (
                      <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>
                        📍 {selected.locationName || selected.cityName}
                      </Text>
                    )}
                    <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>
                      ⏳ {timeRemaining(selected.expiresAt)}
                    </Text>
                  </View>
                </View>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: spacing.lg }}>
                <Pressable onPress={() => setShowReport(true)}>
                  <Text style={{ color: colors.danger, fontSize: fontSize.xs }}>🚩 Report</Text>
                </Pressable>
                <Pressable onPress={closeSelected}>
                  <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>Close</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      )}

      {/* Recent drops list */}
      {visibleSecrets.length > 0 && !selected && !showPost && (
        <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, maxHeight: 160 }}>
          <Text style={{ color: colors.text, fontSize: fontSize.sm, fontWeight: "600", marginBottom: spacing.sm }}>
            Recent drops{cityFilter ? ` in ${cityFilter}` : ""}
          </Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {visibleSecrets.slice(0, 5).map((s) => (
              <Pressable
                key={s.id}
                onPress={() => handleMarkerPress(s)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.md,
                  paddingVertical: spacing.sm,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                }}
              >
                <Text style={{ fontSize: 20 }}>{s.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ color: colors.text, fontSize: fontSize.sm }}>{s.message}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>
                    {s.handle ? `@${s.handle} · ` : ""}
                    {(s.cityName || s.locationName) ? `${s.cityName || s.locationName} · ` : ""}
                    ⏳ {timeRemaining(s.expiresAt)}
                  </Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {/* ─── Post Modal ─── */}
      <Modal visible={showPost} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1, justifyContent: "flex-end" }}
        >
          <Pressable style={{ flex: 1 }} onPress={() => setShowPost(false)} />
          <View style={{
            backgroundColor: colors.surfaceRaised,
            borderTopLeftRadius: radius["2xl"],
            borderTopRightRadius: radius["2xl"],
            padding: spacing.xl,
            borderWidth: 1,
            borderColor: colors.border,
            borderBottomWidth: 0,
          }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.lg }}>
              <Text style={{ color: colors.text, fontSize: fontSize.lg, fontWeight: "700" }}>Drop a secret</Text>
              <Pressable onPress={() => setShowPost(false)}>
                <Text style={{ color: colors.textMuted, fontSize: fontSize.xl }}>✕</Text>
              </Pressable>
            </View>

            <TextInput
              value={postMessage}
              onChangeText={setPostMessage}
              maxLength={500}
              multiline
              numberOfLines={3}
              placeholder="Write your secret..."
              placeholderTextColor={colors.textMuted + "66"}
              style={{
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius.lg,
                padding: spacing.md,
                color: colors.text,
                fontSize: fontSize.sm,
                minHeight: 80,
                textAlignVertical: "top",
              }}
            />

            {/* Emoji row */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: spacing.md }}>
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                {EMOJIS.map((e) => (
                  <Pressable
                    key={e}
                    onPress={() => setPostEmoji(e)}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: radius.sm,
                      justifyContent: "center",
                      alignItems: "center",
                      backgroundColor: postEmoji === e ? colors.accent + "33" : "transparent",
                      borderWidth: postEmoji === e ? 1 : 0,
                      borderColor: colors.accent,
                    }}
                  >
                    <Text style={{ fontSize: 20 }}>{e}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            {/* TTL selector */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: spacing.md }}>
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                {TTL_OPTIONS.map((opt) => (
                  <Pressable
                    key={opt.value}
                    onPress={() => setPostTtl(opt.value)}
                    style={{
                      paddingHorizontal: spacing.md,
                      paddingVertical: spacing.sm,
                      borderRadius: radius.full,
                      borderWidth: 1,
                      borderColor: postTtl === opt.value ? colors.accent : colors.border,
                      backgroundColor: postTtl === opt.value ? colors.accent + "33" : "transparent",
                    }}
                  >
                    <Text style={{ color: postTtl === opt.value ? colors.accent : colors.textMuted, fontSize: fontSize.xs }}>
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            {/* Anonymity toggle */}
            <Pressable
              onPress={() => setPostAnonymous((a) => !a)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: spacing.lg,
                padding: spacing.md,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, flex: 1 }}>
                <Text style={{ fontSize: 18 }}>{postAnonymous ? "🥷" : "👤"}</Text>
                <View>
                  <Text style={{ color: colors.text, fontSize: fontSize.xs, fontWeight: "600" }}>
                    {postAnonymous ? "Posting anonymously" : `Posting as @${user?.handle ?? "you"}`}
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>
                    {postAnonymous ? "Handle hidden" : "Handle visible"}
                  </Text>
                </View>
              </View>
              <View style={{
                width: 44,
                height: 26,
                borderRadius: 13,
                backgroundColor: postAnonymous ? colors.accent : colors.border,
                justifyContent: "center",
                paddingHorizontal: 2,
              }}>
                <View style={{
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  backgroundColor: "#fff",
                  alignSelf: postAnonymous ? "flex-end" : "flex-start",
                }} />
              </View>
            </Pressable>

            {/* Post button */}
            <Pressable
              onPress={handlePost}
              disabled={posting || !postMessage.trim()}
              style={{
                marginTop: spacing.lg,
                backgroundColor: postMessage.trim() ? colors.accent : colors.border,
                paddingVertical: spacing.md,
                borderRadius: radius.full,
                alignItems: "center",
                opacity: posting ? 0.6 : 1,
              }}
            >
              <Text style={{ color: "#000", fontWeight: "700", fontSize: fontSize.base }}>
                {posting ? "Dropping..." : "Drop secret 📍"}
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ─── Report Modal ─── */}
      <Modal visible={showReport} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1, justifyContent: "flex-end" }}
        >
          <Pressable style={{ flex: 1 }} onPress={() => setShowReport(false)} />
          <View style={{
            backgroundColor: colors.surfaceRaised,
            borderTopLeftRadius: radius["2xl"],
            borderTopRightRadius: radius["2xl"],
            padding: spacing.xl,
            borderWidth: 1,
            borderColor: colors.border,
            borderBottomWidth: 0,
          }}>
            <Text style={{ color: colors.text, fontSize: fontSize.lg, fontWeight: "700", marginBottom: spacing.lg }}>
              🚩 Report this secret
            </Text>

            {/* Reason chips */}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.lg }}>
              {REPORT_REASONS.map((r) => (
                <Pressable
                  key={r.value}
                  onPress={() => setReportReason(r.value)}
                  style={{
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.sm,
                    borderRadius: radius.full,
                    borderWidth: 1,
                    borderColor: reportReason === r.value ? colors.danger : colors.border,
                    backgroundColor: reportReason === r.value ? colors.danger + "22" : "transparent",
                  }}
                >
                  <Text style={{ color: reportReason === r.value ? colors.danger : colors.textMuted, fontSize: fontSize.xs }}>
                    {r.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <TextInput
              value={reportDetails}
              onChangeText={setReportDetails}
              maxLength={2000}
              multiline
              numberOfLines={3}
              placeholder="Tell us what's wrong (optional)"
              placeholderTextColor={colors.textMuted + "66"}
              style={{
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius.lg,
                padding: spacing.md,
                color: colors.text,
                fontSize: fontSize.sm,
                minHeight: 80,
                textAlignVertical: "top",
              }}
            />

            <View style={{ flexDirection: "row", gap: spacing.md, marginTop: spacing.lg }}>
              <Pressable
                onPress={() => setShowReport(false)}
                style={{
                  flex: 1,
                  paddingVertical: spacing.md,
                  borderRadius: radius.full,
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: colors.textMuted, fontWeight: "600", fontSize: fontSize.sm }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleReport}
                disabled={reporting}
                style={{
                  flex: 1,
                  paddingVertical: spacing.md,
                  borderRadius: radius.full,
                  backgroundColor: colors.danger,
                  alignItems: "center",
                  opacity: reporting ? 0.6 : 1,
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: fontSize.sm }}>
                  {reporting ? "Sending..." : "Submit report"}
                </Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Dark Map Style (Google Maps) ───────────────────────────────────────────
const darkMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#212121" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#212121" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#757575" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#181818" }] },
  { featureType: "road", elementType: "geometry.fill", stylers: [{ color: "#2c2c2c" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#8a8a8a" }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#373737" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#3c3c3c" }] },
  { featureType: "transit", elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#000000" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#3d3d3d" }] },
];
