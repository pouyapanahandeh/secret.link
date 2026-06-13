import { View, Text } from "react-native";
import { useTheme, spacing, fontSize } from "@/lib/theme";

export default function MapTab() {
  const { colors } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, justifyContent: "center", alignItems: "center", padding: spacing.xl }}>
      <Text style={{ fontSize: 48, marginBottom: spacing.lg }}>🗺️</Text>
      <Text style={{ color: colors.text, fontSize: fontSize.lg, fontWeight: "700", textAlign: "center", marginBottom: spacing.sm }}>
        Map Coming Soon
      </Text>
      <Text style={{ color: colors.textMuted, fontSize: fontSize.base, textAlign: "center" }}>
        Drop and discover secrets on the map. This feature requires a Google Maps API key.
      </Text>
    </View>
  );
}
