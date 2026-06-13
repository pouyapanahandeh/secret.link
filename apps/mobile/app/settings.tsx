import { useState } from "react";
import { useRouter } from "expo-router";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Switch,
  Alert,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Notifications from "expo-notifications";
import { useTheme, spacing, radius, fontSize } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { usersApi, clearToken } from "@/lib/api";
import Constants from "expo-constants";

export default function SettingsScreen() {
  const { colors, isDark, toggle } = useTheme();
  const { user, logout } = useAuth();
  const router = useRouter();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const appVersion = Constants.expoConfig?.version ?? "1.0.0";

  async function handleToggleNotifications(value: boolean) {
    setNotificationsEnabled(value);
    if (!value) {
      // Guide user to system settings to disable
      Alert.alert(
        "Disable Notifications",
        "To fully disable notifications, go to your device settings.",
        [
          { text: "Cancel", style: "cancel", onPress: () => setNotificationsEnabled(true) },
          {
            text: "Open Settings",
            onPress: () => Linking.openSettings(),
          },
        ],
      );
    }
  }

  async function handleDeleteAccount() {
    Alert.alert(
      "Delete Account",
      "This will permanently delete your account, all secrets, and messages. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Forever",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              await usersApi.deleteAccount();
              await clearToken();
              await logout();
            } catch {
              Alert.alert("Error", "Failed to delete account. Try again later.");
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  }

  function handleLogout() {
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

  // ─── Row component ──────────────────────────────────────────────────────────

  function SettingsRow({
    label,
    value,
    onPress,
    right,
    danger,
  }: {
    label: string;
    value?: string;
    onPress?: () => void;
    right?: React.ReactNode;
    danger?: boolean;
  }) {
    return (
      <Pressable
        onPress={onPress}
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.lg,
          borderBottomWidth: 0.5,
          borderBottomColor: colors.border + "60",
        }}
      >
        <Text
          style={{
            fontSize: fontSize.base,
            color: danger ? colors.danger : colors.text,
            fontWeight: "500",
          }}
        >
          {label}
        </Text>
        {right ?? (
          <Text style={{ fontSize: fontSize.sm, color: colors.textMuted }}>
            {value ?? ""}
          </Text>
        )}
      </Pressable>
    );
  }

  // ─── Section header ─────────────────────────────────────────────────────────

  function SectionHeader({ title }: { title: string }) {
    return (
      <Text
        style={{
          fontSize: fontSize.xs,
          fontWeight: "700",
          color: colors.textMuted,
          textTransform: "uppercase",
          letterSpacing: 1,
          paddingHorizontal: spacing.lg,
          paddingTop: spacing["2xl"],
          paddingBottom: spacing.sm,
        }}
      >
        {title}
      </Text>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          borderBottomWidth: 0.5,
          borderBottomColor: colors.border + "60",
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={{ fontSize: fontSize.lg, color: colors.accent }}>←</Text>
        </Pressable>
        <Text
          style={{
            fontSize: fontSize.lg,
            fontWeight: "700",
            color: colors.text,
            marginLeft: spacing.md,
          }}
        >
          Settings
        </Text>
      </View>

      <ScrollView>
        {/* Appearance */}
        <SectionHeader title="Appearance" />
        <SettingsRow
          label="Dark Mode"
          right={
            <Switch
              value={isDark}
              onValueChange={toggle}
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor="#fff"
            />
          }
        />

        {/* Notifications */}
        <SectionHeader title="Notifications" />
        <SettingsRow
          label="Push Notifications"
          right={
            <Switch
              value={notificationsEnabled}
              onValueChange={handleToggleNotifications}
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor="#fff"
            />
          }
        />
        <SettingsRow
          label="Notification Settings"
          value="→"
          onPress={() => Linking.openSettings()}
        />

        {/* Account */}
        <SectionHeader title="Account" />
        <SettingsRow label="Handle" value={`@${user?.handle ?? ""}`} />
        <SettingsRow label="Email" value={user?.email ?? "Not set"} />
        <SettingsRow
          label="Log Out"
          danger
          onPress={handleLogout}
        />
        <SettingsRow
          label={deleting ? "Deleting..." : "Delete Account"}
          danger
          onPress={handleDeleteAccount}
        />

        {/* About */}
        <SectionHeader title="About" />
        <SettingsRow label="Version" value={appVersion} />
        <SettingsRow
          label="Privacy Policy"
          value="→"
          onPress={() => Linking.openURL("https://secretlink.life/privacy")}
        />
        <SettingsRow
          label="Terms of Service"
          value="→"
          onPress={() => Linking.openURL("https://secretlink.life/about")}
        />

        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
  );
}
