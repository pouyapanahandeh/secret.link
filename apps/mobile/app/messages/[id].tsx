import { useState, useEffect, useRef, useCallback } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useTheme, spacing, radius, fontSize } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { dmsApi, type DmMessage } from "@/lib/api";
import { getOrCreateKeyPair, encryptMessage, decryptMessage } from "@/lib/crypto";

const API_BASE = "https://secretlink.life";

type DecryptedMessage = DmMessage & { plaintext: string | null };

const TTL_OPTIONS = [
  { label: "5m", value: 5 },
  { label: "30m", value: 30 },
  { label: "1h", value: 60 },
  { label: "24h", value: 1440 },
];

export default function ConversationScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { id: conversationId } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();

  const [messages, setMessages] = useState<DecryptedMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [otherHandle, setOtherHandle] = useState("");
  const [otherId, setOtherId] = useState("");
  const [theirPublicKey, setTheirPublicKey] = useState<string | null>(null);
  const [myPrivateKey, setMyPrivateKey] = useState<Uint8Array | null>(null);
  const [ttlIdx, setTtlIdx] = useState(0); // 5m default
  const [typing, setTyping] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastFetchRef = useRef<string | null>(null);

  // ─── Init: load conversation info, keys, and messages ────────────────────

  useEffect(() => {
    if (!conversationId || !user) return;

    (async () => {
      try {
        // Get my keypair
        const { privateKey } = await getOrCreateKeyPair();
        setMyPrivateKey(privateKey);

        // Get conversation to find other participant
        const convos = await dmsApi.getConversations();
        const conv = convos.find((c) => c.id === conversationId);
        if (!conv) {
          Alert.alert("Error", "Conversation not found");
          router.back();
          return;
        }

        const idx = conv.participantIds.indexOf(user.id);
        const otherIdx = idx === 0 ? 1 : 0;
        const handle = conv.participantHandles[otherIdx] ?? "?";
        const participantId = conv.participantIds[otherIdx] ?? "";
        setOtherHandle(handle);
        setOtherId(participantId);

        // Get their public key for encryption
        try {
          const { publicKey } = await dmsApi.getKey(participantId);
          setTheirPublicKey(publicKey);
        } catch {
          // They haven't set up encryption keys yet
        }

        // Load messages
        await loadMessages(privateKey, null);
      } catch (e: any) {
        Alert.alert("Error", e?.message ?? "Failed to load");
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [conversationId, user]);

  // ─── Polling for new messages ─────────────────────────────────────────────

  useEffect(() => {
    if (!conversationId || !myPrivateKey || !theirPublicKey) return;

    pollRef.current = setInterval(async () => {
      if (lastFetchRef.current) {
        try {
          const newer = await dmsApi.getMessages(conversationId, { since: lastFetchRef.current, limit: 50 });
          if (newer.length > 0) {
            const decrypted = newer.map((m) => ({
              ...m,
              plaintext: decryptMessage(m.encryptedContent, m.nonce, myPrivateKey, theirPublicKey),
            }));
            setMessages((prev) => {
              const ids = new Set(prev.map((p) => p.id));
              const newOnes = decrypted.filter((d) => !ids.has(d.id));
              return [...prev, ...newOnes];
            });
            lastFetchRef.current = newer[newer.length - 1]!.createdAt;
          }
        } catch {}
      }
    }, 3000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [conversationId, myPrivateKey, theirPublicKey]);

  // ─── Load messages ────────────────────────────────────────────────────────

  async function loadMessages(privKey: Uint8Array, theirKey: string | null) {
    if (!conversationId) return;
    try {
      const raw = await dmsApi.getMessages(conversationId, { limit: 50 });
      // Try to get their key if not passed
      let pubKey = theirKey ?? theirPublicKey;
      if (!pubKey && otherId) {
        try {
          const { publicKey } = await dmsApi.getKey(otherId);
          pubKey = publicKey;
          setTheirPublicKey(publicKey);
        } catch {}
      }

      const decrypted: DecryptedMessage[] = raw.map((m) => ({
        ...m,
        plaintext: pubKey ? decryptMessage(m.encryptedContent, m.nonce, privKey, pubKey) : null,
      }));

      setMessages(decrypted);
      if (raw.length > 0) {
        lastFetchRef.current = raw[raw.length - 1]!.createdAt;
      }
    } catch {}
  }

  // ─── Send message ─────────────────────────────────────────────────────────

  async function handleSend() {
    const text = inputText.trim();
    if (!text || !conversationId || !myPrivateKey || !theirPublicKey) return;

    setSending(true);
    try {
      const { encryptedContent, nonce } = encryptMessage(text, myPrivateKey, theirPublicKey);
      const msg = await dmsApi.sendMessage(conversationId, {
        encryptedContent,
        nonce,
        ttlMinutes: TTL_OPTIONS[ttlIdx]!.value,
      });

      // Optimistically add
      setMessages((prev) => [...prev, { ...msg, plaintext: text }]);
      setInputText("");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      // Scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to send");
    } finally {
      setSending(false);
    }
  }

  // ─── Delete message ───────────────────────────────────────────────────────

  function handleLongPress(msg: DecryptedMessage) {
    if (msg.senderId !== user?.id) return;
    Alert.alert("Delete message?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await dmsApi.deleteMessage(conversationId!, msg.id);
            setMessages((prev) => prev.filter((m) => m.id !== msg.id));
          } catch {}
        },
      },
    ]);
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
        keyboardVerticalOffset={0}
      >
        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            gap: spacing.md,
          }}
        >
          <Pressable onPress={() => router.back()}>
            <Text style={{ fontSize: fontSize.lg, color: colors.textMuted }}>←</Text>
          </Pressable>
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: colors.accent + "33",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: "700", color: colors.accent }}>
              {otherHandle[0]?.toUpperCase() ?? "?"}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: fontSize.base, fontWeight: "700", color: colors.text }}>
              @{otherHandle}
            </Text>
            <Text style={{ fontSize: fontSize.xs, color: colors.textMuted }}>
              🔒 End-to-end encrypted
            </Text>
          </View>
        </View>

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={{ alignItems: "center", paddingTop: spacing["4xl"] }}>
              <Text style={{ fontSize: 32, marginBottom: spacing.md }}>🔒</Text>
              <Text style={{ fontSize: fontSize.sm, color: colors.textMuted, textAlign: "center" }}>
                Messages are end-to-end encrypted.{"\n"}Send the first message!
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const isMine = item.senderId === user?.id;
            const displayText = item.plaintext ?? "🔒 Unable to decrypt";
            const isExpired = new Date(item.expiresAt) < new Date();

            if (isExpired) return null;

            return (
              <Pressable
                onLongPress={() => handleLongPress(item)}
                style={{
                  alignSelf: isMine ? "flex-end" : "flex-start",
                  maxWidth: "80%",
                  marginBottom: spacing.sm,
                }}
              >
                <View
                  style={{
                    backgroundColor: isMine ? colors.accent : colors.surfaceRaised,
                    borderRadius: radius.lg,
                    borderTopRightRadius: isMine ? 4 : radius.lg,
                    borderTopLeftRadius: isMine ? radius.lg : 4,
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.sm,
                    borderWidth: isMine ? 0 : 1,
                    borderColor: colors.border,
                  }}
                >
                  <Text
                    style={{
                      fontSize: fontSize.base,
                      color: isMine ? "#000" : colors.text,
                      lineHeight: 20,
                    }}
                  >
                    {displayText}
                  </Text>
                  <Text
                    style={{
                      fontSize: 10,
                      color: isMine ? "#00000066" : colors.textMuted,
                      marginTop: 4,
                      textAlign: "right",
                    }}
                  >
                    {new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    {item.readAt && isMine ? " ✓" : ""}
                  </Text>
                </View>
              </Pressable>
            );
          }}
        />

        {/* Input area */}
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: colors.border,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            backgroundColor: colors.surface,
          }}
        >
          {/* TTL selector */}
          <View style={{ flexDirection: "row", gap: spacing.xs, marginBottom: spacing.sm, paddingHorizontal: spacing.xs }}>
            <Text style={{ fontSize: fontSize.xs, color: colors.textMuted, alignSelf: "center", marginRight: spacing.xs }}>
              ⏱
            </Text>
            {TTL_OPTIONS.map((opt, i) => (
              <Pressable
                key={opt.value}
                onPress={() => setTtlIdx(i)}
                style={{
                  paddingHorizontal: spacing.sm,
                  paddingVertical: 2,
                  borderRadius: radius.full,
                  backgroundColor: ttlIdx === i ? colors.accent + "33" : "transparent",
                }}
              >
                <Text style={{ fontSize: fontSize.xs, color: ttlIdx === i ? colors.accent : colors.textMuted, fontWeight: ttlIdx === i ? "600" : "400" }}>
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "flex-end" }}>
            <TextInput
              value={inputText}
              onChangeText={setInputText}
              placeholder={theirPublicKey ? "Type a message..." : "🔒 Waiting for key..."}
              placeholderTextColor={colors.textMuted + "66"}
              editable={!!theirPublicKey}
              multiline
              maxLength={5000}
              style={{
                flex: 1,
                backgroundColor: colors.surfaceRaised,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius.lg,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                fontSize: fontSize.base,
                color: colors.text,
                maxHeight: 100,
              }}
            />
            <Pressable
              onPress={handleSend}
              disabled={sending || !inputText.trim() || !theirPublicKey}
              style={({ pressed }) => ({
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: inputText.trim() && theirPublicKey ? colors.accent : colors.surfaceRaised,
                justifyContent: "center",
                alignItems: "center",
                opacity: sending ? 0.5 : pressed ? 0.8 : 1,
              })}
            >
              <Text style={{ fontSize: 18 }}>↑</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
