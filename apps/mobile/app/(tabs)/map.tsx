import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Modal,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView, { Marker, type Region } from "react-native-maps";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";
import { groupStoriesByPlace, mapTimeRemaining, type PlaceGroup } from "@secretlink/core";
import { useTheme, spacing, radius, fontSize } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { secretsApi, type MapSecret } from "@/lib/api";
import { decryptMapReveal } from "@/lib/secret-crypto";
import { StoryComposerModal } from "@/components/StoryComposerModal";

function toListItem(s: MapSecret) {
  return {
    id: s.id,
    lat: s.lat,
    lng: s.lng,
    emoji: s.emoji,
    handle: s.handle ?? null,
    locationName: s.locationName ?? null,
    cityName: s.cityName ?? null,
    countryName: s.countryName ?? null,
    revealMode: s.revealMode,
    revealTimerSeconds: s.revealTimerSeconds,
    maxClicks: s.maxClicks,
    clickCount: s.clickCount,
    createdAt: s.createdAt,
    expiresAt: s.expiresAt,
  };
}

export default function MapTab() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const mapRef = useRef<MapView>(null);

  const [secrets, setSecrets] = useState<MapSecret[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  const [selected, setSelected] = useState<MapSecret | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [revealCountdown, setRevealCountdown] = useState<number | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [selectedPlaceKey, setSelectedPlaceKey] = useState<string | null>(null);
  const [groupSheet, setGroupSheet] = useState<PlaceGroup | null>(null);

  const [pendingPin, setPendingPin] = useState<{ lat: number; lng: number } | null>(null);
  const [showComposer, setShowComposer] = useState(false);
  const [composerCoords, setComposerCoords] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setUserLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
    })();
  }, []);

  const loadSecrets = useCallback(async () => {
    setError(null);
    try {
      setSecrets(await secretsApi.getMapSecrets());
    } catch {
      setError("Could not load stories.");
    }
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { loadSecrets(); }, [loadSecrets]));

  useEffect(() => () => { if (countdownRef.current) clearInterval(countdownRef.current); }, []);

  const secretsById = useMemo(() => new Map(secrets.map((s) => [s.id, s])), [secrets]);
  const { groupedPlaces, ungroupedSecrets } = useMemo(
    () => groupStoriesByPlace(secrets.map(toListItem)),
    [secrets],
  );

  const initialRegion: Region = userLocation
    ? { latitude: userLocation.lat, longitude: userLocation.lng, latitudeDelta: 0.05, longitudeDelta: 0.05 }
    : { latitude: 51.505, longitude: -0.09, latitudeDelta: 50, longitudeDelta: 50 };

  function openGroup(group: PlaceGroup) {
    setSelectedPlaceKey(group.key);
    setGroupSheet(group);
    mapRef.current?.animateToRegion({
      latitude: group.centroid.lat,
      longitude: group.centroid.lng,
      latitudeDelta: 0.1,
      longitudeDelta: 0.1,
    });
  }

  async function handleReveal() {
    if (!selected) return;
    try {
      const data = await secretsApi.revealMapSecret(selected.id);
      const plaintext = decryptMapReveal(data);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setSelected({ ...selected, ...data, message: plaintext });
      setRevealed(true);
      if (data.revealMode === "timer") {
        const secs = data.revealTimerSeconds ?? 30;
        setRevealCountdown(secs);
        if (countdownRef.current) clearInterval(countdownRef.current);
        countdownRef.current = setInterval(() => {
          setRevealCountdown((prev) => {
            if (prev === null || prev <= 1) {
              if (countdownRef.current) clearInterval(countdownRef.current);
              setSelected(null);
              setRevealed(false);
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

  function handleMapPress(e: any) {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setPendingPin({ lat: latitude, lng: longitude });
    setSelected(null);
    setRevealed(false);
    setGroupSheet(null);
  }

  function openComposer(coords?: { lat: number; lng: number }) {
    setComposerCoords(coords ?? pendingPin);
    setShowComposer(true);
    setPendingPin(null);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
        <Text style={{ color: colors.text, fontSize: fontSize["2xl"], fontWeight: "700" }}>Map</Text>
        <Text style={{ color: colors.textMuted, fontSize: fontSize.sm, marginTop: spacing.xs }}>Stories dropped near you</Text>
      </View>

      {error && (
        <View style={{ marginHorizontal: spacing.lg, marginBottom: spacing.sm, padding: spacing.sm, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.danger + "44" }}>
          <Text style={{ color: colors.danger, fontSize: fontSize.xs }}>{error}</Text>
        </View>
      )}

      {groupedPlaces.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, gap: spacing.sm }}>
          <Pressable onPress={() => { setSelectedPlaceKey(null); setGroupSheet(null); }} style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full, borderWidth: 1, borderColor: selectedPlaceKey === null ? colors.accent : colors.border }}>
            <Text style={{ color: selectedPlaceKey === null ? colors.accent : colors.textMuted, fontSize: fontSize.xs }}>All</Text>
          </Pressable>
          {groupedPlaces.map((g) => (
            <Pressable key={g.key} onPress={() => openGroup(g)} style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full, borderWidth: 1, borderColor: selectedPlaceKey === g.key ? colors.accent : colors.border }}>
              <Text style={{ color: colors.text, fontSize: fontSize.xs }}>{g.label} · {g.count}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      <View style={{ flex: 1, borderRadius: radius.lg, overflow: "hidden", marginHorizontal: spacing.lg, marginBottom: spacing.sm }}>
        {loading ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : (
          <MapView ref={mapRef} style={{ flex: 1 }} initialRegion={initialRegion} showsUserLocation onPress={handleMapPress} customMapStyle={darkMapStyle}>
            {ungroupedSecrets.map((item) => {
              const s = secretsById.get(item.id);
              if (!s) return null;
              return (
                <Marker key={s.id} coordinate={{ latitude: s.lat, longitude: s.lng }} onPress={() => { setSelected(s); setRevealed(false); setGroupSheet(null); }}>
                  <Text style={{ fontSize: 28 }}>{s.emoji}</Text>
                </Marker>
              );
            })}
            {groupedPlaces.map((g) => (
              <Marker key={g.key} coordinate={{ latitude: g.centroid.lat, longitude: g.centroid.lng }} onPress={() => openGroup(g)}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accent, justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: "#fff" }}>
                  <Text style={{ fontWeight: "700", color: "#000", fontSize: fontSize.sm }}>{g.count}</Text>
                </View>
              </Marker>
            ))}
            {pendingPin && (
              <Marker coordinate={{ latitude: pendingPin.lat, longitude: pendingPin.lng }}>
                <Text style={{ fontSize: 28 }}>📍</Text>
              </Marker>
            )}
          </MapView>
        )}
      </View>

      {pendingPin && (
        <Pressable onPress={() => openComposer(pendingPin)} style={{ marginHorizontal: spacing.lg, marginBottom: spacing.sm, backgroundColor: colors.accent, paddingVertical: spacing.md, borderRadius: radius.full, alignItems: "center" }}>
          <Text style={{ color: "#000", fontWeight: "700" }}>Add story here</Text>
        </Pressable>
      )}

      <Pressable onPress={() => openComposer()} style={{ position: "absolute", right: spacing.lg, bottom: spacing.xl, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.accent, justifyContent: "center", alignItems: "center" }}>
        <Text style={{ fontSize: 28, color: "#000", lineHeight: 32 }}>+</Text>
      </Pressable>

      {selected && (
        <View style={{ marginHorizontal: spacing.lg, marginBottom: spacing.sm, padding: spacing.lg, backgroundColor: colors.surfaceRaised, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border }}>
          {!revealed ? (
            <View style={{ alignItems: "center" }}>
              <Text style={{ fontSize: 40, marginBottom: spacing.md }}>{selected.emoji}</Text>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.sm, marginBottom: spacing.lg }}>
                {selected.handle ? `@${selected.handle} shared a story` : "Someone shared a story"}
              </Text>
              <Pressable onPress={handleReveal} style={{ backgroundColor: colors.accent, paddingVertical: spacing.md, paddingHorizontal: spacing.xl, borderRadius: radius.full }}>
                <Text style={{ color: "#000", fontWeight: "700" }}>Tap to reveal</Text>
              </Pressable>
            </View>
          ) : (
            <View>
              <Text style={{ color: colors.text, fontSize: fontSize.base }}>{selected.message}</Text>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginTop: spacing.sm }}>{mapTimeRemaining(selected.expiresAt)}</Text>
            </View>
          )}
        </View>
      )}

      <Modal visible={!!groupSheet} animationType="slide" transparent>
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)" }} onPress={() => { setGroupSheet(null); setSelectedPlaceKey(null); }} />
        {groupSheet && (
          <View style={{ backgroundColor: colors.surfaceRaised, borderTopLeftRadius: radius["2xl"], borderTopRightRadius: radius["2xl"], padding: spacing.lg, maxHeight: "60%" }}>
            <Text style={{ color: colors.text, fontWeight: "700", marginBottom: spacing.sm }}>{groupSheet.label} · {groupSheet.count} stories</Text>
            <ScrollView>
              {groupSheet.stories.map((meta) => {
                const s = secretsById.get(meta.id);
                if (!s) return null;
                return (
                  <Pressable key={s.id} onPress={() => { setSelected(s); setRevealed(false); setGroupSheet(null); }} style={{ paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                    <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>{s.emoji} Tap to reveal · {mapTimeRemaining(s.expiresAt)}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}
      </Modal>

      <StoryComposerModal
        visible={showComposer}
        handle={user?.handle}
        initialCoords={composerCoords}
        onClose={() => { setShowComposer(false); setComposerCoords(null); }}
        onPosted={loadSecrets}
      />
    </SafeAreaView>
  );
}

const darkMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#212121" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#000000" }] },
];
