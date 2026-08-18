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
import { ApiError } from "@/lib/api";

export default function SignupScreen() {
  const { colors } = useTheme();
  const { signup } = useAuth();
  const router = useRouter();

  const [handle, setHandle] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ handle?: string; email?: string }>({});

  function validateHandle(v: string) {
    return v
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "")
      .slice(0, 32);
  }

  async function handleSubmit() {
    const clean = validateHandle(handle);
    if (clean.length < 3) {
      setErrors({ handle: "Handle must be at least 3 characters" });
      return;
    }
    if (email && !email.includes("@")) {
      setErrors({ email: "Enter a valid email" });
      return;
    }

    setLoading(true);
    setErrors({});
    try {
      await signup(clean, email.trim() || undefined);
      // Auth provider will redirect to tabs
    } catch (e) {
      if (e instanceof ApiError) {
        const data = e.data as { error?: string };
        if (data?.error === "handle_taken") {
          setErrors({ handle: "This handle is already taken" });
        } else {
          setErrors({ handle: data?.error ?? "Something went wrong" });
        }
      } else {
        setErrors({ handle: "Network error. Check your connection." });
      }
    } finally {
      setLoading(false);
    }
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
          <Text style={{ fontSize: fontSize.lg, color: colors.textMuted }}>
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
            Claim your @handle
          </Text>
          <Text
            style={{
              fontSize: fontSize.base,
              color: colors.textMuted,
              marginBottom: spacing["3xl"],
            }}
          >
            Your anonymous inbox on Secretlink
          </Text>

          {/* Handle input */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: colors.surfaceRaised,
              borderWidth: 1,
              borderColor: errors.handle ? colors.danger : colors.border,
              borderRadius: radius.lg,
              paddingHorizontal: spacing.lg,
              marginBottom: spacing.sm,
            }}
          >
            <Text
              style={{
                fontSize: fontSize.base,
                color: colors.textMuted,
                marginRight: 2,
              }}
            >
              @
            </Text>
            <TextInput
              value={handle}
              onChangeText={(t) => setHandle(validateHandle(t))}
              placeholder="yourname"
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
          {errors.handle ? (
            <Text
              style={{
                fontSize: fontSize.sm,
                color: colors.danger,
                marginBottom: spacing.md,
              }}
            >
              {errors.handle}
            </Text>
          ) : (
            <View style={{ height: spacing.md }} />
          )}

          {/* Email input (optional) */}
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Email (optional - for Pro features)"
            placeholderTextColor={colors.textMuted + "66"}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            style={{
              backgroundColor: colors.surfaceRaised,
              borderWidth: 1,
              borderColor: errors.email ? colors.danger : colors.border,
              borderRadius: radius.lg,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.lg,
              fontSize: fontSize.base,
              color: colors.text,
              marginBottom: spacing.sm,
            }}
          />
          {errors.email ? (
            <Text
              style={{
                fontSize: fontSize.sm,
                color: colors.danger,
                marginBottom: spacing.md,
              }}
            >
              {errors.email}
            </Text>
          ) : (
            <View style={{ height: spacing.md }} />
          )}

          {/* Submit */}
          <Pressable
            onPress={handleSubmit}
            disabled={loading}
            style={({ pressed }) => ({
              backgroundColor: colors.accent,
              paddingVertical: spacing.lg,
              borderRadius: radius.full,
              alignItems: "center",
              opacity: loading ? 0.6 : pressed ? 0.9 : 1,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            })}
          >
            <Text
              style={{
                fontSize: fontSize.base,
                fontWeight: "700",
                color: "#000000",
              }}
            >
              {loading ? "Creating..." : "Claim @handle"}
            </Text>
          </Pressable>

          {/* Privacy notice */}
          <Text
            style={{
              fontSize: fontSize.xs,
              color: colors.textMuted,
              textAlign: "center",
              marginTop: spacing.xl,
              lineHeight: 16,
            }}
          >
            By signing up, you confirm you are 18+ and accept our Privacy
            Policy.
          </Text>

          <Pressable
            onPress={() => router.push("/login")}
            style={{ marginTop: spacing.xl, alignItems: "center" }}
          >
            <Text style={{ fontSize: fontSize.sm, color: colors.textMuted }}>
              Already have an account?{" "}
              <Text style={{ color: colors.accent }}>Log in</Text>
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
