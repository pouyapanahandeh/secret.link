import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  Image,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { useTheme, spacing, fontSize } from "@/lib/theme";
import { secretsApi, type MapSecret } from "@/lib/api";
import { decryptMapReveal } from "@/lib/secret-crypto";
import { markStoryViewed } from "@/lib/story-views";

const STORY_DURATION_MS = 6000;
const API_BASE = "https://secretlink.life";

type RevealedStory = MapSecret & { message: string };

interface StoryViewerModalProps {
  visible: boolean;
  handle: string;
  avatarUrl?: string | null;
  onClose: () => void;
  onViewed?: (storyId: string) => void;
}

export function StoryViewerModal({ visible, handle, avatarUrl, onClose, onViewed }: StoryViewerModalProps) {
  const { colors } = useTheme();
  const cleanHandle = handle.replace(/^@/, "");
  const [stories, setStories] = useState<MapSecret[] | null>(null);
  const [revealedCache, setRevealedCache] = useState<Record<string, RevealedStory>>({});
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [mediaLoaded, setMediaLoaded] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef(0);
  const screenWidth = Dimensions.get("window").width;

  useEffect(() => {
    if (!visible) {
      setStories(null);
      setIndex(0);
      setProgress(0);
      setRevealedCache({});
      return;
    }
    let cancelled = false;
    secretsApi
      .getMapSecretsByHandle(cleanHandle)
      .then((data) => {
        if (!cancelled) setStories(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setStories([]);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, cleanHandle]);

  const revealStory = useCallback(async (story: MapSecret) => {
    setRevealedCache((prev) => {
      if (prev[story.id]) return prev;
      void (async () => {
        try {
          const data = await secretsApi.revealMapSecret(story.id);
          const message = decryptMapReveal(data);
          setRevealedCache((cache) =>
            cache[story.id] ? cache : { ...cache, [story.id]: { ...data, message } as RevealedStory },
          );
        } catch {
          /* ignore */
        }
      })();
      return prev;
    });
  }, []);

  useEffect(() => {
    if (!stories || stories.length === 0) return;
    const current = stories[index];
    if (current) revealStory(current);
  }, [stories, index, revealStory]);

  useEffect(() => {
    if (!stories) return;
    const next = stories[index + 1];
    if (next) revealStory(next);
  }, [stories, index, revealStory]);

  const advance = useCallback(() => {
    setIndex((i) => {
      const total = stories?.length ?? 0;
      if (i + 1 >= total) {
        onClose();
        return i;
      }
      return i + 1;
    });
    setProgress(0);
    elapsedRef.current = 0;
  }, [stories, onClose]);

  const currentMeta = stories?.[index] ?? null;
  const current = currentMeta ? (revealedCache[currentMeta.id] ?? null) : null;
  const curMediaPath = current?.mediaPath ?? null;
  const curMediaType = current?.mediaType ?? "";
  const curHasMedia = !!curMediaPath && (curMediaType.startsWith("image/") || curMediaType.startsWith("video/"));
  const mediaReady = !curHasMedia || mediaLoaded;
  const contentReady = !!current;

  useEffect(() => {
    setMediaLoaded(false);
  }, [index]);

  useEffect(() => {
    if (!visible || !stories || stories.length === 0) return;
    const s = stories[index];
    if (s?.id) {
      markStoryViewed(s.id).then(() => onViewed?.(s.id));
    }
  }, [visible, stories, index, onViewed]);

  useEffect(() => {
    if (!visible || !stories || stories.length === 0 || paused || !mediaReady || !contentReady) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const start = Date.now() - elapsedRef.current;
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - start;
      elapsedRef.current = elapsed;
      const pct = Math.min(elapsed / STORY_DURATION_MS, 1);
      setProgress(pct);
      if (pct >= 1) {
        if (timerRef.current) clearInterval(timerRef.current);
        advance();
      }
    }, 50);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [visible, stories, index, paused, mediaReady, contentReady, advance]);

  function goPrev() {
    setIndex((i) => Math.max(0, i - 1));
    setProgress(0);
    elapsedRef.current = 0;
  }

  function handleTap(x: number) {
    if (x < screenWidth * 0.33) goPrev();
    else advance();
  }

  if (!visible) return null;

  return (
    <Modal visible animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        {stories === null ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : stories.length === 0 ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: spacing.lg }}>
            <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: fontSize.sm }}>
              @{cleanHandle} has no active stories.
            </Text>
            <Pressable onPress={onClose}>
              <Text style={{ color: "#fff", textDecorationLine: "underline" }}>Close</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={{ flexDirection: "row", gap: 4, paddingHorizontal: spacing.md, paddingTop: spacing.xl }}>
              {stories.map((s, i) => (
                <View key={s.id} style={{ flex: 1, height: 2, backgroundColor: "rgba(255,255,255,0.3)", borderRadius: 1, overflow: "hidden" }}>
                  <View
                    style={{
                      height: "100%",
                      backgroundColor: "#fff",
                      width: `${i < index ? 100 : i === index ? progress * 100 : 0}%`,
                    }}
                  />
                </View>
              ))}
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.md }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, flex: 1 }}>
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: colors.accent + "33",
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.4)",
                    justifyContent: "center",
                    alignItems: "center",
                    overflow: "hidden",
                  }}
                >
                  {avatarUrl ? (
                    <Image source={{ uri: avatarUrl }} style={{ width: 32, height: 32 }} />
                  ) : (
                    <Text style={{ color: "#fff", fontSize: fontSize.xs, fontWeight: "700" }}>
                      {cleanHandle[0]?.toUpperCase()}
                    </Text>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: "#fff", fontSize: fontSize.sm, fontWeight: "600" }}>@{cleanHandle}</Text>
                  {(currentMeta?.locationName || currentMeta?.cityName) && (
                    <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 11 }} numberOfLines={1}>
                      📍 {currentMeta?.locationName || currentMeta?.cityName}
                    </Text>
                  )}
                </View>
              </View>
              <Pressable onPress={onClose} hitSlop={12}>
                <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 28 }}>×</Text>
              </Pressable>
            </View>

            <Pressable
              style={{ flex: 1, justifyContent: "center", paddingHorizontal: spacing.lg }}
              onPressIn={() => setPaused(true)}
              onPressOut={(e) => {
                setPaused(false);
                handleTap(e.nativeEvent.locationX);
              }}
            >
              {!contentReady ? (
                <View style={{ alignItems: "center", gap: spacing.md }}>
                  <ActivityIndicator color="#fff" />
                  <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: fontSize.sm }}>Revealing…</Text>
                </View>
              ) : (
                <View style={{ alignItems: "center" }}>
                  {curHasMedia && curMediaType.startsWith("image/") && (
                    <Image
                      source={{ uri: `${API_BASE}/v1/secrets/blob/${curMediaPath}` }}
                      style={{ maxHeight: 300, width: "100%", borderRadius: 12, marginBottom: spacing.md }}
                      resizeMode="contain"
                      onLoad={() => setMediaLoaded(true)}
                      onError={() => setMediaLoaded(true)}
                    />
                  )}
                  {currentMeta?.emoji && <Text style={{ fontSize: 40, marginBottom: spacing.md }}>{currentMeta.emoji}</Text>}
                  {current?.message && (
                    <Text style={{ color: "#fff", fontSize: fontSize.lg, textAlign: "center", lineHeight: 28 }}>
                      {current.message}
                    </Text>
                  )}
                </View>
              )}
            </Pressable>
          </>
        )}
      </View>
    </Modal>
  );
}
