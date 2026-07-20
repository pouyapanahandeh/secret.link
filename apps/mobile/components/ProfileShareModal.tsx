import { useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  Share,
  Platform,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import * as Clipboard from "expo-clipboard";
import * as Sharing from "expo-sharing";
import { captureRef } from "react-native-view-shot";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getProfileUrl, getProfileQrUrl } from "@secretlink/core/profile-url";
import {
  STORY_SHARE_PLATFORMS,
  getProfileShareText,
  getStoryShareFallbackUrl,
  type StorySharePlatformId,
} from "@secretlink/core/profile-share";
import { useTheme, spacing, radius, fontSize } from "@/lib/theme";
import { SocialIcon } from "./SocialIcon";
import { ProfileStoryCardCapture } from "./ProfileStoryCard";

interface ProfileShareModalProps {
  handle: string;
  visible: boolean;
  onClose: () => void;
}

export function ProfileShareModal({ handle, visible, onClose }: ProfileShareModalProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const captureRefView = useRef<View>(null);
  const [copied, setCopied] = useState(false);
  const [generatingStory, setGeneratingStory] = useState(false);
  const [sharingPlatform, setSharingPlatform] = useState<StorySharePlatformId | null>(null);

  const origin = "https://secretlink.life";
  const profileUrl = getProfileUrl(handle, origin);
  const qrUrl = getProfileQrUrl(handle, origin);
  const shareText = getProfileShareText(handle, profileUrl);
  const shortUrl = profileUrl.replace(/^https?:\/\//, "");

  async function copyLink() {
    await Clipboard.setStringAsync(profileUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function shareLink() {
    try {
      await Share.share({
        message: shareText,
        url: profileUrl,
        title: `@${handle} on Secretlink.life`,
      });
    } catch {
      /* cancelled */
    }
  }

  async function captureStoryUri(): Promise<string> {
    if (!captureRefView.current) throw new Error("Capture view unavailable");
    return captureRef(captureRefView, {
      format: "png",
      quality: 1,
      width: 1080,
      height: 1920,
    });
  }

  async function shareStoryImage(platformId?: StorySharePlatformId) {
    setGeneratingStory(true);
    if (platformId) setSharingPlatform(platformId);
    try {
      const uri = await captureStoryUri();
      const canShare = await Sharing.isAvailableAsync();

      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: "image/png",
          dialogTitle: `@${handle} — Secretlink story`,
          UTI: "public.png",
        });
        return;
      }

      await Share.share({
        message: shareText,
        url: Platform.OS === "ios" ? uri : profileUrl,
        title: `@${handle} on Secretlink.life`,
      });
    } catch {
      if (platformId) {
        const fallback = getStoryShareFallbackUrl(platformId, handle, profileUrl);
        if (fallback) {
          const { Linking } = await import("react-native");
          await Linking.openURL(fallback);
        }
      }
    } finally {
      setGeneratingStory(false);
      setSharingPlatform(null);
    }
  }

  async function shareToPlatform(platformId: StorySharePlatformId) {
    const platform = STORY_SHARE_PLATFORMS.find((p) => p.id === platformId);
    if (!platform) return;

    if (platform.preferImageShare) {
      await shareStoryImage(platformId);
      return;
    }

    const fallback = getStoryShareFallbackUrl(platformId, handle, profileUrl);
    if (fallback) {
      const { Linking } = await import("react-native");
      await Linking.openURL(fallback);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)" }}
          onPress={onClose}
        />

        <View
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            borderWidth: 1,
            borderBottomWidth: 0,
            borderColor: colors.border,
            maxHeight: "90%",
            paddingBottom: insets.bottom + spacing.md,
          }}
        >
          <View style={{ alignItems: "center", paddingTop: spacing.sm, paddingBottom: spacing.xs }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
          </View>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: spacing.lg,
              paddingBottom: spacing.md,
            }}
          >
            <View>
              <Text style={{ fontSize: fontSize.lg, fontWeight: "700", color: colors.text }}>
                Share profile
              </Text>
              <Text style={{ fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 }}>
                @{handle}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={{ fontSize: fontSize.xl, color: colors.textMuted }}>×</Text>
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.lg }}
            showsVerticalScrollIndicator={false}
          >
            {/* Link + copy */}
            <Text style={{ fontSize: fontSize.xs, fontWeight: "600", color: colors.textMuted, marginBottom: spacing.sm }}>
              Your link
            </Text>
            <Pressable
              onPress={copyLink}
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: colors.surfaceRaised,
                borderWidth: 1,
                borderColor: copied ? colors.accent : colors.border,
                borderRadius: radius.lg,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.md,
                marginBottom: spacing.md,
                gap: spacing.sm,
              }}
            >
              <Text style={{ flex: 1, fontSize: fontSize.sm, fontWeight: "600", color: colors.text }} numberOfLines={1}>
                {shortUrl}
              </Text>
              <View
                style={{
                  backgroundColor: copied ? colors.accent : colors.surface,
                  borderWidth: 1,
                  borderColor: copied ? colors.accent : colors.border,
                  borderRadius: radius.full,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.xs,
                }}
              >
                <Text style={{ fontSize: fontSize.xs, fontWeight: "700", color: copied ? "#000" : colors.text }}>
                  {copied ? "Copied!" : "Copy"}
                </Text>
              </View>
            </Pressable>

            <Pressable
              onPress={shareLink}
              style={({ pressed }) => ({
                backgroundColor: colors.accent,
                borderRadius: radius.lg,
                paddingVertical: spacing.md,
                alignItems: "center",
                marginBottom: spacing.lg,
                opacity: pressed ? 0.9 : 1,
              })}
            >
              <Text style={{ fontSize: fontSize.sm, fontWeight: "700", color: "#000" }}>Share link</Text>
            </Pressable>

            {/* QR code — compact */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
                backgroundColor: colors.surfaceRaised,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius.lg,
                padding: spacing.md,
                marginBottom: spacing.lg,
              }}
            >
              <View
                style={{
                  backgroundColor: "#fff",
                  borderRadius: radius.md,
                  padding: spacing.sm,
                }}
              >
                <QRCode value={qrUrl} size={72} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: fontSize.sm, fontWeight: "600", color: colors.text, marginBottom: 4 }}>
                  QR code
                </Text>
                <Text style={{ fontSize: fontSize.xs, color: colors.textMuted, lineHeight: 16 }}>
                  Let someone scan this to open your profile instantly.
                </Text>
              </View>
            </View>

            {/* Story platforms */}
            <Text style={{ fontSize: fontSize.xs, fontWeight: "600", color: colors.textMuted, marginBottom: spacing.sm }}>
              Share to stories
            </Text>
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: spacing.sm,
                marginBottom: spacing.md,
              }}
            >
              {STORY_SHARE_PLATFORMS.map((platform) => {
                const busy = generatingStory && sharingPlatform === platform.id;
                return (
                  <Pressable
                    key={platform.id}
                    onPress={() => shareToPlatform(platform.id)}
                    disabled={generatingStory}
                    style={({ pressed }) => ({
                      alignItems: "center",
                      justifyContent: "center",
                      width: 52,
                      height: 52,
                      backgroundColor: colors.surfaceRaised,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: radius.lg,
                      opacity: generatingStory ? 0.5 : pressed ? 0.85 : 1,
                    })}
                    accessibilityLabel={platform.label}
                  >
                    {busy ? (
                      <ActivityIndicator size="small" color={colors.accent} />
                    ) : (
                      <SocialIcon platform={platform.id} size={22} />
                    )}
                  </Pressable>
                );
              })}
            </View>

            <Text style={{ fontSize: fontSize.xs, color: colors.textMuted, textAlign: "center", lineHeight: 16 }}>
              Story buttons share a branded image with your QR code and link.
            </Text>
          </ScrollView>
        </View>
      </View>

      <View
        ref={captureRefView}
        collapsable={false}
        style={{ position: "absolute", left: -9999, top: 0, opacity: 0 }}
        pointerEvents="none"
      >
        <ProfileStoryCardCapture handle={handle} qrUrl={qrUrl} origin={origin} />
      </View>
    </Modal>
  );
}
