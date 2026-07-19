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
import { getProfileUrl, getProfileQrUrl } from "@secretlink/core/profile-url";
import {
  STORY_SHARE_PLATFORMS,
  getProfileShareText,
  getStoryShareFallbackUrl,
  type StorySharePlatformId,
} from "@secretlink/core/profile-share";
import { useTheme, spacing, radius, fontSize } from "@/lib/theme";
import { SocialIcon } from "./SocialIcon";
import { ProfileStoryCard, ProfileStoryCardCapture } from "./ProfileStoryCard";

interface ProfileShareModalProps {
  handle: string;
  visible: boolean;
  onClose: () => void;
}

export function ProfileShareModal({ handle, visible, onClose }: ProfileShareModalProps) {
  const { colors } = useTheme();
  const captureRefView = useRef<View>(null);
  const [copied, setCopied] = useState(false);
  const [generatingStory, setGeneratingStory] = useState(false);
  const [sharingPlatform, setSharingPlatform] = useState<StorySharePlatformId | null>(null);
  const [storyHint, setStoryHint] = useState<string | null>(null);

  const origin = "https://secretlink.life";
  const profileUrl = getProfileUrl(handle, origin);
  const qrUrl = getProfileQrUrl(handle, origin);
  const shareText = getProfileShareText(handle, profileUrl);

  async function copyLink() {
    await Clipboard.setStringAsync(profileUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function shareLink() {
    try {
      await Share.share({
        message: Platform.OS === "ios" ? shareText : shareText,
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
    setStoryHint(null);
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
        message: `${shareText}\n\n(Attach the story image from your photos if needed.)`,
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
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: spacing.lg }}
        onPress={onClose}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: colors.surface,
            borderRadius: radius.xl,
            borderWidth: 1,
            borderColor: colors.border,
            maxHeight: "90%",
          }}
        >
          <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
            <Text style={{ fontSize: fontSize.base, fontWeight: "700", color: colors.text, marginBottom: spacing.lg }}>
              Share profile
            </Text>

            <View
              style={{
                alignItems: "center",
                backgroundColor: "#fff",
                borderRadius: radius.lg,
                padding: spacing.lg,
                marginBottom: spacing.md,
              }}
            >
              <QRCode value={qrUrl} size={140} />
            </View>

            <Text style={{ fontSize: fontSize.xs, color: colors.textMuted, textAlign: "center", marginBottom: spacing.md }}>
              Scan to open @{handle}
            </Text>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: colors.surfaceRaised,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius.lg,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                marginBottom: spacing.lg,
                gap: spacing.sm,
              }}
            >
              <Text style={{ flex: 1, fontSize: fontSize.xs, color: colors.text }} numberOfLines={1}>
                {profileUrl.replace(/^https?:\/\//, "")}
              </Text>
              <Pressable onPress={copyLink}>
                <Text style={{ fontSize: fontSize.xs, fontWeight: "600", color: colors.accent }}>
                  {copied ? "Copied!" : "Copy"}
                </Text>
              </Pressable>
            </View>

            <Text style={{ fontSize: fontSize.sm, fontWeight: "700", color: colors.text, marginBottom: spacing.xs }}>
              Share as story
            </Text>
            <Text style={{ fontSize: fontSize.xs, color: colors.textMuted, marginBottom: spacing.md }}>
              Post your QR code and profile link to Instagram, Facebook, WhatsApp, and more.
            </Text>

            <View style={{ alignItems: "center", marginBottom: spacing.md }}>
              <ProfileStoryCard handle={handle} qrUrl={qrUrl} origin={origin} />
            </View>

            <Pressable
              onPress={() => shareStoryImage()}
              disabled={generatingStory}
              style={{
                backgroundColor: colors.surfaceRaised,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius.lg,
                paddingVertical: spacing.md,
                alignItems: "center",
                marginBottom: spacing.md,
                opacity: generatingStory ? 0.6 : 1,
              }}
            >
              {generatingStory && !sharingPlatform ? (
                <ActivityIndicator color={colors.accent} />
              ) : (
                <Text style={{ fontSize: fontSize.sm, fontWeight: "600", color: colors.text }}>
                  Share story image…
                </Text>
              )}
            </Pressable>

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.md }}>
              {STORY_SHARE_PLATFORMS.map((platform) => (
                <Pressable
                  key={platform.id}
                  onPress={() => shareToPlatform(platform.id)}
                  disabled={generatingStory}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.sm,
                    backgroundColor: colors.surfaceRaised,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: radius.lg,
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.sm,
                    minWidth: "47%",
                    opacity: generatingStory ? 0.6 : 1,
                  }}
                >
                  <SocialIcon platform={platform.id} size={18} />
                  <Text style={{ fontSize: fontSize.xs, fontWeight: "600", color: colors.text, flex: 1 }} numberOfLines={1}>
                    {sharingPlatform === platform.id ? "Sharing…" : platform.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {storyHint ? (
              <Text style={{ fontSize: fontSize.xs, color: colors.accent, marginBottom: spacing.md }}>{storyHint}</Text>
            ) : null}

            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <Pressable
                onPress={shareLink}
                style={{
                  flex: 1,
                  backgroundColor: colors.surfaceRaised,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: radius.lg,
                  paddingVertical: spacing.md,
                  alignItems: "center",
                }}
              >
                <Text style={{ fontSize: fontSize.sm, fontWeight: "600", color: colors.text }}>Share link…</Text>
              </Pressable>
              <Pressable
                onPress={onClose}
                style={{
                  flex: 1,
                  backgroundColor: colors.accent,
                  borderRadius: radius.lg,
                  paddingVertical: spacing.md,
                  alignItems: "center",
                }}
              >
                <Text style={{ fontSize: fontSize.sm, fontWeight: "700", color: "#000" }}>Done</Text>
              </Pressable>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>

      {/* Off-screen view for high-res story capture */}
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
