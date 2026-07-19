import { View, Text } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { getProfileUrl } from "@secretlink/core/profile-url";
import { useTheme, spacing, radius, fontSize } from "@/lib/theme";

interface ProfileStoryCardProps {
  handle: string;
  qrUrl: string;
  origin?: string;
}

/** 9:16 story card — captured at high resolution for social sharing. */
export function ProfileStoryCard({ handle, qrUrl, origin = "https://secretlink.life" }: ProfileStoryCardProps) {
  const profileUrl = getProfileUrl(handle, origin);
  const shortUrl = profileUrl.replace(/^https?:\/\//, "");

  return (
    <View
      style={{
        width: 270,
        height: 480,
        backgroundColor: "#0f0f12",
        borderRadius: radius.lg,
        overflow: "hidden",
        padding: spacing.lg,
        justifyContent: "space-between",
      }}
    >
      <View style={{ alignItems: "center", marginTop: spacing.sm }}>
        <Text style={{ fontSize: fontSize.sm, fontWeight: "600", color: "#fff" }}>
          secretlink
          <Text style={{ color: "#c8ff00" }}>.life</Text>
        </Text>
        <Text
          style={{
            fontSize: fontSize.xl,
            fontWeight: "800",
            color: "#fff",
            marginTop: spacing.md,
          }}
        >
          @{handle}
        </Text>
        <Text style={{ fontSize: fontSize.xs, color: "#a8a8b3", marginTop: spacing.xs, textAlign: "center" }}>
          Scan to send me a secret 🔒
        </Text>
      </View>

      <View
        style={{
          alignSelf: "center",
          backgroundColor: "#fff",
          borderRadius: radius.lg,
          padding: spacing.md,
        }}
      >
        <QRCode value={qrUrl} size={140} />
      </View>

      <View style={{ alignItems: "center", marginBottom: spacing.sm }}>
        <Text style={{ fontSize: fontSize.xs, fontWeight: "600", color: "#c8ff00" }}>{shortUrl}</Text>
        <Text style={{ fontSize: 10, color: "#888894", marginTop: spacing.xs, textAlign: "center" }}>
          End-to-end encrypted · Burns after one read
        </Text>
      </View>
    </View>
  );
}

/** Off-screen card for high-res capture (1080×1920). */
export function ProfileStoryCardCapture({
  handle,
  qrUrl,
  origin,
}: ProfileStoryCardProps) {
  const profileUrl = getProfileUrl(handle, origin);
  const shortUrl = profileUrl.replace(/^https?:\/\//, "");

  return (
    <View
      style={{
        width: 1080,
        height: 1920,
        backgroundColor: "#0f0f12",
        padding: 80,
        justifyContent: "space-between",
      }}
    >
      <View style={{ alignItems: "center" }}>
        <Text style={{ fontSize: 44, fontWeight: "600", color: "#fff" }}>
          secretlink
          <Text style={{ color: "#c8ff00" }}>.life</Text>
        </Text>
        <Text style={{ fontSize: 80, fontWeight: "800", color: "#fff", marginTop: 40 }}>@{handle}</Text>
        <Text style={{ fontSize: 34, color: "#a8a8b3", marginTop: 24, textAlign: "center" }}>
          Scan to send me a secret 🔒
        </Text>
      </View>

      <View
        style={{
          alignSelf: "center",
          backgroundColor: "#fff",
          borderRadius: 36,
          padding: 28,
        }}
      >
        <QRCode value={qrUrl} size={520} />
      </View>

      <View style={{ alignItems: "center" }}>
        <Text style={{ fontSize: 38, fontWeight: "600", color: "#c8ff00" }}>{shortUrl}</Text>
        <Text style={{ fontSize: 28, color: "#888894", marginTop: 24, textAlign: "center" }}>
          End-to-end encrypted · Burns after one read
        </Text>
      </View>
    </View>
  );
}
