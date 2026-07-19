import { useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useTheme, spacing, radius, fontSize } from "@/lib/theme";
import { secretsApi } from "@/lib/api";

const EXPIRY_OPTIONS = [
  { label: "1 hour", value: 3600 },
  { label: "24 hours", value: 86400 },
  { label: "7 days", value: 604800 },
];

const VIEW_DURATION_OPTIONS = [
  { label: "10s", value: 10 },
  { label: "30s", value: 30 },
  { label: "60s", value: 60 },
];

export default function SendSecretScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { handle } = useLocalSearchParams<{ handle?: string }>();

  const [message, setMessage] = useState("");
  const [expiryIdx, setExpiryIdx] = useState(1); // 24h default
  const [durationIdx, setDurationIdx] = useState(1); // 30s default
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [media, setMedia] = useState<{
    uri: string;
    type: "image" | "video";
    base64?: string;
    fileName?: string;
  } | null>(null);

  async function pickFromGallery() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      quality: 0.8,
      base64: true,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setMedia({
        uri: asset.uri,
        type: asset.type === "video" ? "video" : "image",
        base64: asset.base64 ?? undefined,
        fileName: asset.fileName ?? undefined,
      });
    }
  }

  async function pickFromCamera() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      setError("Camera permission required");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images", "videos"],
      quality: 0.8,
      base64: true,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setMedia({
        uri: asset.uri,
        type: asset.type === "video" ? "video" : "image",
        base64: asset.base64 ?? undefined,
        fileName: asset.fileName ?? undefined,
      });
    }
  }

  async function handleSend() {
    const text = message.trim();
    if (!text && !media) {
      setError("Write a message or attach a photo/video");
      return;
    }
    if (text.length > 10000) {
      setError("Message too long (max 10,000 characters)");
      return;
    }

    setSending(true);
    setError("");
    try {
      const contentType = media ? media.type : "text";
      const mimeType = media
        ? media.type === "video"
          ? "video/mp4"
          : "image/jpeg"
        : "text/plain";

      // If media, send base64 as the ciphertext payload
      const payload = media?.base64
        ? `${text ? text + "\n---\n" : ""}[media:${media.type}]${media.base64}`
        : text;

      await secretsApi.create({
        ciphertext: payload,
        contentType,
        ttlSeconds: EXPIRY_OPTIONS[expiryIdx]!.value,
        maxViews: 1,
        mimeType,
        viewDurationSeconds: VIEW_DURATION_OPTIONS[durationIdx]!.value,
        recipientHandle: handle,
      }, { auth: true });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSent(true);
    } catch (e: any) {
      setError(e?.message ?? "Failed to send");
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            paddingHorizontal: spacing["3xl"],
          }}
        >
          <Text style={{ fontSize: 48, marginBottom: spacing.lg }}>✨</Text>
          <Text
            style={{
              fontSize: fontSize.xl,
              fontWeight: "700",
              color: colors.text,
              textAlign: "center",
              marginBottom: spacing.sm,
            }}
          >
            Secret sent!
          </Text>
          <Text
            style={{
              fontSize: fontSize.base,
              color: colors.textMuted,
              textAlign: "center",
              marginBottom: spacing["3xl"],
            }}
          >
            {handle ? `@${handle} will see it in their inbox.` : "Your secret is ready."}
          </Text>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => ({
              backgroundColor: colors.accent,
              paddingVertical: spacing.lg,
              paddingHorizontal: spacing["3xl"],
              borderRadius: radius.full,
              opacity: pressed ? 0.9 : 1,
            })}
          >
            <Text style={{ fontSize: fontSize.base, fontWeight: "700", color: "#000" }}>
              Done
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
          }}
        >
          <Pressable onPress={() => router.back()}>
            <Text style={{ fontSize: fontSize.lg, color: colors.textMuted }}>← Back</Text>
          </Pressable>
          <Text style={{ fontSize: fontSize.lg, fontWeight: "700", color: colors.text }}>
            Send Secret
          </Text>
          <View style={{ width: 50 }} />
        </View>

        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing["4xl"] }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Recipient */}
          {handle && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: colors.surfaceRaised,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: colors.border,
                padding: spacing.md,
                marginBottom: spacing.lg,
                gap: spacing.sm,
              }}
            >
              <Text style={{ fontSize: fontSize.sm, color: colors.textMuted }}>To:</Text>
              <View
                style={{
                  backgroundColor: colors.accent + "22",
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.xs,
                  borderRadius: radius.full,
                }}
              >
                <Text style={{ fontSize: fontSize.sm, fontWeight: "600", color: colors.accent }}>
                  @{handle}
                </Text>
              </View>
            </View>
          )}

          {/* Message input */}
          <Text
            style={{
              fontSize: fontSize.sm,
              fontWeight: "600",
              color: colors.textMuted,
              marginBottom: spacing.sm,
            }}
          >
            Your secret message
          </Text>
          <TextInput
            value={message}
            onChangeText={(t) => setMessage(t.slice(0, 10000))}
            placeholder="Type something only they can see..."
            placeholderTextColor={colors.textMuted + "66"}
            multiline
            maxLength={10000}
            style={{
              backgroundColor: colors.surfaceRaised,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.lg,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.lg,
              fontSize: fontSize.base,
              color: colors.text,
              minHeight: 140,
              textAlignVertical: "top",
              marginBottom: spacing.xs,
            }}
          />
          <Text
            style={{
              fontSize: fontSize.xs,
              color: colors.textMuted,
              textAlign: "right",
              marginBottom: spacing.xl,
            }}
          >
            {message.length}/10,000
          </Text>

          {/* Media attachment */}
          <Text
            style={{
              fontSize: fontSize.sm,
              fontWeight: "600",
              color: colors.textMuted,
              marginBottom: spacing.sm,
            }}
          >
            Attach media (optional)
          </Text>
          {media ? (
            <View style={{ marginBottom: spacing.xl }}>
              <Image
                source={{ uri: media.uri }}
                style={{
                  width: "100%",
                  height: 180,
                  borderRadius: radius.lg,
                  backgroundColor: colors.surfaceRaised,
                }}
                resizeMode="cover"
              />
              <Pressable
                onPress={() => setMedia(null)}
                style={{
                  position: "absolute",
                  top: spacing.sm,
                  right: spacing.sm,
                  backgroundColor: "rgba(0,0,0,0.7)",
                  borderRadius: radius.full,
                  width: 28,
                  height: 28,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>✕</Text>
              </Pressable>
              <Text
                style={{
                  fontSize: fontSize.xs,
                  color: colors.textMuted,
                  marginTop: spacing.xs,
                }}
              >
                {media.type === "video" ? "📹 Video attached" : "📷 Image attached"}
              </Text>
            </View>
          ) : (
            <View
              style={{
                flexDirection: "row",
                gap: spacing.md,
                marginBottom: spacing.xl,
              }}
            >
              <Pressable
                onPress={pickFromCamera}
                style={({ pressed }) => ({
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: spacing.sm,
                  backgroundColor: colors.surfaceRaised,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: radius.lg,
                  paddingVertical: spacing.md,
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <Text style={{ fontSize: 18 }}>📷</Text>
                <Text style={{ fontSize: fontSize.sm, color: colors.text }}>Camera</Text>
              </Pressable>
              <Pressable
                onPress={pickFromGallery}
                style={({ pressed }) => ({
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: spacing.sm,
                  backgroundColor: colors.surfaceRaised,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: radius.lg,
                  paddingVertical: spacing.md,
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <Text style={{ fontSize: 18 }}>🖼️</Text>
                <Text style={{ fontSize: fontSize.sm, color: colors.text }}>Gallery</Text>
              </Pressable>
            </View>
          )}

          {/* Link expiry */}
          <Text
            style={{
              fontSize: fontSize.sm,
              fontWeight: "600",
              color: colors.textMuted,
              marginBottom: spacing.sm,
            }}
          >
            Expires after
          </Text>
          <View
            style={{
              flexDirection: "row",
              backgroundColor: colors.surfaceRaised,
              borderRadius: radius.lg,
              padding: 4,
              marginBottom: spacing.xl,
            }}
          >
            {EXPIRY_OPTIONS.map((opt, i) => (
              <Pressable
                key={opt.value}
                onPress={() => setExpiryIdx(i)}
                style={{
                  flex: 1,
                  paddingVertical: spacing.sm,
                  borderRadius: radius.md,
                  alignItems: "center",
                  backgroundColor: expiryIdx === i ? colors.accent : "transparent",
                }}
              >
                <Text
                  style={{
                    fontSize: fontSize.sm,
                    fontWeight: "600",
                    color: expiryIdx === i ? "#000" : colors.textMuted,
                  }}
                >
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* View duration */}
          <Text
            style={{
              fontSize: fontSize.sm,
              fontWeight: "600",
              color: colors.textMuted,
              marginBottom: spacing.sm,
            }}
          >
            View time
          </Text>
          <View
            style={{
              flexDirection: "row",
              backgroundColor: colors.surfaceRaised,
              borderRadius: radius.lg,
              padding: 4,
              marginBottom: spacing.xl,
            }}
          >
            {VIEW_DURATION_OPTIONS.map((opt, i) => (
              <Pressable
                key={opt.value}
                onPress={() => setDurationIdx(i)}
                style={{
                  flex: 1,
                  paddingVertical: spacing.sm,
                  borderRadius: radius.md,
                  alignItems: "center",
                  backgroundColor: durationIdx === i ? colors.accent : "transparent",
                }}
              >
                <Text
                  style={{
                    fontSize: fontSize.sm,
                    fontWeight: "600",
                    color: durationIdx === i ? "#000" : colors.textMuted,
                  }}
                >
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {error ? (
            <Text
              style={{ fontSize: fontSize.sm, color: colors.danger, marginBottom: spacing.md }}
            >
              {error}
            </Text>
          ) : null}

          {/* Send button */}
          <Pressable
            onPress={handleSend}
            disabled={sending}
            style={({ pressed }) => ({
              backgroundColor: colors.accent,
              paddingVertical: spacing.lg,
              borderRadius: radius.full,
              alignItems: "center",
              opacity: sending ? 0.6 : pressed ? 0.9 : 1,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            })}
          >
            <Text style={{ fontSize: fontSize.base, fontWeight: "700", color: "#000" }}>
              {sending ? "Sending..." : "Send secret ✨"}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
