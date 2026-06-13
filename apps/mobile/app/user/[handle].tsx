import { useState, useEffect, useCallback } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Linking,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useTheme, spacing, radius, fontSize } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { usersApi, dmsApi } from "@/lib/api";

const SOCIAL_ICONS: Record<string, string> = {
  instagram: "📷",
  twitter: "𝕏",
  tiktok: "🎵",
  youtube: "▶️",
  github: "🐙",
  linkedin: "💼",
  snapchat: "👻",
  telegram: "✈️",
  website: "🌐",
};

type Profile = {
  id: string;
  handle: string;
  bio?: string;
  socials?: { platform: string; url: string }[];
  followersCount: number;
  followingCount: number;
};

export default function UserProfileScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const { user } = useAuth();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);

  const isOwnProfile = user?.handle?.toLowerCase() === handle?.toLowerCase();

  const loadProfile = useCallback(async () => {
    if (!handle) return;
    setLoading(true);
    try {
      const data = await usersApi.getProfile(handle);
      setProfile(data);
      setFollowersCount(data.followersCount);

      // Check follow status
      if (user && !isOwnProfile) {
        try {
          const status = await usersApi.getFollowStatus(data.id);
          setIsFollowing(status.isFollowing);
        } catch {}
      }
    } catch (e: any) {
      setError("User not found");
    } finally {
      setLoading(false);
    }
  }, [handle, user, isOwnProfile]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  async function toggleFollow() {
    if (!profile) return;
    try {
      if (isFollowing) {
        await usersApi.unfollow(profile.id);
        setIsFollowing(false);
        setFollowersCount((c) => c - 1);
      } else {
        await usersApi.follow(profile.id);
        setIsFollowing(true);
        setFollowersCount((c) => c + 1);
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
  }

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !profile) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
          <Pressable onPress={() => router.back()}>
            <Text style={{ fontSize: fontSize.lg, color: colors.textMuted }}>← Back</Text>
          </Pressable>
        </View>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: spacing["3xl"] }}>
          <Text style={{ fontSize: 48, marginBottom: spacing.lg }}>👻</Text>
          <Text style={{ fontSize: fontSize.xl, fontWeight: "700", color: colors.text, textAlign: "center" }}>
            {error || "User not found"}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing["4xl"] }}>
        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
          }}
        >
          <Pressable onPress={() => router.back()}>
            <Text style={{ fontSize: fontSize.lg, color: colors.textMuted }}>← Back</Text>
          </Pressable>
        </View>

        {/* Profile card */}
        <View style={{ alignItems: "center", paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
          {/* Avatar */}
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: colors.accent + "33",
              borderWidth: 3,
              borderColor: colors.accent,
              justifyContent: "center",
              alignItems: "center",
              marginBottom: spacing.md,
            }}
          >
            <Text style={{ fontSize: 32, fontWeight: "700", color: colors.accent }}>
              {profile.handle[0]?.toUpperCase() ?? "?"}
            </Text>
          </View>

          {/* Handle */}
          <Text style={{ fontSize: fontSize["2xl"], fontWeight: "800", color: colors.text, marginBottom: spacing.sm }}>
            @{profile.handle}
          </Text>

          {/* Stats */}
          <View style={{ flexDirection: "row", gap: spacing.xl, marginBottom: spacing.lg }}>
            <Text style={{ fontSize: fontSize.sm, color: colors.textMuted }}>
              <Text style={{ fontWeight: "700", color: colors.text }}>{followersCount}</Text> followers
            </Text>
            <Text style={{ fontSize: fontSize.sm, color: colors.textMuted }}>
              <Text style={{ fontWeight: "700", color: colors.text }}>{profile.followingCount}</Text> following
            </Text>
          </View>

          {/* Action buttons */}
          {!isOwnProfile && (
            <View style={{ gap: spacing.sm, marginBottom: spacing.xl, width: "100%" }}>
              <View style={{ flexDirection: "row", gap: spacing.md }}>
                <Pressable
                  onPress={toggleFollow}
                  style={({ pressed }) => ({
                    flex: 1,
                    paddingVertical: spacing.md,
                    borderRadius: radius.full,
                    alignItems: "center",
                    backgroundColor: isFollowing ? colors.surfaceRaised : colors.accent,
                    borderWidth: isFollowing ? 1 : 0,
                    borderColor: colors.border,
                    opacity: pressed ? 0.9 : 1,
                  })}
                >
                  <Text
                    style={{
                      fontSize: fontSize.base,
                      fontWeight: "700",
                      color: isFollowing ? colors.text : "#000",
                    }}
                  >
                    {isFollowing ? "Following" : "Follow"}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => router.push(`/secret/send?handle=${profile.handle}` as any)}
                  style={({ pressed }) => ({
                    flex: 1,
                    paddingVertical: spacing.md,
                    borderRadius: radius.full,
                    alignItems: "center",
                    backgroundColor: colors.surfaceRaised,
                    borderWidth: 1,
                    borderColor: colors.border,
                    opacity: pressed ? 0.9 : 1,
                  })}
                >
                  <Text style={{ fontSize: fontSize.base, fontWeight: "700", color: colors.text }}>
                    Secret ✨
                  </Text>
                </Pressable>
              </View>
              <Pressable
                onPress={async () => {
                  try {
                    const conv = await dmsApi.createConversation(profile.id);
                    router.push(`/messages/${conv.id}` as any);
                  } catch (e: any) {
                    Alert.alert("Error", e?.message ?? "Failed to start conversation");
                  }
                }}
                style={({ pressed }) => ({
                  paddingVertical: spacing.md,
                  borderRadius: radius.full,
                  alignItems: "center",
                  backgroundColor: colors.surfaceRaised,
                  borderWidth: 1,
                  borderColor: colors.border,
                  opacity: pressed ? 0.9 : 1,
                })}
              >
                <Text style={{ fontSize: fontSize.base, fontWeight: "700", color: colors.text }}>
                  Message 🔒
                </Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Bio */}
        {profile.bio && (
          <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.xl }}>
            <Text
              style={{
                fontSize: fontSize.base,
                color: colors.text,
                lineHeight: 22,
                textAlign: "center",
              }}
            >
              {profile.bio}
            </Text>
          </View>
        )}

        {/* Social links */}
        {profile.socials && profile.socials.length > 0 && (
          <View style={{ paddingHorizontal: spacing.lg }}>
            <Text
              style={{
                fontSize: fontSize.sm,
                fontWeight: "600",
                color: colors.textMuted,
                marginBottom: spacing.md,
              }}
            >
              Links
            </Text>
            {profile.socials.map((s, i) => (
              <Pressable
                key={i}
                onPress={() => {
                  const url = s.url.startsWith("http") ? s.url : `https://${s.url}`;
                  Linking.openURL(url);
                }}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: colors.surfaceRaised,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: radius.lg,
                  padding: spacing.md,
                  marginBottom: spacing.sm,
                  opacity: pressed ? 0.8 : 1,
                  gap: spacing.md,
                })}
              >
                <Text style={{ fontSize: 18 }}>{SOCIAL_ICONS[s.platform] ?? "🔗"}</Text>
                <Text
                  style={{ fontSize: fontSize.sm, color: colors.accent, flex: 1 }}
                  numberOfLines={1}
                >
                  {s.url}
                </Text>
                <Text style={{ fontSize: fontSize.sm, color: colors.textMuted }}>↗</Text>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
