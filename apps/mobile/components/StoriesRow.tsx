import { View, Text, ScrollView, Pressable, Image } from "react-native";
import { useTheme, spacing, fontSize } from "@/lib/theme";

export type StoryUser = {
  id: string;
  handle: string;
  avatarUrl?: string | null;
};

interface StoriesRowProps {
  users: StoryUser[];
  storyHandles: Set<string>;
  viewedHandles?: Set<string>;
  onSelect: (user: StoryUser, hasStory: boolean) => void;
}

function AvatarRing({
  handle,
  avatarUrl,
  hasStory,
  viewed,
}: {
  handle: string;
  avatarUrl?: string | null;
  hasStory: boolean;
  viewed: boolean;
}) {
  const { colors } = useTheme();
  const ringColor = hasStory ? (viewed ? colors.border : colors.accent) : "transparent";
  const ringWidth = hasStory ? 2 : 0;

  return (
    <View
      style={{
        width: 60,
        height: 60,
        borderRadius: 30,
        borderWidth: ringWidth,
        borderColor: ringColor,
        padding: 2,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: 26,
          backgroundColor: colors.accent + "33",
          borderWidth: 1,
          borderColor: colors.accent + "66",
          justifyContent: "center",
          alignItems: "center",
          overflow: "hidden",
        }}
      >
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={{ width: 52, height: 52 }} />
        ) : (
          <Text style={{ fontSize: fontSize.lg, fontWeight: "700", color: colors.accent }}>
            {handle[0]?.toUpperCase() ?? "?"}
          </Text>
        )}
      </View>
    </View>
  );
}

export function StoriesRow({ users, storyHandles, viewedHandles, onSelect }: StoriesRowProps) {
  const { colors } = useTheme();
  if (users.length === 0) return null;

  const viewed = viewedHandles ?? new Set<string>();

  function rank(handle: string): number {
    const h = handle.toLowerCase();
    if (storyHandles.has(h)) return viewed.has(h) ? 1 : 0;
    return 2;
  }

  const sorted = [...users].sort((a, b) => rank(a.handle) - rank(b.handle));

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.sm }}
      style={{ marginBottom: spacing.md }}
    >
      {sorted.map((u) => {
        const h = u.handle.toLowerCase();
        const hasStory = storyHandles.has(h);
        const isViewed = hasStory && viewed.has(h);
        return (
          <Pressable key={u.id} onPress={() => onSelect(u, hasStory)} style={{ alignItems: "center", width: 68 }}>
            <AvatarRing handle={u.handle} avatarUrl={u.avatarUrl} hasStory={hasStory} viewed={isViewed} />
            <Text style={{ fontSize: 10, color: colors.textMuted, marginTop: spacing.xs }} numberOfLines={1}>
              @{u.handle}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
