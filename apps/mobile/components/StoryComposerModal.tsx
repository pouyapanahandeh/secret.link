import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useTheme, spacing, radius, fontSize } from "@/lib/theme";
import { secretsApi } from "@/lib/api";
import { encryptMapMessage } from "@/lib/secret-crypto";
import { reverseGeocode } from "@/lib/geocode";

const EMOJIS = ["💬", "❤️", "🔥", "👀", "🤫", "💀", "🎉", "😂"];
const TTL_OPTIONS = [
  { value: 60, label: "1 hour" },
  { value: 360, label: "6 hours" },
  { value: 1440, label: "24 hours" },
];

interface StoryComposerModalProps {
  visible: boolean;
  handle?: string;
  initialCoords?: { lat: number; lng: number } | null;
  onClose: () => void;
  onPosted?: () => void;
}

export function StoryComposerModal({ visible, handle, initialCoords, onClose, onPosted }: StoryComposerModalProps) {
  const { colors } = useTheme();
  const [message, setMessage] = useState("");
  const [emoji, setEmoji] = useState("💬");
  const [ttl, setTtl] = useState(60);
  const [anonymous, setAnonymous] = useState(false);
  const [posting, setPosting] = useState(false);
  const [coords, setCoords] = useState(initialCoords ?? null);
  const [locationName, setLocationName] = useState("");
  const [cityName, setCityName] = useState("");
  const [countryName, setCountryName] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setCoords(initialCoords ?? null);
    if (initialCoords) {
      reverseGeocode(initialCoords.lat, initialCoords.lng).then((g) => {
        if (!g) return;
        setLocationName(g.locationName);
        setCityName(g.cityName ?? "");
        setCountryName(g.countryName ?? "");
      });
    }
  }, [visible, initialCoords]);

  async function handlePost() {
    if (!coords || !message.trim()) return;
    setPosting(true);
    setError(null);
    try {
      const encrypted = encryptMapMessage(message.trim());
      await secretsApi.createMapSecret({
        ...encrypted,
        lat: coords.lat,
        lng: coords.lng,
        emoji,
        ttlMinutes: ttl,
        handle: anonymous ? undefined : handle,
        locationName: locationName || undefined,
        cityName: cityName || undefined,
        countryName: countryName || undefined,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setMessage("");
      onPosted?.();
      onClose();
    } catch {
      setError("Couldn't post your story. Try again.");
    } finally {
      setPosting(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={{
          backgroundColor: colors.surfaceRaised,
          borderTopLeftRadius: radius["2xl"],
          borderTopRightRadius: radius["2xl"],
          padding: spacing.xl,
          borderWidth: 1,
          borderColor: colors.border,
        }}>
          <Text style={{ color: colors.text, fontSize: fontSize.lg, fontWeight: "700", marginBottom: spacing.md }}>Add story</Text>
          {coords && (
            <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginBottom: spacing.sm }} numberOfLines={1}>
              {locationName || `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`}
            </Text>
          )}
          <TextInput
            value={message}
            onChangeText={setMessage}
            maxLength={500}
            multiline
            placeholder="What's your story?"
            placeholderTextColor={colors.textMuted + "66"}
            style={{
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.lg,
              padding: spacing.md,
              color: colors.text,
              minHeight: 80,
              textAlignVertical: "top",
            }}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: spacing.md }}>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              {EMOJIS.map((e) => (
                <Pressable key={e} onPress={() => setEmoji(e)} style={{ padding: spacing.sm, borderRadius: radius.sm, backgroundColor: emoji === e ? colors.accent + "33" : "transparent" }}>
                  <Text style={{ fontSize: 20 }}>{e}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: spacing.md }}>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              {TTL_OPTIONS.map((opt) => (
                <Pressable key={opt.value} onPress={() => setTtl(opt.value)} style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full, borderWidth: 1, borderColor: ttl === opt.value ? colors.accent : colors.border }}>
                  <Text style={{ color: ttl === opt.value ? colors.accent : colors.textMuted, fontSize: fontSize.xs }}>{opt.label}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
          <Pressable onPress={() => setAnonymous((a) => !a)} style={{ marginTop: spacing.md, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ color: colors.text, fontSize: fontSize.xs }}>{anonymous ? "Posting anonymously" : `Posting as @${handle ?? "you"}`}</Text>
          </Pressable>
          {error && <Text style={{ color: colors.danger, fontSize: fontSize.xs, marginTop: spacing.sm }}>{error}</Text>}
          <Pressable onPress={handlePost} disabled={posting || !message.trim() || !coords} style={{ marginTop: spacing.lg, backgroundColor: colors.accent, paddingVertical: spacing.md, borderRadius: radius.full, alignItems: "center", opacity: posting ? 0.6 : 1 }}>
            {posting ? <ActivityIndicator color="#000" /> : <Text style={{ color: "#000", fontWeight: "700" }}>Share story</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
