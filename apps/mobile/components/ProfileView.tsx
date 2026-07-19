import { View, Text, Pressable, Image, Linking } from "react-native";
import type { ProfileViewMode, PublicProfile } from "@secretlink/core/profile-types";
import { UI_FEATURES } from "@secretlink/core/feature-flags";
import { getSocialLabel } from "@secretlink/core/socials";
import { getSocialLinkUrl } from "@secretlink/core/profile-url";
import { useTheme, spacing, radius, fontSize } from "@/lib/theme";
import { SocialIcon } from "./SocialIcon";

const API_BASE = "https://secretlink.life";

export interface ProfileViewProps {
  profile: PublicProfile | null;
  handle: string;
  mode: ProfileViewMode;
  followersCount?: number;
  followingCount?: number;
  isFollowing?: boolean;
  onFollow?: () => void;
  onFollowersPress?: () => void;
  onFollowingPress?: () => void;
  onShare?: () => void;
  onStats?: () => void;
  onEdit?: () => void;
  onMessage?: () => void;
}

export function ProfileView({
  profile,
  handle,
  mode,
  followersCount = 0,
  followingCount = 0,
  isFollowing = false,
  onFollow,
  onFollowersPress,
  onFollowingPress,
  onShare,
  onStats,
  onEdit,
  onMessage,
}: ProfileViewProps) {
  const { colors } = useTheme();
  const isOwner = mode === "owner";
  const isVisitor = mode === "visitor";

  function openSocialLink(platform: string, url: string) {
    const target = isOwner
      ? url.startsWith("http")
        ? url
        : `https://${url}`
      : getSocialLinkUrl(handle, platform, API_BASE);
    Linking.openURL(target);
  }

  return (
    <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.lg }}>
      <View style={{ flexDirection: "row", gap: spacing.md, alignItems: "flex-start" }}>
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: 36,
            backgroundColor: colors.accent + "33",
            borderWidth: 3,
            borderColor: colors.accent,
            justifyContent: "center",
            alignItems: "center",
            overflow: "hidden",
          }}
        >
          {profile?.avatarUrl ? (
            <Image
              source={{ uri: profile.avatarUrl }}
              style={{ width: 72, height: 72 }}
              accessibilityLabel={`@${handle} avatar`}
            />
          ) : (
            <Text style={{ fontSize: 28, fontWeight: "700", color: colors.accent }}>
              {(handle[0] ?? "?").toUpperCase()}
            </Text>
          )}
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.sm }}>
            <Text style={{ fontSize: fontSize.xl, fontWeight: "800", color: colors.text }}>
              @{handle}
            </Text>
            {profile?.isPro && (
              <View
                style={{
                  backgroundColor: colors.accent + "1A",
                  borderRadius: radius.full,
                  paddingHorizontal: spacing.sm,
                  paddingVertical: 2,
                }}
              >
                <Text style={{ fontSize: fontSize.xs, color: colors.accent, fontWeight: "600" }}>
                  ⭐ Pro
                </Text>
              </View>
            )}
          </View>

          {isOwner && (
            <View style={{ flexDirection: "row", gap: spacing.lg, marginTop: spacing.sm }}>
              <Pressable onPress={onFollowersPress}>
                <Text style={{ fontSize: fontSize.sm, color: colors.textMuted }}>
                  <Text style={{ fontWeight: "700", color: colors.text }}>{followersCount}</Text> followers
                </Text>
              </Pressable>
              <Pressable onPress={onFollowingPress}>
                <Text style={{ fontSize: fontSize.sm, color: colors.textMuted }}>
                  <Text style={{ fontWeight: "700", color: colors.text }}>{followingCount}</Text> following
                </Text>
              </Pressable>
            </View>
          )}

          {profile?.bio ? (
            <Text
              style={{
                fontSize: fontSize.sm,
                color: colors.text,
                lineHeight: 20,
                marginTop: spacing.sm,
              }}
            >
              {profile.bio}
            </Text>
          ) : isOwner ? (
            <Text
              style={{
                fontSize: fontSize.sm,
                color: colors.textMuted,
                fontStyle: "italic",
                marginTop: spacing.sm,
              }}
            >
              No bio yet
            </Text>
          ) : null}

          {profile?.socials && profile.socials.length > 0 && (
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: spacing.sm,
                marginTop: spacing.sm,
              }}
            >
              {profile.socials.map((s, i) => (
                <Pressable
                  key={i}
                  onPress={() => openSocialLink(s.platform, s.url)}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.xs,
                    backgroundColor: colors.surfaceRaised,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: radius.full,
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.xs,
                    opacity: pressed ? 0.8 : 1,
                  })}
                >
                  <SocialIcon platform={s.platform} size={16} />
                  <Text style={{ fontSize: fontSize.xs, fontWeight: "600", color: colors.text }}>
                    {getSocialLabel(s.platform)}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md }}>
        {isOwner && onShare && (
          <Pressable
            onPress={onShare}
            style={({ pressed }) => ({
              backgroundColor: colors.surfaceRaised,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.full,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.sm,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text style={{ fontSize: fontSize.sm, fontWeight: "600", color: colors.text }}>
              Share profile
            </Text>
          </Pressable>
        )}
        {isOwner && onStats && (
          <Pressable
            onPress={onStats}
            style={({ pressed }) => ({
              backgroundColor: colors.surfaceRaised,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.full,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.sm,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text style={{ fontSize: fontSize.sm, fontWeight: "600", color: colors.text }}>
              Statistics
            </Text>
          </Pressable>
        )}
        {isOwner && onEdit && (
          <Pressable
            onPress={onEdit}
            style={({ pressed }) => ({
              backgroundColor: colors.surfaceRaised,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.full,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.sm,
              opacity: pressed ? 0.9 : 1,
            })}
          >
            <Text style={{ fontSize: fontSize.sm, fontWeight: "600", color: colors.text }}>
              ✏️ Edit profile
            </Text>
          </Pressable>
        )}
        {isVisitor && (
          <>
            <Pressable
              onPress={onFollow}
              style={({ pressed }) => ({
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.sm,
                borderRadius: radius.full,
                backgroundColor: isFollowing ? colors.surfaceRaised : colors.accent,
                borderWidth: isFollowing ? 1 : 0,
                borderColor: colors.border,
                opacity: pressed ? 0.9 : 1,
              })}
            >
              <Text
                style={{
                  fontSize: fontSize.sm,
                  fontWeight: "700",
                  color: isFollowing ? colors.text : "#000",
                }}
              >
                {isFollowing ? "Following" : "Follow"}
              </Text>
            </Pressable>
            {UI_FEATURES.messages && onMessage && (
              <Pressable
                onPress={onMessage}
                style={({ pressed }) => ({
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.sm,
                  borderRadius: radius.full,
                  backgroundColor: colors.surfaceRaised,
                  borderWidth: 1,
                  borderColor: colors.border,
                  opacity: pressed ? 0.9 : 1,
                })}
              >
                <Text style={{ fontSize: fontSize.sm, fontWeight: "700", color: colors.text }}>
                  Message 🔒
                </Text>
              </Pressable>
            )}
          </>
        )}
      </View>
    </View>
  );
}
