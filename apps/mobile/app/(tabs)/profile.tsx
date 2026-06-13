import { useState, useCallback } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme, spacing, radius, fontSize } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { usersApi, secretsApi } from "@/lib/api";
import { passkeyRegister, isPasskeySupported } from "@/lib/passkey";

const PLATFORMS = [
  "instagram",
  "twitter",
  "tiktok",
  "youtube",
  "github",
  "linkedin",
  "snapchat",
  "telegram",
  "website",
] as const;

const PLATFORM_ICONS: Record<string, string> = {
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

export default function ProfileTab() {
  const { colors } = useTheme();
  const { user, logout, refreshUser } = useAuth();
  const router = useRouter();

  const [bio, setBio] = useState(user?.bio ?? "");
  const [socials, setSocials] = useState<{ platform: string; url: string }[]>(
    user?.socials ?? [],
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [sentSecrets, setSentSecrets] = useState<any[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (user) {
        setBio(user.bio ?? "");
        setSocials(user.socials ?? []);
        // Load sent secrets
        secretsApi.getSent(user.id).then(setSentSecrets).catch(() => {});
      }
    }, [user]),
  );

  async function handleSave() {
    setSaving(true);
    try {
      await usersApi.updateProfile({
        bio: bio.trim(),
        socials: socials.filter((s) => s.url.trim()),
      });
      await refreshUser();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      Alert.alert("Error", "Failed to save profile");
    } finally {
      setSaving(false);
    }
  }

  function addSocial() {
    if (socials.length >= 10) return;
    setSocials([...socials, { platform: "instagram", url: "" }]);
  }

  function removeSocial(index: number) {
    setSocials(socials.filter((_, i) => i !== index));
  }

  function updateSocial(index: number, field: "platform" | "url", value: string) {
    const updated = [...socials];
    updated[index] = { ...updated[index]!, [field]: value };
    setSocials(updated);
  }

  async function handleLogout() {
    Alert.alert("Log out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log out",
        style: "destructive",
        onPress: async () => {
          await logout();
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: spacing.xl,
          }}
        >
          <Text
            style={{
              fontSize: fontSize.xl,
              fontWeight: "700",
              color: colors.text,
            }}
          >
            Profile
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
            <Pressable onPress={() => router.push("/settings" as any)} hitSlop={12}>
              <Text style={{ fontSize: 20 }}>⚙️</Text>
            </Pressable>
            <Pressable onPress={handleLogout}>
              <Text style={{ fontSize: fontSize.sm, color: colors.danger }}>
                Log out
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Avatar + handle */}
        <View
          style={{
            alignItems: "center",
            marginBottom: spacing["2xl"],
          }}
        >
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: colors.accent + "33",
              borderWidth: 2,
              borderColor: colors.accent,
              justifyContent: "center",
              alignItems: "center",
              marginBottom: spacing.md,
            }}
          >
            <Text style={{ fontSize: 28, fontWeight: "700", color: colors.accent }}>
              {user?.handle?.[0]?.toUpperCase() ?? "?"}
            </Text>
          </View>
          <Text style={{ fontSize: fontSize.xl, fontWeight: "700", color: colors.text }}>
            @{user?.handle}
          </Text>
          <View style={{ flexDirection: "row", gap: spacing.lg, marginTop: spacing.sm }}>
            <Text style={{ fontSize: fontSize.xs, color: colors.textMuted }}>
              <Text style={{ fontWeight: "700", color: colors.text }}>
                {user?.followersCount ?? 0}
              </Text>{" "}
              followers
            </Text>
            <Text style={{ fontSize: fontSize.xs, color: colors.textMuted }}>
              <Text style={{ fontWeight: "700", color: colors.text }}>
                {user?.followingCount ?? 0}
              </Text>{" "}
              following
            </Text>
          </View>
        </View>

        {/* Bio */}
        <View style={{ marginBottom: spacing.xl }}>
          <Text
            style={{
              fontSize: fontSize.sm,
              fontWeight: "600",
              color: colors.textMuted,
              marginBottom: spacing.sm,
            }}
          >
            Bio
          </Text>
          <TextInput
            value={bio}
            onChangeText={(t) => setBio(t.slice(0, 300))}
            placeholder="Tell people about yourself..."
            placeholderTextColor={colors.textMuted + "66"}
            multiline
            maxLength={300}
            style={{
              backgroundColor: colors.surfaceRaised,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.lg,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.md,
              fontSize: fontSize.base,
              color: colors.text,
              minHeight: 80,
              textAlignVertical: "top",
            }}
          />
          <Text
            style={{
              fontSize: fontSize.xs,
              color: colors.textMuted,
              textAlign: "right",
              marginTop: 4,
            }}
          >
            {bio.length}/300
          </Text>
        </View>

        {/* Social links */}
        <View style={{ marginBottom: spacing.xl }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: spacing.sm,
            }}
          >
            <Text
              style={{
                fontSize: fontSize.sm,
                fontWeight: "600",
                color: colors.textMuted,
              }}
            >
              Social links
            </Text>
            {socials.length < 10 && (
              <Pressable onPress={addSocial}>
                <Text style={{ fontSize: fontSize.sm, color: colors.accent }}>
                  + Add
                </Text>
              </Pressable>
            )}
          </View>

          {socials.map((s, i) => (
            <View
              key={i}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.sm,
                marginBottom: spacing.sm,
              }}
            >
              <Pressable
                onPress={() => {
                  const currentIdx = PLATFORMS.indexOf(s.platform as any);
                  const next = PLATFORMS[(currentIdx + 1) % PLATFORMS.length]!;
                  updateSocial(i, "platform", next);
                }}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: radius.md,
                  backgroundColor: colors.surfaceRaised,
                  borderWidth: 1,
                  borderColor: colors.border,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Text style={{ fontSize: 16 }}>
                  {PLATFORM_ICONS[s.platform] ?? "🔗"}
                </Text>
              </Pressable>
              <TextInput
                value={s.url}
                onChangeText={(t) => updateSocial(i, "url", t)}
                placeholder={`${s.platform} URL`}
                placeholderTextColor={colors.textMuted + "66"}
                autoCapitalize="none"
                style={{
                  flex: 1,
                  backgroundColor: colors.surfaceRaised,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: radius.md,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  fontSize: fontSize.sm,
                  color: colors.text,
                }}
              />
              <Pressable onPress={() => removeSocial(i)}>
                <Text style={{ fontSize: fontSize.base, color: colors.danger }}>
                  ×
                </Text>
              </Pressable>
            </View>
          ))}
        </View>

        {/* Save button */}
        <Pressable
          onPress={handleSave}
          disabled={saving}
          style={({ pressed }) => ({
            backgroundColor: saved ? colors.success : colors.accent,
            paddingVertical: spacing.lg,
            borderRadius: radius.full,
            alignItems: "center",
            opacity: saving ? 0.6 : pressed ? 0.9 : 1,
            marginBottom: spacing.xl,
          })}
        >
          <Text
            style={{
              fontSize: fontSize.base,
              fontWeight: "700",
              color: "#000",
            }}
          >
            {saving ? "Saving..." : saved ? "✓ Saved!" : "Save profile"}
          </Text>
        </Pressable>

        {/* Passkey registration */}
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: colors.border,
            paddingTop: spacing.xl,
            marginBottom: spacing["3xl"],
          }}
        >
          <Text
            style={{
              fontSize: fontSize.sm,
              fontWeight: "600",
              color: colors.textMuted,
              marginBottom: spacing.sm,
            }}
          >
            Security
          </Text>
          <Pressable
            onPress={async () => {
              if (!isPasskeySupported()) {
                Alert.alert("Not supported", "Passkeys require iOS 16+ or Android 14+");
                return;
              }
              try {
                await passkeyRegister();
                Alert.alert("Success", "Passkey registered! You can now sign in with Face ID or fingerprint.");
              } catch (e: any) {
                Alert.alert("Error", e?.message ?? "Failed to register passkey");
              }
            }}
            style={({ pressed }) => ({
              backgroundColor: colors.surfaceRaised,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.lg,
              paddingVertical: spacing.lg,
              paddingHorizontal: spacing.lg,
              opacity: pressed ? 0.8 : 1,
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
            })}
          >
            <Text style={{ fontSize: 20 }}>🔑</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: fontSize.base, fontWeight: "600", color: colors.text }}>
                Register Passkey
              </Text>
              <Text style={{ fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 }}>
                Sign in with Face ID, Touch ID, or fingerprint
              </Text>
            </View>
          </Pressable>
        </View>

        {/* Sent secrets */}
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: colors.border,
            paddingTop: spacing.xl,
            marginBottom: spacing["3xl"],
          }}
        >
          <Text
            style={{
              fontSize: fontSize.sm,
              fontWeight: "600",
              color: colors.textMuted,
              marginBottom: spacing.md,
            }}
          >
            Sent secrets {sentSecrets.length > 0 ? `(${sentSecrets.length})` : ""}
          </Text>
          {sentSecrets.length === 0 ? (
            <Text style={{ fontSize: fontSize.sm, color: colors.textMuted, textAlign: "center", paddingVertical: spacing.xl }}>
              No secrets sent yet
            </Text>
          ) : (
            sentSecrets.slice(0, 20).map((s) => (
              <View
                key={s.id}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: colors.surfaceRaised,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: radius.lg,
                  padding: spacing.md,
                  marginBottom: spacing.sm,
                  gap: spacing.md,
                }}
              >
                <Text style={{ fontSize: 18 }}>
                  {s.burned ? "🔥" : s.view_count > 0 ? "👁" : "📤"}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: fontSize.sm, fontWeight: "600", color: colors.text }}>
                    To @{s.recipient_handle ?? "anonymous"}
                  </Text>
                  <Text style={{ fontSize: fontSize.xs, color: colors.textMuted }}>
                    {s.content_type === "text" ? "Text" : "Media"} · {s.view_count}/{s.max_views} views
                    {s.burned ? " · Burned" : ""}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
