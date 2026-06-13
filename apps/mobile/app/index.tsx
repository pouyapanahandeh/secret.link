import { useEffect } from "react";
import { useRouter } from "expo-router";
import { View, Text, Pressable, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme, spacing, radius, fontSize } from "@/lib/theme";
import { useAuth } from "@/lib/auth";

export default function LandingScreen() {
  const { colors } = useTheme();
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated) {
      router.replace("/(tabs)");
    }
  }, [isAuthenticated]);

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
        {/* Logo */}
        <View
          style={{
            width: 80,
            height: 80,
            borderRadius: radius.xl,
            backgroundColor: colors.accent,
            justifyContent: "center",
            alignItems: "center",
            marginBottom: spacing["3xl"],
          }}
        >
          <Text style={{ fontSize: 40 }}>🔗</Text>
        </View>

        {/* Title */}
        <Text
          style={{
            fontSize: fontSize["4xl"],
            fontWeight: "800",
            color: colors.text,
            textAlign: "center",
            marginBottom: spacing.sm,
          }}
        >
          secretlink
          <Text style={{ color: colors.accent }}>.</Text>
          life
        </Text>

        <Text
          style={{
            fontSize: fontSize.base,
            color: colors.textMuted,
            textAlign: "center",
            marginBottom: spacing["4xl"],
            lineHeight: 22,
          }}
        >
          Send secrets that self-destruct.{"\n"}
          End-to-end encrypted. No trace.
        </Text>

        {/* CTA Buttons */}
        <Pressable
          onPress={() => router.push("/signup")}
          style={({ pressed }) => ({
            backgroundColor: colors.accent,
            paddingVertical: spacing.lg,
            paddingHorizontal: spacing["4xl"],
            borderRadius: radius.full,
            width: "100%",
            alignItems: "center",
            marginBottom: spacing.md,
            transform: [{ scale: pressed ? 0.97 : 1 }],
          })}
        >
          <Text
            style={{
              fontSize: fontSize.base,
              fontWeight: "700",
              color: "#000000",
            }}
          >
            Get your @handle
          </Text>
        </Pressable>

        <Pressable
          onPress={() => router.push("/login")}
          style={({ pressed }) => ({
            borderWidth: 1,
            borderColor: colors.border,
            paddingVertical: spacing.lg,
            paddingHorizontal: spacing["4xl"],
            borderRadius: radius.full,
            width: "100%",
            alignItems: "center",
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Text
            style={{
              fontSize: fontSize.base,
              fontWeight: "600",
              color: colors.text,
            }}
          >
            Sign in
          </Text>
        </Pressable>

        {/* Privacy note */}
        <Text
          style={{
            fontSize: fontSize.xs,
            color: colors.textMuted,
            textAlign: "center",
            marginTop: spacing["3xl"],
            lineHeight: 16,
          }}
        >
          🔒 End-to-end encrypted · Burns after one read
        </Text>
      </View>
    </SafeAreaView>
  );
}
