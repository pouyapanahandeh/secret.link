import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useTheme, spacing, radius, fontSize } from "@/lib/theme";
import { secretsApi } from "@/lib/api";
import {
  encryptSecretPayload,
  encodeCiphertextBase64,
  generateSecretKey,
  wrapKeyForRecipient,
} from "@/lib/secret-crypto";

const EXPIRY_OPTIONS = [
  { label: "5 minutes", value: 300 },
  { label: "1 hour", value: 3600 },
  { label: "24 hours", value: 86400 },
  { label: "7 days", value: 604800 },
];

const VIEW_DURATION_OPTIONS = [
  { label: "10 seconds", value: 10 },
  { label: "30 seconds", value: 30 },
  { label: "1 minute", value: 60 },
  { label: "2 minutes", value: 120 },
];

interface ProfileSecretFormProps {
  recipientHandle: string;
  recipientPublicKey?: string | null;
  onSent?: () => void;
}

export function ProfileSecretForm({
  recipientHandle,
  recipientPublicKey,
  onSent,
}: ProfileSecretFormProps) {
  const { colors } = useTheme();
  const [message, setMessage] = useState("");
  const [expiryIdx, setExpiryIdx] = useState(2);
  const [durationIdx, setDurationIdx] = useState(1);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSend() {
    const text = message.trim();
    if (!text) {
      setError("Secret cannot be empty");
      return;
    }
    if (text.length > 10000) {
      setError("Secret too long (max 10,000 characters)");
      return;
    }
    if (!recipientPublicKey) {
      setError(
        "This user hasn't set up secure delivery yet. Ask them to open their dashboard once, then try again.",
      );
      return;
    }

    setSending(true);
    setError("");
    try {
      const { rawKey } = generateSecretKey();
      const data = new TextEncoder().encode(text);
      const { ciphertext, nonce } = encryptSecretPayload(data, rawKey);
      const wrapped = wrapKeyForRecipient(rawKey, recipientPublicKey);

      await secretsApi.create(
        {
          ciphertext: encodeCiphertextBase64(ciphertext),
          contentType: "text",
          nonce,
          ttlSeconds: EXPIRY_OPTIONS[expiryIdx]!.value,
          maxViews: 1,
          mimeType: "text/plain",
          viewDurationSeconds: VIEW_DURATION_OPTIONS[durationIdx]!.value,
          recipientHandle,
          wrappedKey: wrapped.wrappedKey,
          wrapNonce: wrapped.wrapNonce,
          wrapEpk: wrapped.wrapEpk,
        },
        { auth: true },
      );

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSent(true);
      setMessage("");
      onSent?.();
    } catch {
      setError("Failed to send secret. Try again.");
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <View
        style={{
          marginHorizontal: spacing.lg,
          backgroundColor: colors.surfaceRaised,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: radius.xl,
          padding: spacing.xl,
          alignItems: "center",
        }}
      >
        <Text style={{ fontSize: 36, marginBottom: spacing.md }}>✓</Text>
        <Text
          style={{
            fontSize: fontSize.lg,
            fontWeight: "700",
            color: colors.text,
            marginBottom: spacing.sm,
          }}
        >
          Secret sent!
        </Text>
        <Text
          style={{
            fontSize: fontSize.sm,
            color: colors.textMuted,
            textAlign: "center",
            marginBottom: spacing.lg,
          }}
        >
          Your anonymous message was delivered to @{recipientHandle}. It will self-destruct after
          being read.
        </Text>
        <Pressable
          onPress={() => setSent(false)}
          style={({ pressed }) => ({
            backgroundColor: colors.accent,
            paddingHorizontal: spacing.xl,
            paddingVertical: spacing.md,
            borderRadius: radius.full,
            opacity: pressed ? 0.9 : 1,
          })}
        >
          <Text style={{ fontSize: fontSize.sm, fontWeight: "700", color: "#000" }}>
            Send another
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View
      style={{
        marginHorizontal: spacing.lg,
        backgroundColor: colors.surfaceRaised,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.xl,
        padding: spacing.lg,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md }}>
        <Text style={{ fontSize: 18 }}>👻</Text>
        <Text style={{ fontSize: fontSize.sm, fontWeight: "600", color: colors.text }}>
          Send an anonymous secret
        </Text>
      </View>

      <TextInput
        value={message}
        onChangeText={(t) => setMessage(t.slice(0, 10000))}
        placeholder="Type your secret message..."
        placeholderTextColor={colors.textMuted + "66"}
        multiline
        maxLength={10000}
        style={{
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: radius.lg,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          fontSize: fontSize.base,
          color: colors.text,
          minHeight: 100,
          textAlignVertical: "top",
          marginBottom: spacing.md,
        }}
      />

      <Text
        style={{
          fontSize: fontSize.xs,
          color: colors.textMuted,
          textAlign: "right",
          marginBottom: spacing.md,
          marginTop: -spacing.sm,
        }}
      >
        {message.length}/10000
      </Text>

      <Text style={{ fontSize: fontSize.xs, color: colors.textMuted, marginBottom: spacing.xs }}>
        Link expires in
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.md }}>
        {EXPIRY_OPTIONS.map((opt, i) => (
          <Pressable
            key={opt.value}
            onPress={() => setExpiryIdx(i)}
            style={{
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              borderRadius: radius.full,
              backgroundColor: expiryIdx === i ? colors.accent : colors.surface,
              borderWidth: 1,
              borderColor: expiryIdx === i ? colors.accent : colors.border,
            }}
          >
            <Text
              style={{
                fontSize: fontSize.xs,
                fontWeight: "600",
                color: expiryIdx === i ? "#000" : colors.textMuted,
              }}
            >
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={{ fontSize: fontSize.xs, color: colors.textMuted, marginBottom: spacing.xs }}>
        View time
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.md }}>
        {VIEW_DURATION_OPTIONS.map((opt, i) => (
          <Pressable
            key={opt.value}
            onPress={() => setDurationIdx(i)}
            style={{
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              borderRadius: radius.full,
              backgroundColor: durationIdx === i ? colors.accent : colors.surface,
              borderWidth: 1,
              borderColor: durationIdx === i ? colors.accent : colors.border,
            }}
          >
            <Text
              style={{
                fontSize: fontSize.xs,
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
        <Text style={{ fontSize: fontSize.sm, color: colors.danger, marginBottom: spacing.md }}>
          {error}
        </Text>
      ) : null}

      <Pressable
        onPress={handleSend}
        disabled={sending}
        style={({ pressed }) => ({
          backgroundColor: colors.accent,
          paddingVertical: spacing.md,
          borderRadius: radius.full,
          alignItems: "center",
          opacity: sending || pressed ? 0.7 : 1,
        })}
      >
        {sending ? (
          <ActivityIndicator color="#000" />
        ) : (
          <Text style={{ fontSize: fontSize.sm, fontWeight: "700", color: "#000" }}>
            Send anonymously 🤫
          </Text>
        )}
      </Pressable>

      <Text
        style={{
          fontSize: fontSize.xs,
          color: colors.textMuted,
          textAlign: "center",
          marginTop: spacing.md,
        }}
      >
        🔒 End-to-end encrypted · Burns after one read · Completely anonymous
      </Text>
    </View>
  );
}
