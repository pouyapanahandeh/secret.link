import { useState } from "react";
import { useRouter } from "expo-router";
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme, spacing, radius, fontSize } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { passkeyLogin, isPasskeySupported } from "@/lib/passkey";

export default function LoginScreen() {
  const { colors } = useTheme();
  const { login } = useAuth();
  const router = useRouter();

  const [handle, setHandle] = useState("");
  const [error, setError] = useState("");
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <Pressable
          onPress={() => router.back()}
          style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}
        >
          <Text style={{ fontSize: fontSize.lg, color: colors.textMuted }}>← Back</Text>
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
            Sign in with your passkey
          </Text>

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

          {!isPasskeySupported() && (
            <Text style={{ fontSize: fontSize.xs, color: colors.textMuted, marginBottom: spacing.md }}>
              Passkeys require iOS 16+ or Android 14+
            </Text>
          )}

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
