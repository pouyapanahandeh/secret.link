import { useState } from "react";
import { useRouter } from "expo-router";
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme, spacing, radius, fontSize } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { passkeyLogin, isPasskeySupported } from "@/lib/passkey";

export default function LoginScreen() {
  const { colors } = useTheme();
  const { sendMagicLink, login } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [handle, setHandle] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"magic-link" | "passkey">("magic-link");
  const [passkeyLoading, setPasskeyLoading] = useState(false);

  async function handlePasskeyLogin() {
    if (!handle.trim() || handle.trim().length < 3) {
      setError("Enter your handle (at least 3 characters)");
      return;
    }
    setPasskeyLoading(true);
    setError("");
    try {
      const { token } = await passkeyLogin(handle.trim().toLowerCase());
      await login(token);
    } catch (e: any) {
      setError(e?.message ?? "Passkey login failed");
    } finally {
      setPasskeyLoading(false);
    }
  }

  async function handleMagicLink() {
    if (!email.trim() || !email.includes("@")) {
      setError("Enter a valid email address");
      return;
    }
    setSending(true);
    setError("");
    try {
      const ok = await sendMagicLink(email.trim());
      if (ok) {
        setSent(true);
      } else {
        setError("Failed to send magic link. Try again.");
      }
    } catch (e) {
      if (e instanceof ApiError) {
        const data = e.data as { error?: string };
        setError(data?.error ?? "Something went wrong");
      } else {
        setError("Network error. Check your connection.");
      }
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
          <Text style={{ fontSize: 48, marginBottom: spacing.xl }}>📧</Text>
          <Text
            style={{
              fontSize: fontSize.xl,
              fontWeight: "700",
              color: colors.text,
              textAlign: "center",
              marginBottom: spacing.md,
            }}
          >
            Check your email
          </Text>
          <Text
            style={{
              fontSize: fontSize.base,
              color: colors.textMuted,
              textAlign: "center",
              lineHeight: 22,
            }}
          >
            We sent a magic link to{"\n"}
            <Text style={{ color: colors.accent, fontWeight: "600" }}>
              {email}
            </Text>
          </Text>
          <Pressable
            onPress={() => setSent(false)}
            style={{ marginTop: spacing["3xl"] }}
          >
            <Text
              style={{
                fontSize: fontSize.sm,
                color: colors.textMuted,
              }}
            >
              Didn't receive it? Try again
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
        {/* Back button */}
        <Pressable
          onPress={() => router.back()}
          style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}
        >
          <Text
            style={{
              fontSize: fontSize.lg,
              color: colors.textMuted,
            }}
          >
            ← Back
          </Text>
        </Pressable>

        <View
          style={{
            flex: 1,
            justifyContent: "center",
            paddingHorizontal: spacing["3xl"],
          }}
        >
          <Text
            style={{
              fontSize: fontSize["3xl"],
              fontWeight: "800",
              color: colors.text,
              marginBottom: spacing.sm,
            }}
          >
            Welcome back
          </Text>
          <Text
            style={{
              fontSize: fontSize.base,
              color: colors.textMuted,
              marginBottom: spacing.xl,
            }}
          >
            Choose how to sign in
          </Text>

          {/* Mode toggle */}
          <View
            style={{
              flexDirection: "row",
              backgroundColor: colors.surfaceRaised,
              borderRadius: radius.lg,
              padding: 4,
              marginBottom: spacing.xl,
            }}
          >
            <Pressable
              onPress={() => { setMode("magic-link"); setError(""); }}
              style={{
                flex: 1,
                paddingVertical: spacing.sm,
                borderRadius: radius.md,
                alignItems: "center",
                backgroundColor: mode === "magic-link" ? colors.accent : "transparent",
              }}
            >
              <Text
                style={{
                  fontSize: fontSize.sm,
                  fontWeight: "600",
                  color: mode === "magic-link" ? "#000" : colors.textMuted,
                }}
              >
                ✨ Magic Link
              </Text>
            </Pressable>
            <Pressable
              onPress={() => { setMode("passkey"); setError(""); }}
              style={{
                flex: 1,
                paddingVertical: spacing.sm,
                borderRadius: radius.md,
                alignItems: "center",
                backgroundColor: mode === "passkey" ? colors.accent : "transparent",
              }}
            >
              <Text
                style={{
                  fontSize: fontSize.sm,
                  fontWeight: "600",
                  color: mode === "passkey" ? "#000" : colors.textMuted,
                }}
              >
                🔑 Passkey
              </Text>
            </Pressable>
          </View>

          {mode === "magic-link" ? (
            <>
              {/* Email input */}
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={colors.textMuted + "66"}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                style={{
                  backgroundColor: colors.surfaceRaised,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: radius.lg,
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.lg,
                  fontSize: fontSize.base,
                  color: colors.text,
                  marginBottom: spacing.lg,
                }}
              />

              {error ? (
                <Text style={{ fontSize: fontSize.sm, color: colors.danger, marginBottom: spacing.md }}>
                  {error}
                </Text>
              ) : null}

              <Pressable
                onPress={handleMagicLink}
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
                <Text style={{ fontSize: fontSize.base, fontWeight: "700", color: "#000000" }}>
                  {sending ? "Sending..." : "Send magic link ✨"}
                </Text>
              </Pressable>
            </>
          ) : (
            <>
              {/* Handle input for passkey */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: colors.surfaceRaised,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: radius.lg,
                  paddingHorizontal: spacing.lg,
                  marginBottom: spacing.lg,
                }}
              >
                <Text style={{ fontSize: fontSize.base, color: colors.textMuted, marginRight: 2 }}>@</Text>
                <TextInput
                  value={handle}
                  onChangeText={(t) => setHandle(t.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
                  placeholder="yourhandle"
                  placeholderTextColor={colors.textMuted + "66"}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={{
                    flex: 1,
                    paddingVertical: spacing.lg,
                    fontSize: fontSize.base,
                    color: colors.text,
                  }}
                />
              </View>

              {error ? (
                <Text style={{ fontSize: fontSize.sm, color: colors.danger, marginBottom: spacing.md }}>
                  {error}
                </Text>
              ) : null}

              <Pressable
                onPress={handlePasskeyLogin}
                disabled={passkeyLoading}
                style={({ pressed }) => ({
                  backgroundColor: colors.accent,
                  paddingVertical: spacing.lg,
                  borderRadius: radius.full,
                  alignItems: "center",
                  opacity: passkeyLoading ? 0.6 : pressed ? 0.9 : 1,
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                })}
              >
                <Text style={{ fontSize: fontSize.base, fontWeight: "700", color: "#000000" }}>
                  {passkeyLoading ? "Authenticating..." : "Sign in with Passkey 🔑"}
                </Text>
              </Pressable>
            </>
          )}

          <Pressable
            onPress={() => router.push("/signup")}
            style={{ marginTop: spacing.xl, alignItems: "center" }}
          >
            <Text style={{ fontSize: fontSize.sm, color: colors.textMuted }}>
              Don't have an account?{" "}
              <Text style={{ color: colors.accent }}>Sign up</Text>
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
