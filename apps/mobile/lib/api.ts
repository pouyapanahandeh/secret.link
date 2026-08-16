import * as SecureStore from "expo-secure-store";

const API_BASE = "https://secretlink.life";
const TOKEN_KEY = "sl_token";

// ─── Token management ───────────────────────────────────────────────────────

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

// ─── API client ─────────────────────────────────────────────────────────────

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE" | "PUT";
  body?: unknown;
  auth?: boolean;
  headers?: Record<string, string>;
};

export class ApiError extends Error {
  constructor(
    public status: number,
    public data: unknown,
  ) {
    super(`API Error ${status}`);
    this.name = "ApiError";
  }
}

export async function api<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = "GET", body, auth = false, headers: extraHeaders } = options;

  const headers: Record<string, string> = {
    ...extraHeaders,
  };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (auth) {
    const token = await getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  const res = await fetch(`${API_BASE}/v1${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(res.status, data);
  }

  // Handle 204 No Content
  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

// ─── Typed API helpers ──────────────────────────────────────────────────────

export type ProfileStatsTotals = {
  profileViews: number;
  qrScans: number;
  socialClicks: number;
  secretsReceived: number;
  secretsSent: number;
};

export type ProfileStatsDay = ProfileStatsTotals & { day: string };

export type ProfileStatsResponse = {
  days: number;
  totals: ProfileStatsTotals;
  series: ProfileStatsDay[];
};

/** @deprecated Use ProfileStatsTotals */
export type ProfileStats = ProfileStatsTotals;

// Auth
export const authApi = {
  signup: (data: { handle: string; email?: string }) =>
    api<{ token: string; id: string; handle: string }>("/users", {
      method: "POST",
      body: data,
    }),

  loginMagicLink: (email: string) =>
    api<{ sent: boolean }>("/users/auth/magic-link", {
      method: "POST",
      body: { email },
    }),

  verifyMagicLink: (token: string) =>
    api<{ token: string }>("/users/auth/magic-link/verify", {
      method: "POST",
      body: { token },
    }),
};

// Users
export const usersApi = {
  me: () =>
    api<{
      id: string;
      handle: string;
      email?: string;
      bio?: string;
      socials?: { platform: string; url: string }[];
      acceptsSecrets?: boolean;
      followersCount: number;
      followingCount: number;
    }>("/users/me/profile", { auth: true }),

  getProfile: (handle: string) =>
    api<{
      id: string;
      handle: string;
      bio?: string;
      avatarUrl?: string | null;
      socials?: { platform: string; url: string }[];
      isPro?: boolean;
      acceptsSecrets?: boolean;
      dmPublicKey?: string | null;
      dmPublicKeys?: string[];
      followersCount?: number | null;
      followingCount?: number | null;
    }>(`/users/${handle}`, { auth: true }),

  updateProfile: (data: {
    bio?: string;
    socials?: { platform: string; url: string }[];
    acceptsSecrets?: boolean;
  }) =>
    api("/users/me/profile", { method: "PATCH", body: data, auth: true }),

  getStats: (days = 30) =>
    api<ProfileStatsResponse>(`/users/me/stats?days=${days}`, { auth: true }),

  trackQrScan: (handle: string) =>
    api<void>(`/users/track/qr/${encodeURIComponent(handle)}`, { method: "POST", auth: true }),

  search: (q: string) =>
    api<{ id: string; handle: string; bio?: string }[]>(
      `/users/search?q=${encodeURIComponent(q)}`,
    ),

  getFollowStatus: (targetId: string) =>
    api<{
      isFollowing: boolean;
      followersCount: number;
      followingCount: number;
    }>(`/users/follow/${targetId}`, { auth: true }),

  follow: (targetId: string) =>
    api<{ following: boolean; followersCount: number }>(
      `/users/follow/${targetId}`,
      { method: "POST", auth: true },
    ),

  unfollow: (targetId: string) =>
    api<{ following: boolean; followersCount: number }>(
      `/users/follow/${targetId}`,
      { method: "DELETE", auth: true },
    ),

  getFollowing: () =>
    api<{ id: string; handle: string; avatarUrl?: string | null; bio?: string }[]>(
      "/users/me/following",
      { auth: true },
    ),

  registerPushToken: (token: string, platform: string) =>
    api("/users/me/push-token", {
      method: "POST",
      body: { token, platform },
      auth: true,
    }),

  deleteAccount: () =>
    api("/users/me", { method: "DELETE", auth: true }),
};

// Secrets
export type MapSecret = {
  id: string;
  message?: string;
  lat: number;
  lng: number;
  emoji: string;
  handle?: string | null;
  locationName?: string | null;
  cityName?: string | null;
  countryName?: string | null;
  mediaPath?: string | null;
  mediaType?: string | null;
  revealMode: "timer" | "clicks";
  revealTimerSeconds: number;
  maxClicks: number;
  clickCount: number;
  createdAt: string;
  expiresAt: string;
};

export const secretsApi = {
  create: (
    params: {
      ciphertext: string;
      contentType: string;
      ttlSeconds: number;
      maxViews: number;
      mimeType?: string;
      viewDurationSeconds?: number;
      recipientHandle?: string;
      nonce?: string;
      wrappedKey?: string;
      wrapNonce?: string;
      wrapEpk?: string;
      wraps?: Array<{ wrappedKey: string; wrapNonce: string; wrapEpk: string }>;
      blobPath?: string;
      blobSizeBytes?: number;
    },
    options?: { auth?: boolean },
  ) =>
    api<{ id: string }>("/secrets", {
      method: "POST",
      body: params,
      auth: options?.auth ?? false,
    }),

  reveal: (id: string) =>
    api<{
      ciphertext: string;
      contentType: string;
      blobPath?: string;
      mimeType?: string;
      nonce?: string;
      viewDurationSeconds?: number;
      remainingViews: number;
      maxViews: number;
    }>(`/secrets/${id}/reveal`, { method: "POST", auth: true }),

  getInbox: (handle: string) =>
    api<
      {
        id: string;
        content_type: string;
        created_at: string;
        view_count: number;
        max_views: number;
        burned: number;
      }[]
    >(`/secrets/inbox/${handle}`, { auth: true }),

  getSent: (userId: string) =>
    api<
      {
        id: string;
        content_type: string;
        recipient_handle: string;
        created_at: string;
        view_count: number;
        max_views: number;
        burned: number;
      }[]
    >(`/secrets/sent/${userId}`, { auth: true }),

  getMapSecrets: () =>
    api<MapSecret[]>("/secrets/map"),

  createMapSecret: (params: {
    ciphertext: string;
    nonce: string;
    key: string;
    lat: number;
    lng: number;
    emoji: string;
    ttlMinutes: number;
    handle?: string;
    locationName?: string;
    cityName?: string;
    countryName?: string;
    revealMode?: "timer" | "clicks";
    revealTimerSeconds?: number;
    maxClicks?: number;
  }) =>
    api<MapSecret>("/secrets/map", { method: "POST", body: params, auth: true }),

  revealMapSecret: (id: string) =>
    api<MapSecret & { ciphertext?: string; nonce?: string; key?: string; legacy?: boolean }>(
      `/secrets/map/${id}/reveal`,
      { method: "POST" },
    ),

  getMapSecretsByHandle: (handle: string) =>
    api<MapSecret[]>(`/secrets/map/by-handle/${encodeURIComponent(handle)}`),

  reportMapSecret: (id: string, reason: string, details?: string) =>
    api<{ ok: boolean }>(`/secrets/map/${id}/report`, {
      method: "POST",
      body: { reason, details: details || undefined },
    }),
};

// DMs
export type Conversation = {
  id: string;
  participantIds: [string, string];
  participantHandles: [string, string];
  createdAt: string;
  lastMessageAt: string;
};

export type DmMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  senderHandle: string;
  recipientId: string;
  encryptedContent: string;
  nonce: string;
  createdAt: string;
  expiresAt: string;
  readAt?: string | null;
};

export const dmsApi = {
  getConversations: () =>
    api<Conversation[]>("/dms/conversations", { auth: true }),

  createConversation: (recipientId: string) =>
    api<Conversation>("/dms/conversations", {
      method: "POST",
      body: { recipientId },
      auth: true,
    }),

  getMessages: (conversationId: string, params?: { since?: string; before?: string; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.since) qs.set("since", params.since);
    if (params?.before) qs.set("before", params.before);
    if (params?.limit) qs.set("limit", String(params.limit));
    const q = qs.toString();
    return api<DmMessage[]>(`/dms/conversations/${conversationId}/messages${q ? `?${q}` : ""}`, { auth: true });
  },

  sendMessage: (
    conversationId: string,
    data: { encryptedContent: string; nonce: string; ttlMinutes?: number },
  ) =>
    api<DmMessage>(`/dms/conversations/${conversationId}/messages`, {
      method: "POST",
      body: data,
      auth: true,
    }),

  sendTyping: (conversationId: string) =>
    api(`/dms/conversations/${conversationId}/typing`, { method: "POST", auth: true }),

  deleteConversation: (conversationId: string) =>
    api(`/dms/conversations/${conversationId}`, { method: "DELETE", auth: true }),

  deleteMessage: (conversationId: string, messageId: string) =>
    api(`/dms/conversations/${conversationId}/messages/${messageId}`, { method: "DELETE", auth: true }),

  uploadKey: (publicKey: string, deviceId: string) =>
    api("/dms/keys", { method: "POST", body: { publicKey, deviceId }, auth: true }),

  getKey: (userId: string) =>
    api<{ publicKey: string; publicKeys?: string[] }>(`/dms/keys/${userId}`, { auth: true }),

  getUnread: () => api<{ count: number }>("/dms/unread", { auth: true }),
};
