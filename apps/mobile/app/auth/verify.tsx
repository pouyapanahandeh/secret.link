import { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { View, Text, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme, spacing, fontSize } from "@/lib/theme";
import { useAuth } from "@/lib/auth";

/**
 * Deep link handler: secretlink://auth/verify?token=xxx
 * Also handles: https://secretlink.life/auth/verify?token=xxx
 */
export default function AuthVerifyScreen() {
  const { colors } = useTheme();
  const { verifyMagicLink } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string }>();
  const [error, setError] = useState("");

  useEffect(() => {
    const token = params.token;
    if (!token) {
      setError("Invalid verification link");
      return;
    }

    (async () => {
      try {
        await verifyMagicLink(token);
        // Auth provider will redirect to tabs
      } catch {
        setError("Verification failed. The link may have expired.");
      }
    })();
  }, [params.token]);

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: colors.surface,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: spacing["3xl"],
      }}
    >
      {error ? (
        <>
          <Text style={{ fontSize: 48, marginBottom: spacing.lg }}>❌</Text>
          <Text
            style={{
              fontSize: fontSize.lg,
              fontWeight: "700",
              color: colors.text,
              textAlign: "center",
              marginBottom: spacing.sm,
            }}
          >
            Verification failed
          </Text>
          <Text
            style={{
              fontSize: fontSize.base,
              color: colors.textMuted,
              textAlign: "center",
            }}
          >
            {error}
          </Text>
        </>
      ) : (
        <>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text
            style={{
              fontSize: fontSize.base,
              color: colors.textMuted,
              marginTop: spacing.lg,
            }}
          >
            Verifying...
          </Text>
        </>
      )}
    </SafeAreaView>
  );
}
