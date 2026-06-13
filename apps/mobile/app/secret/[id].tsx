import { useState, useEffect, useRef } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { View, Text, Pressable, Animated, Image, AppState } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useTheme, spacing, radius, fontSize } from "@/lib/theme";
import { secretsApi } from "@/lib/api";

export default function RevealSecretScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [state, setState] = useState<"ready" | "revealed" | "expired" | "error">("ready");
  const [content, setContent] = useState("");
  const [contentType, setContentType] = useState("text");
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [maxDuration, setMaxDuration] = useState(0);
  const [error, setError] = useState("");
  const [hidden, setHidden] = useState(false); // capture-resistance
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Capture resistance: hide content when app backgrounds ────────────────
  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      if (state === "revealed") {
        if (nextState !== "active") {
          setHidden(true);
        } else {
          // Brief delay before showing again (prevents screenshot on resume)
          setTimeout(() => setHidden(false), 300);
        }
      }
    });
    return () => sub.remove();
  }, [state]);

  async function handleReveal() {
    if (!id) return;
    try {
      const data = await secretsApi.reveal(id);

      // Parse media content if present
      const raw = data.ciphertext;
      const mediaMatch = raw.match(/\[media:(image|video)\](.+)$/s);
      if (mediaMatch) {
        const textPart = raw.slice(0, raw.indexOf("[media:")).replace(/\n---\n$/, "");
        setContent(textPart);
        setContentType(mediaMatch[1]!);
        setMediaUri(`data:${mediaMatch[1] === "video" ? "video/mp4" : "image/jpeg"};base64,${mediaMatch[2]}`);
      } else {
        setContent(raw);
        setContentType(data.contentType);
      }

      setState("revealed");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Animate in
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();

      // Start countdown if view duration set
      if (data.viewDurationSeconds && data.viewDurationSeconds > 0) {
        setMaxDuration(data.viewDurationSeconds);
        setCountdown(data.viewDurationSeconds);
        timerRef.current = setInterval(() => {
          setCountdown((prev) => {
            if (prev <= 1) {
              if (timerRef.current) clearInterval(timerRef.current);
              setState("expired");
              setContent("");
              setMediaUri(null);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
    } catch (e: any) {
      setError(e?.message ?? "Failed to reveal");
      setState("error");
    }
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Expired state
  if (state === "expired") {
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
          <Text style={{ fontSize: 48, marginBottom: spacing.lg }}>🔥</Text>
          <Text
            style={{
              fontSize: fontSize.xl,
              fontWeight: "700",
              color: colors.text,
              textAlign: "center",
              marginBottom: spacing.sm,
            }}
          >
            Secret burned
          </Text>
          <Text
            style={{
              fontSize: fontSize.base,
              color: colors.textMuted,
              textAlign: "center",
              marginBottom: spacing["3xl"],
            }}
          >
            This secret can no longer be viewed.
          </Text>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => ({
              backgroundColor: colors.surfaceRaised,
              borderWidth: 1,
              borderColor: colors.border,
              paddingVertical: spacing.lg,
              paddingHorizontal: spacing["3xl"],
              borderRadius: radius.full,
              opacity: pressed ? 0.9 : 1,
            })}
          >
            <Text style={{ fontSize: fontSize.base, fontWeight: "600", color: colors.text }}>
              Go back
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (state === "error") {
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
          <Text style={{ fontSize: 48, marginBottom: spacing.lg }}>❌</Text>
          <Text
            style={{
              fontSize: fontSize.xl,
              fontWeight: "700",
              color: colors.text,
              textAlign: "center",
              marginBottom: spacing.sm,
            }}
          >
            Cannot reveal
          </Text>
          <Text
            style={{
              fontSize: fontSize.base,
              color: colors.textMuted,
              textAlign: "center",
              marginBottom: spacing["3xl"],
            }}
          >
            {error || "This secret may have expired or been burned."}
          </Text>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => ({
              backgroundColor: colors.surfaceRaised,
              borderWidth: 1,
              borderColor: colors.border,
              paddingVertical: spacing.lg,
              paddingHorizontal: spacing["3xl"],
              borderRadius: radius.full,
              opacity: pressed ? 0.9 : 1,
            })}
          >
            <Text style={{ fontSize: fontSize.base, fontWeight: "600", color: colors.text }}>
              Go back
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // Revealed state
  if (state === "revealed") {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
        <View style={{ flex: 1, paddingHorizontal: spacing.lg }}>
          {/* Header with timer */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingVertical: spacing.md,
            }}
          >
            <Pressable onPress={() => router.back()}>
              <Text style={{ fontSize: fontSize.lg, color: colors.textMuted }}>← Back</Text>
            </Pressable>
            {maxDuration > 0 && (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.sm,
                }}
              >
                <Text style={{ fontSize: fontSize.sm, color: colors.danger, fontWeight: "700" }}>
                  🔥 {countdown}s
                </Text>
                {/* Progress bar */}
                <View
                  style={{
                    width: 60,
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: colors.border,
                    overflow: "hidden",
                  }}
                >
                  <View
                    style={{
                      width: `${(countdown / maxDuration) * 100}%`,
                      height: "100%",
                      backgroundColor: countdown < 5 ? colors.danger : colors.accent,
                      borderRadius: 2,
                    }}
                  />
                </View>
              </View>
            )}
          </View>

          {/* Capture-resistance overlay */}
          {hidden ? (
            <View
              style={{
                flex: 1,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Text style={{ fontSize: 48, marginBottom: spacing.md }}>🙈</Text>
              <Text style={{ fontSize: fontSize.base, color: colors.textMuted, textAlign: "center" }}>
                Content hidden for security
              </Text>
            </View>
          ) : (
            /* Content */
            <Animated.View
              style={{
                flex: 1,
                justifyContent: "center",
                opacity: fadeAnim,
              }}
            >
              <View
                style={{
                  backgroundColor: colors.surfaceRaised,
                  borderWidth: 1,
                  borderColor: colors.accent + "40",
                  borderRadius: radius.xl,
                  padding: spacing.xl,
                }}
              >
                <Text style={{ fontSize: 24, marginBottom: spacing.md, textAlign: "center" }}>
                  {mediaUri ? "📎" : "💬"}
                </Text>

                {/* Media preview */}
                {mediaUri && (
                  <Image
                    source={{ uri: mediaUri }}
                    style={{
                      width: "100%",
                      height: 240,
                      borderRadius: radius.lg,
                      marginBottom: content ? spacing.md : 0,
                    }}
                    resizeMode="contain"
                  />
                )}

                {/* Text content */}
                {content ? (
                  <Text
                    style={{
                      fontSize: fontSize.base,
                      color: colors.text,
                      lineHeight: 24,
                      textAlign: "center",
                    }}
                  >
                    {content}
                  </Text>
                ) : null}
              </View>
            </Animated.View>
          )}
        </View>
      </SafeAreaView>
    );
  }

  // Ready state - reveal button
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
        }}
      >
        <Pressable onPress={() => router.back()}>
          <Text style={{ fontSize: fontSize.lg, color: colors.textMuted }}>← Back</Text>
        </Pressable>
      </View>
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          paddingHorizontal: spacing["3xl"],
        }}
      >
        <Text style={{ fontSize: 64, marginBottom: spacing.xl }}>🔒</Text>
        <Text
          style={{
            fontSize: fontSize.xl,
            fontWeight: "700",
            color: colors.text,
            textAlign: "center",
            marginBottom: spacing.sm,
          }}
        >
          You have a secret
        </Text>
        <Text
          style={{
            fontSize: fontSize.base,
            color: colors.textMuted,
            textAlign: "center",
            marginBottom: spacing["3xl"],
          }}
        >
          Once revealed, this secret may disappear.{"\n"}
          View carefully.
        </Text>
        <Pressable
          onPress={handleReveal}
          style={({ pressed }) => ({
            backgroundColor: colors.accent,
            paddingVertical: spacing.lg,
            paddingHorizontal: spacing["4xl"],
            borderRadius: radius.full,
            opacity: pressed ? 0.9 : 1,
            transform: [{ scale: pressed ? 0.97 : 1 }],
          })}
        >
          <Text style={{ fontSize: fontSize.lg, fontWeight: "700", color: "#000" }}>
            Reveal ✨
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
