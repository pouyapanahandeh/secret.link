import { useEffect, useRef } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View, ActivityIndicator } from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as Notifications from "expo-notifications";
import { ThemeProvider, useTheme } from "@/lib/theme";
import { AuthProvider, useAuth } from "@/lib/auth";
import {
  registerForPushNotifications,
  registerPushToken,
  type NotificationData,
} from "@/lib/notifications";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

function RootNavigator() {
  const { isAuthenticated, isLoading } = useAuth();
  const { colors, isDark } = useTheme();
  const segments = useSegments();
  const router = useRouter();
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  // Auth routing
  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === "(tabs)";

    if (isAuthenticated && !inAuthGroup) {
      router.replace("/(tabs)");
    } else if (!isAuthenticated && inAuthGroup) {
      router.replace("/login");
    }
  }, [isAuthenticated, isLoading, segments]);

  // Push notification registration
  useEffect(() => {
    if (!isAuthenticated) return;

    (async () => {
      const token = await registerForPushNotifications();
      if (token) {
        await registerPushToken(token);
      }
    })();
  }, [isAuthenticated]);

  // Notification response handling (user taps notification)
  useEffect(() => {
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as NotificationData | undefined;
        if (!data) return;

        switch (data.type) {
          case "dm":
            if (data.conversationId) {
              router.push(`/messages/${data.conversationId}` as any);
            } else {
              router.push("/(tabs)/messages");
            }
            break;
          case "secret":
            if (data.id) {
              router.push(`/secret/${data.id}` as any);
            } else {
              router.push("/(tabs)");
            }
            break;
          case "follow":
            if (data.handle) {
              router.push(`/user/${data.handle}` as any);
            }
            break;
          case "map_secret":
            router.push("/(tabs)/map");
            break;
        }
      },
    );

    return () => {
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []);

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: colors.surface,
        }}
      >
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.surface },
          animation: "slide_from_right",
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="signup" />
        <Stack.Screen name="(tabs)" options={{ animation: "fade" }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <RootNavigator />
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
