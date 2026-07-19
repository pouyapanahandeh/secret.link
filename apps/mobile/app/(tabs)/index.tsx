import { useState, useCallback, useMemo, useEffect } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useTheme, spacing, radius, fontSize } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { usersApi, secretsApi, type MapSecret } from "@/lib/api";
import { StoriesRow, type StoryUser } from "@/components/StoriesRow";
import { StoryViewerModal } from "@/components/StoryViewerModal";
import { StoryComposerModal } from "@/components/StoryComposerModal";
import { computeViewedHandles, getViewedStoryIds } from "@/lib/story-views";

export default function HomeTab() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();

  const [inbox, setInbox] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});
  const [following, setFollowing] = useState<StoryUser[]>([]);
  const [mapSecrets, setMapSecrets] = useState<MapSecret[]>([]);
  const [viewedStoryIds, setViewedStoryIds] = useState<Set<string>>(new Set());
  const [storyViewer, setStoryViewer] = useState<StoryUser | null>(null);
  const [showComposer, setShowComposer] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);

  const storyHandleSet = useMemo(
    () =>
      new Set(
        mapSecrets
          .map((m) => (m.handle ?? "").replace(/^@/, "").toLowerCase())
          .filter(Boolean),
      ),
    [mapSecrets],
  );

  const storyIdsByHandle = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const m of mapSecrets) {
      const h = (m.handle ?? "").replace(/^@/, "").toLowerCase();
      if (!h || !m.id) continue;
      (map[h] ??= []).push(m.id);
    }
    return map;
  }, [mapSecrets]);

  const viewedHandles = useMemo(
    () => computeViewedHandles(storyIdsByHandle, viewedStoryIds),
    [storyIdsByHandle, viewedStoryIds],
  );

  useEffect(() => {
    getViewedStoryIds().then(setViewedStoryIds);
  }, [storyIdsByHandle]);

  const loadHome = useCallback(async () => {
    if (!user) return;
    try {
      const [inboxData, followingData, secretsData] = await Promise.all([
        secretsApi.getInbox(user.handle),
        usersApi.getFollowing().catch(() => []),
        secretsApi.getMapSecrets().catch(() => []),
      ]);
      setInbox(inboxData);
      setFollowing(followingData);
      setMapSecrets(secretsData);
    } catch {}
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadHome();
    }, [loadHome]),
  );

  async function onRefresh() {
    setRefreshing(true);
    await loadHome();
    setRefreshing(false);
  }

  async function copyLink() {
    if (!user) return;
    await Clipboard.setStringAsync(`secretlink.life/@${user.handle}`);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function searchUsers(q: string) {
    setSearchQuery(q);
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      const results = await usersApi.search(q);
      setSearchResults(results);
      // Check follow status
      const map: Record<string, boolean> = {};
      await Promise.all(
        results.map(async (u) => {
          if (u.id === user?.id) return;
          try {
            const f = await usersApi.getFollowStatus(u.id);
            map[u.id] = f.isFollowing;
          } catch {}
        }),
      );
      setFollowingMap((prev) => ({ ...prev, ...map }));
    } catch {}
  }

  async function toggleFollow(targetId: string) {
    const isFollowing = followingMap[targetId];
    try {
      if (isFollowing) {
        await usersApi.unfollow(targetId);
      } else {
        await usersApi.follow(targetId);
      }
      setFollowingMap((prev) => ({ ...prev, [targetId]: !isFollowing }));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <FlatList
        data={searchQuery.length >= 2 ? searchResults : inbox}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        }
        contentContainerStyle={{ padding: spacing.lg }}
        ListHeaderComponent={
          <View style={{ marginBottom: spacing.lg }}>
            {/* Profile Card */}
            <View
              style={{
                backgroundColor: colors.surfaceRaised,
                borderRadius: radius.xl,
                borderWidth: 1,
                borderColor: colors.border,
                padding: spacing.lg,
                marginBottom: spacing.lg,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: colors.accent + "33",
                    borderWidth: 2,
                    borderColor: colors.accent,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <Text style={{ fontSize: 20, fontWeight: "700", color: colors.accent }}>
                    {user?.handle?.[0]?.toUpperCase() ?? "?"}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: fontSize.lg, fontWeight: "700", color: colors.text }}>
                    @{user?.handle}
                  </Text>
                  {user?.email && (
                    <Text style={{ fontSize: fontSize.xs, color: colors.textMuted }}>
                      {user.email}
                    </Text>
                  )}
                </View>
              </View>

              {/* Copy link */}
              <Pressable
                onPress={copyLink}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: radius.md,
                  paddingVertical: spacing.sm,
                  paddingHorizontal: spacing.md,
                  marginTop: spacing.md,
                  gap: spacing.sm,
                }}
              >
                <Text style={{ fontSize: fontSize.sm, color: colors.textMuted }}>
                  {copied ? "✓ Copied!" : `secretlink.life/@${user?.handle}`}
                </Text>
              </Pressable>
            </View>

            {/* Stories — people you follow */}
            <StoriesRow
              users={following}
              storyHandles={storyHandleSet}
              viewedHandles={viewedHandles}
              onSelect={(u, hasStory) => {
                if (hasStory) setStoryViewer(u);
              }}
            />

            {/* Search */}
            <TextInput
              value={searchQuery}
              onChangeText={searchUsers}
              placeholder="🔍 Search users..."
              placeholderTextColor={colors.textMuted + "66"}
              autoCapitalize="none"
              autoCorrect={false}
              style={{
                backgroundColor: colors.surfaceRaised,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius.lg,
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.md,
                fontSize: fontSize.base,
                color: colors.text,
                marginBottom: spacing.md,
              }}
            />

            {/* Section label */}
            {searchQuery.length < 2 && (
              <Text
                style={{
                  fontSize: fontSize.sm,
                  fontWeight: "600",
                  color: colors.textMuted,
                  marginBottom: spacing.sm,
                }}
              >
                📥 Inbox {inbox.length > 0 ? `(${inbox.length})` : ""}
              </Text>
            )}
          </View>
        }
        renderItem={({ item }) => {
          // Search result
          if (searchQuery.length >= 2) {
            const isOwn = item.id === user?.id;
            return (
              <Pressable
                onPress={() => router.push(`/user/${item.handle}` as any)}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: colors.surfaceRaised,
                  borderRadius: radius.lg,
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: spacing.md,
                  marginBottom: spacing.sm,
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: colors.accent + "33",
                    justifyContent: "center",
                    alignItems: "center",
                    marginRight: spacing.md,
                  }}
                >
                  <Text style={{ fontSize: 16, fontWeight: "700", color: colors.accent }}>
                    {item.handle?.[0]?.toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: fontSize.base, fontWeight: "600", color: colors.text }}>
                    @{item.handle}
                  </Text>
                  {item.bio && (
                    <Text
                      style={{ fontSize: fontSize.xs, color: colors.textMuted }}
                      numberOfLines={1}
                    >
                      {item.bio}
                    </Text>
                  )}
                </View>
                {!isOwn && (
                  <View style={{ flexDirection: "row", gap: spacing.sm }}>
                    <Pressable
                      onPress={() => router.push(`/secret/send?handle=${item.handle}` as any)}
                      style={{
                        paddingHorizontal: spacing.md,
                        paddingVertical: spacing.sm,
                        borderRadius: radius.full,
                        backgroundColor: colors.accent,
                      }}
                    >
                      <Text style={{ fontSize: fontSize.xs, fontWeight: "600", color: "#000" }}>
                        Send ✨
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => toggleFollow(item.id)}
                      style={{
                        paddingHorizontal: spacing.md,
                        paddingVertical: spacing.sm,
                        borderRadius: radius.full,
                        backgroundColor: followingMap[item.id]
                          ? colors.surfaceRaised
                          : colors.border,
                        borderWidth: followingMap[item.id] ? 1 : 0,
                        borderColor: colors.border,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: fontSize.xs,
                          fontWeight: "600",
                          color: followingMap[item.id] ? colors.textMuted : colors.text,
                        }}
                      >
                        {followingMap[item.id] ? "Following" : "Follow"}
                      </Text>
                    </Pressable>
                  </View>
                )}
              </Pressable>
            );
          }

          // Inbox item
          const isNew = item.view_count === 0 && !item.burned;
          return (
            <Pressable
              onPress={() => {
                if (item.burned) return;
                router.push(`/secret/${item.id}` as any);
              }}
              disabled={!!item.burned}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: colors.surfaceRaised,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: isNew ? colors.accent + "40" : colors.border,
                padding: spacing.md,
                marginBottom: spacing.sm,
                opacity: item.burned ? 0.5 : pressed ? 0.8 : 1,
              })}
            >
              <Text style={{ fontSize: 20, marginRight: spacing.md }}>
                {item.burned ? "🔥" : isNew ? "✨" : "👁"}
              </Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: fontSize.sm, fontWeight: "600", color: colors.text }}>
                  {item.content_type === "text" ? "Text secret" : "Media secret"}
                </Text>
                <Text style={{ fontSize: fontSize.xs, color: colors.textMuted }}>
                  {timeAgo(item.created_at)} ·{" "}
                  {item.burned
                    ? "Burned"
                    : `${item.view_count}/${item.max_views} views`}
                </Text>
              </View>
              {isNew && (
                <View
                  style={{
                    backgroundColor: colors.accent,
                    paddingHorizontal: spacing.sm,
                    paddingVertical: 2,
                    borderRadius: radius.full,
                  }}
                >
                  <Text style={{ fontSize: fontSize.xs, fontWeight: "700", color: "#000" }}>
                    New
                  </Text>
                </View>
              )}
            </Pressable>
          );
        }}
        ListEmptyComponent={
          searchQuery.length < 2 ? (
            <View style={{ alignItems: "center", paddingTop: spacing["4xl"] }}>
              <Text style={{ fontSize: 40, marginBottom: spacing.md }}>📭</Text>
              <Text style={{ fontSize: fontSize.base, color: colors.textMuted, textAlign: "center" }}>
                No secrets yet.{"\n"}Share your link to receive some!
              </Text>
            </View>
          ) : null
        }
      />

      <Pressable
        onPress={() => setShowComposer(true)}
        style={{
          position: "absolute",
          right: spacing.lg,
          bottom: spacing.xl,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: colors.accent,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Text style={{ fontSize: 28, color: "#000", lineHeight: 32 }}>+</Text>
      </Pressable>

      <StoryComposerModal
        visible={showComposer}
        handle={user?.handle}
        onClose={() => setShowComposer(false)}
        onPosted={loadHome}
      />

      {storyViewer && (
        <StoryViewerModal
          visible
          handle={storyViewer.handle}
          avatarUrl={storyViewer.avatarUrl}
          onClose={() => setStoryViewer(null)}
          onViewed={(id) => setViewedStoryIds((prev) => (prev.has(id) ? prev : new Set(prev).add(id)))}
        />
      )}
    </SafeAreaView>
  );
}
