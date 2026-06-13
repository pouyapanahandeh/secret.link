import { Tabs } from "expo-router";
import { View, Platform } from "react-native";
import { useState, useEffect, useCallback } from "react";
import Svg, { Path } from "react-native-svg";
import { useTheme } from "@/lib/theme";
import { dmsApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";

// ─── Tab Icons (matching web dashboard nav) ─────────────────────────────────

function HomeIcon({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={1.5}>
      <Path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
    </Svg>
  );
}

function MapIcon({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={1.5}>
      <Path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503-11.307l4.994-2.497A.75.75 0 0121 4.196v13.608a.75.75 0 01-.497.708l-5.006 2.503m-6.994-3.015l-5.006 2.503A.75.75 0 013 19.804V6.196a.75.75 0 01.497-.708l5.006-2.503m6.994 3.015L9 4.485m6.497 1.53L9 8.515" />
    </Svg>
  );
}

function MessagesIcon({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={1.5}>
      <Path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443h.004c2.174-.063 4.322-.258 6.426-.573 1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
    </Svg>
  );
}

function ProfileIcon({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={1.5}>
      <Path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </Svg>
  );
}

// ─── Tab Layout ─────────────────────────────────────────────────────────────

export default function TabLayout() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  // Poll unread count every 15s
  useEffect(() => {
    if (!user) return;
    let mounted = true;

    const fetchUnread = async () => {
      try {
        const data = await dmsApi.getUnread();
        if (mounted) setUnreadCount(data.count);
      } catch {}
    };

    fetchUnread();
    const interval = setInterval(fetchUnread, 15000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [user]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border + "80",
          borderTopWidth: 0.5,
          height: Platform.OS === "ios" ? 85 : 65,
          paddingBottom: Platform.OS === "ios" ? 28 : 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "600",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => <HomeIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: "Map",
          tabBarIcon: ({ color }) => <MapIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: "Messages",
          tabBarIcon: ({ color }) => <MessagesIcon color={color} />,
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: colors.accent,
            color: "#000",
            fontSize: 10,
            fontWeight: "700",
            minWidth: 18,
            height: 18,
            borderRadius: 9,
          },
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => <ProfileIcon color={color} />,
        }}
      />
    </Tabs>
  );
}
