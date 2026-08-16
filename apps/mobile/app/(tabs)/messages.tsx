import { useState, useCallback, useEffect } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme, spacing, radius, fontSize } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { dmsApi, usersApi, type Conversation } from "@/lib/api";
import { getOrCreateKeyPair } from "@/lib/crypto";

export default function MessagesTab() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [newHandle, setNewHandle] = useState("");
  const [creating, setCreating] = useState(false);

  const loadConversations = useCallback(async () => {
    try {
      const data = await dmsApi.getConversations();
      setConversations(data);
    } catch {}
    setLoading(false);
  }, []);

  // Upload public key on mount
  useEffect(() => {
    (async () => {
      try {
        const { publicKey, deviceId } = await getOrCreateKeyPair();
        await dmsApi.uploadKey(publicKey, deviceId);
      } catch {}
    })();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadConversations();
    }, [loadConversations]),
  );

  function getOtherHandle(conv: Conversation): string {
    if (!user) return conv.participantHandles[0] ?? "?";
    const idx = conv.participantIds.indexOf(user.id);
    return conv.participantHandles[idx === 0 ? 1 : 0] ?? "?";
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "now";
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
  }

  async function startConversation() {
    const handle = newHandle.trim().toLowerCase().replace(/^@/, "");
    if (!handle || handle.length < 3) {
      Alert.alert("", "Enter a valid handle");
      return;
    }
    setCreating(true);
    try {
      // Resolve handle to userId
      const profile = await usersApi.getProfile(handle);
      if (!profile?.id) throw new Error("User not found");
      if (profile.id === user?.id) throw new Error("Cannot message yourself");

      const conv = await dmsApi.createConversation(profile.id);
      setNewHandle("");
      await loadConversations();
      router.push(`/messages/${conv.id}` as any);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to start conversation");
    } finally {
      setCreating(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      {/* Header */}
      <View
        style={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: spacing.sm,
        }}
      >
        <Text style={{ fontSize: fontSize.xl, fontWeight: "700", color: colors.text, marginBottom: spacing.md }}>
          Messages 🔒
        </Text>

        {/* New conversation input */}
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <View
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: colors.surfaceRaised,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.lg,
              paddingHorizontal: spacing.md,
            }}
          >
            <Text style={{ fontSize: fontSize.base, color: colors.textMuted }}>@</Text>
            <TextInput
              value={newHandle}
              onChangeText={setNewHandle}
              placeholder="Start a conversation..."
              placeholderTextColor={colors.textMuted + "66"}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="go"
              onSubmitEditing={startConversation}
              style={{
                flex: 1,
                paddingVertical: spacing.md,
                paddingLeft: 4,
                fontSize: fontSize.base,
                color: colors.text,
              }}
            />
          </View>
          <Pressable
            onPress={startConversation}
            disabled={creating}
            style={({ pressed }) => ({
              backgroundColor: colors.accent,
              paddingHorizontal: spacing.lg,
              borderRadius: radius.lg,
              justifyContent: "center",
              opacity: creating ? 0.6 : pressed ? 0.9 : 1,
            })}
          >
            <Text style={{ fontSize: fontSize.sm, fontWeight: "700", color: "#000" }}>
              {creating ? "..." : "Go"}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Conversation list */}
      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}
        renderItem={({ item }) => {
          const otherHandle = getOtherHandle(item);
          return (
            <Pressable
              onPress={() => router.push(`/messages/${item.id}` as any)}
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
                gap: spacing.md,
              })}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: colors.accent + "33",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Text style={{ fontSize: 18, fontWeight: "700", color: colors.accent }}>
                  {otherHandle[0]?.toUpperCase() ?? "?"}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: fontSize.base, fontWeight: "600", color: colors.text }}>
                  @{otherHandle}
                </Text>
                <Text style={{ fontSize: fontSize.xs, color: colors.textMuted }}>
                  {timeAgo(item.lastMessageAt)}
                </Text>
              </View>
              <Text style={{ fontSize: fontSize.sm, color: colors.textMuted }}>→</Text>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          !loading ? (
            <View style={{ alignItems: "center", paddingTop: spacing["4xl"] }}>
              <Text style={{ fontSize: 40, marginBottom: spacing.md }}>🔒</Text>
              <Text style={{ fontSize: fontSize.base, color: colors.textMuted, textAlign: "center" }}>
                No conversations yet.{"\n"}Start one above!
              </Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}
