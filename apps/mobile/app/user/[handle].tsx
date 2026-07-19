import { useState, useEffect, useCallback } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import type { PublicProfile } from "@secretlink/core/profile-types";
import { resolveProfileViewMode } from "@secretlink/core/profile-types";
import { useTheme, spacing, fontSize } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { usersApi, dmsApi } from "@/lib/api";
import { UI_FEATURES } from "@/lib/feature-flags";
import { ProfileView } from "@/components/ProfileView";
import { ProfileSecretForm } from "@/components/ProfileSecretForm";
import { ProfileShareModal } from "@/components/ProfileShareModal";
import { ProfileStatsDrawer } from "@/components/ProfileStatsDrawer";

export default function UserProfileScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { handle, src } = useLocalSearchParams<{ handle: string; src?: string }>();
  const { user } = useAuth();

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [shareOpen, setShareOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);

  const isOwnProfile = user?.handle?.toLowerCase() === handle?.toLowerCase();
  const isLoggedIn = !!user;
  const mode = resolveProfileViewMode(isLoggedIn, isOwnProfile);

  const loadProfile = useCallback(async () => {
    if (!handle) return;
    setLoading(true);
    setError("");
    try {
      const data = await usersApi.getProfile(handle);
      setProfile(data);
      if (isOwnProfile) {
        setFollowersCount(data.followersCount ?? user?.followersCount ?? 0);
        setFollowingCount(data.followingCount ?? user?.followingCount ?? 0);
      } else if (user) {
        try {
          const status = await usersApi.getFollowStatus(data.id);
          setIsFollowing(status.isFollowing);
          setFollowersCount(status.followersCount);
        } catch {
          /* follow status unavailable */
        }
      }
    } catch {
      setError("User not found");
    } finally {
      setLoading(false);
    }
  }, [handle, user, isOwnProfile]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (src !== "qr" || isOwnProfile || !handle) return;
    usersApi.trackQrScan(handle).catch(() => {});
  }, [src, isOwnProfile, handle]);

  async function toggleFollow() {
    if (!profile) return;
    if (!user) {
      router.push("/login" as any);
      return;
    }
    try {
      if (isFollowing) {
        const res = await usersApi.unfollow(profile.id);
        setIsFollowing(false);
        setFollowersCount(res.followersCount);
      } else {
        const res = await usersApi.follow(profile.id);
        setIsFollowing(true);
        setFollowersCount(res.followersCount);
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      Alert.alert("Error", "Could not update follow status");
    }
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
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            paddingHorizontal: spacing["3xl"],
          }}
        >
          <Text style={{ fontSize: 48, marginBottom: spacing.lg }}>👻</Text>
          <Text
            style={{
              fontSize: fontSize.xl,
              fontWeight: "700",
              color: colors.text,
              textAlign: "center",
            }}
          >
            {error || "User not found"}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing["4xl"] }}>
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

        <ProfileView
          profile={profile}
          handle={handle!}
          mode={mode}
          followersCount={followersCount}
          followingCount={followingCount}
          isFollowing={isFollowing}
          onFollow={toggleFollow}
          onShare={isOwnProfile ? () => setShareOpen(true) : undefined}
          onStats={isOwnProfile ? () => setStatsOpen(true) : undefined}
          onEdit={isOwnProfile ? () => router.push("/(tabs)/profile" as any) : undefined}
          onMessage={
            UI_FEATURES.messages
              ? async () => {
                  try {
                    const conv = await dmsApi.createConversation(profile.id);
                    router.push(`/messages/${conv.id}` as any);
                  } catch (e: any) {
                    Alert.alert("Error", e?.message ?? "Failed to start conversation");
                  }
                }
              : undefined
          }
        />

        {!isOwnProfile && (
          <ProfileSecretForm
            recipientHandle={profile.handle}
            recipientPublicKey={profile.dmPublicKey}
          />
        )}
      </ScrollView>

      {isOwnProfile && handle && (
        <ProfileShareModal
          handle={handle}
          visible={shareOpen}
          onClose={() => setShareOpen(false)}
        />
      )}
      {isOwnProfile && (
        <ProfileStatsDrawer visible={statsOpen} onClose={() => setStatsOpen(false)} />
      )}
    </SafeAreaView>
  );
}
