import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import {
  useLoaderData,
  Link,
  useRouteError,
  isRouteErrorResponse,
  useFetcher,
  useNavigate,
  useRevalidator,
  type ClientLoaderFunctionArgs,
} from "@remix-run/react";
import { useState, useEffect, useRef } from "react";
import { ThemeToggle } from "../components/ThemeToggle";
import { MessagingPanel } from "../components/MessagingPanel";
import { MapTab } from "../components/MapTab";
import { NotificationBell } from "../components/NotificationBell";
import { NotificationPrompt } from "../components/NotificationPrompt";
import { StoriesRow } from "../components/StoriesRow";
import { StoryViewer } from "../components/StoryViewer";
import { StoryComposer } from "../components/StoryComposer";
import { ProfileActionSheet } from "../components/ProfileActionSheet";
import type { UserLite } from "../lib/users";
import { requireToken } from "../lib/session.server";
import { API_URL } from "../lib/api.server";
import { getApiBase } from "../lib/api.client";
import { getViewedStoryIds, computeViewedHandles } from "../lib/story-views";
import { UI_FEATURES } from "../lib/feature-flags";
import { ProfileShareModal } from "../components/ProfileShareModal";
import { ProfileStatsModal } from "../components/ProfileStatsModal";
import { ProfileEditForm } from "../components/ProfileEditForm";
import { ProfileView } from "../components/ProfileView";
import { GoLiveButton } from "../components/GoLiveButton";
import { LiveStreams } from "../components/LiveStreams";
import type { MapSecret } from "../lib/map-types";

import { DashboardSkeleton, readDashboardTabFromHash } from "../components/DashboardSkeleton";

type DashboardTab = "inbox" | "map" | "messages" | "profile";

function readTabFromHash(): DashboardTab {
  if (typeof window === "undefined") return "inbox";
  const hash = window.location.hash.replace("#", "");
  if (hash === "messages" && !UI_FEATURES.messages) return "inbox";
  if (hash === "map" || hash === "profile" || hash === "inbox" || (hash === "messages" && UI_FEATURES.messages)) {
    return hash as DashboardTab;
  }
  return "inbox";
}

export const meta: MetaFunction = () => [
  { title: "Dashboard — Secretlink.life" },
];

export async function action({ request }: ActionFunctionArgs) {
  const token = await requireToken(request);
  const form = await request.formData();
  const intent = form.get("intent");

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  switch (intent) {
    case "search": {
      const q = String(form.get("q") ?? "");
      const res = await fetch(`${API_URL}/v1/users/search?q=${encodeURIComponent(q)}`, { headers });
      return json(await res.json());
    }
    case "follow": {
      const targetId = String(form.get("targetId") ?? "");
      const res = await fetch(`${API_URL}/v1/users/follow/${targetId}`, { method: "POST", headers });
      return json(await res.json());
    }
    case "unfollow": {
      const targetId = String(form.get("targetId") ?? "");
      const res = await fetch(`${API_URL}/v1/users/follow/${targetId}`, { method: "DELETE", headers });
      return json(await res.json());
    }
    case "follow-status": {
      const targetId = String(form.get("targetId") ?? "");
      const res = await fetch(`${API_URL}/v1/users/follow/${targetId}`, { headers });
      return json(await res.json());
    }
    case "save-profile": {
      const bio = String(form.get("bio") ?? "");
      const socials = JSON.parse(String(form.get("socials") ?? "[]"));
      const avatarUrlRaw = form.get("avatarUrl");
      const avatarUrl =
        avatarUrlRaw === null || avatarUrlRaw === undefined
          ? undefined
          : String(avatarUrlRaw);
      const res = await fetch(`${API_URL}/v1/users/me/profile`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          bio,
          socials,
          ...(avatarUrl !== undefined ? { avatarUrl: avatarUrl || null } : {}),
        }),
      });
      return json(await res.json());
    }
    case "passkey-register-options": {
      const res = await fetch(`${API_URL}/v1/users/me/passkey/register-options`, { method: "POST", headers });
      return json(await res.json());
    }
    case "passkey-register-verify": {
      const credential = String(form.get("credential") ?? "");
      const res = await fetch(`${API_URL}/v1/users/me/passkey/register-verify`, {
        method: "POST",
        headers,
        body: credential,
      });
      return json(await res.json());
    }
    case "stream-ticket": {
      const conversationId = String(form.get("conversationId") ?? "");
      const res = await fetch(`${API_URL}/v1/dms/stream-ticket`, {
        method: "POST",
        headers,
        body: JSON.stringify({ conversationId }),
      });
      return json(await res.json());
    }
    case "get-api-token": {
      // Client-side DM E2E encryption needs a bearer token, but we must not hand
      // the 7-day session JWT to page JS. Exchange it for a short-lived (15 min)
      // token minted by the API instead.
      const res = await fetch(`${API_URL}/v1/users/auth/session-token`, { method: "POST", headers });
      if (!res.ok) return json({ error: "token_exchange_failed" }, { status: 502 });
      return json(await res.json());
    }
    default:
      return json({ error: "unknown_intent" }, { status: 400 });
  }
}

export async function loader({ request }: LoaderFunctionArgs) {
  const token = await requireToken(request);

  const profileRes = await fetch(`${API_URL}/v1/users/me/profile`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!profileRes.ok) {
    return redirect("/login");
  }

  const user = await profileRes.json();

  const inboxRes = await fetch(`${API_URL}/v1/secrets/inbox/${user.handle}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const inbox = inboxRes.ok ? await inboxRes.json() : [];

  const sentRes = await fetch(`${API_URL}/v1/secrets/sent/${user.id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const sent = sentRes.ok ? await sentRes.json() : [];

  // People the user follows (for the stories row) + which of them currently
  // have an active map secret ("story"). Both are best-effort.
  const followingRes = await fetch(`${API_URL}/v1/users/me/following`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const following = followingRes.ok ? await followingRes.json() : [];

  const mapRes = await fetch(`${API_URL}/v1/secrets/map`);
  const mapSecrets = mapRes.ok ? await mapRes.json() : [];
  const storyHandles: string[] = Array.from(
    new Set(
      (mapSecrets as Array<{ handle?: string }>)
        .map((m) => (m.handle ?? "").replace(/^@/, "").toLowerCase())
        .filter(Boolean),
    ),
  );
  // Map of handle → active story IDs, so the client can dim rings whose stories
  // have all been viewed (viewed-state lives in the browser's localStorage).
  const storyIdsByHandle: Record<string, string[]> = {};
  for (const m of mapSecrets as Array<{ id?: string; handle?: string }>) {
    const h = (m.handle ?? "").replace(/^@/, "").toLowerCase();
    if (!h || !m.id) continue;
    (storyIdsByHandle[h] ??= []).push(String(m.id));
  }

  return json({ user, inbox, sent, token, following, storyHandles, storyIdsByHandle, mapSecrets });
}

export async function clientLoader({ serverLoader }: ClientLoaderFunctionArgs) {
  return serverLoader<typeof loader>();
}
clientLoader.hydrate = true;

export function HydrateFallback() {
  return <DashboardSkeleton tab={readDashboardTabFromHash()} />;
}

export default function Dashboard() {
  const { user, inbox, sent, token, following, storyHandles, storyIdsByHandle, mapSecrets } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const [activeTab, setActiveTab] = useState<DashboardTab>(() => readTabFromHash());
  const [passkeyStatus, setPasskeyStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [passkeyError, setPasskeyError] = useState("");
  const [hasPasskey, setHasPasskey] = useState(user.hasPasskey);
  const [bio, setBio] = useState(user.bio ?? "");
  const [socials, setSocials] = useState<{ platform: string; url: string }[]>(user.socials ?? []);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user.avatarUrl ?? null);
  // Idiomatic Remix data flow: fetchers run actions and auto-revalidate the loader.
  const searchFetcher = useFetcher<any[]>();
  const followFetcher = useFetcher<{ following: boolean; followersCount: number }>();
  const profileFetcher = useFetcher<{ error?: string }>();
  const profileSaving = profileFetcher.state !== "idle";
  const [profileSaved, setProfileSaved] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);

  // Stories + profile action sheet (home tab social features)
  const storyHandleSet = new Set<string>(storyHandles);
  const [storyViewer, setStoryViewer] = useState<UserLite | null>(null);
  const [sheetUser, setSheetUser] = useState<{ user: UserLite; hasStory: boolean } | null>(null);

  // Viewed-story tracking (localStorage) → dims rings once watched.
  const [viewedStoryIds, setViewedStoryIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    setViewedStoryIds(getViewedStoryIds());
  }, [storyIdsByHandle]);
  const viewedHandles = computeViewedHandles(storyIdsByHandle, viewedStoryIds);

  // Add story composer (single entry point for all story posts)
  const [fabOpen, setFabOpen] = useState(false);
  const [storyComposer, setStoryComposer] = useState<
    { open: true; initialCoords?: { lat: number; lng: number } } | { open: false }
  >({ open: false });
  const [showBroadcast, setShowBroadcast] = useState(false);

  function setTab(tab: DashboardTab) {
    setActiveTab(tab);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `/dashboard#${tab}`);
    }
  }

  useEffect(() => {
    const onHash = () => setActiveTab(readTabFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  function openStoryComposer(initialCoords?: { lat: number; lng: number }) {
    setStoryComposer({ open: true, initialCoords });
  }

  // Ensure this user has a published X25519 key so they can receive
  // E2E-wrapped secrets sent from their profile (and DMs).
  useEffect(() => {
    if (!token) return;
    import("../lib/dm-crypto").then(({ ensureAndPublishKey }) =>
      ensureAndPublishKey(getApiBase(), token),
    ).catch(() => {});
  }, [token]);

  // Subscribe this device to Web Push so notifications reach the lock screen /
  // browser even when the app is closed.
  useEffect(() => {
    if (!token) return;
    import("../lib/push.client").then(({ ensurePushSubscription }) =>
      ensurePushSubscription(token),
    ).catch(() => {});
  }, [token]);

  // Search state — results come from the search fetcher (idiomatic Remix data flow)
  const [searchQuery, setSearchQuery] = useState("");
  const searchResults = (Array.isArray(searchFetcher.data) ? searchFetcher.data : []) as any[];
  const searching = searchFetcher.state !== "idle";

  // Follow state (optimistic overlay, seeded from search results)
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});
  const lastFollowRef = useRef<string | null>(null);

  // Debounced search via fetcher. The action proxies to the API with the
  // server-side token and returns JSON (incl. per-row isFollowing → no N+1).
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) return;
    const timer = setTimeout(() => {
      searchFetcher.submit({ intent: "search", q }, { method: "post" });
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Seed follow state from search results (server is the source of truth).
  useEffect(() => {
    if (!Array.isArray(searchFetcher.data)) return;
    setFollowingMap(prev => {
      const next = { ...prev };
      for (const u of searchFetcher.data as any[]) {
        if (!(u.id in next)) next[u.id] = !!u.isFollowing;
      }
      return next;
    });
  }, [searchFetcher.data]);

  function toggleFollow(targetId: string) {
    const next = !followingMap[targetId];
    lastFollowRef.current = targetId;
    setFollowingMap(prev => ({ ...prev, [targetId]: next })); // optimistic
    followFetcher.submit(
      { intent: next ? "follow" : "unfollow", targetId },
      { method: "post" },
    );
  }

  // Reconcile follow state with the server response.
  useEffect(() => {
    if (followFetcher.state === "idle" && followFetcher.data && lastFollowRef.current) {
      const id = lastFollowRef.current;
      setFollowingMap(prev => ({ ...prev, [id]: !!followFetcher.data!.following }));
      lastFollowRef.current = null;
    }
  }, [followFetcher.state, followFetcher.data]);

  async function handleAddPasskey() {
    setPasskeyStatus("loading");
    setPasskeyError("");
    try {
      const { startRegistration } = await import("@simplewebauthn/browser");
      const apiBase = getApiBase();
      const authHeaders = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
      // Get options directly from the API (client token, mirrors DM flow).
      const optionsRes = await fetch(`${apiBase}/v1/users/me/passkey/register-options`, {
        method: "POST",
        headers: authHeaders,
      });
      if (!optionsRes.ok) throw new Error("Failed to get registration options");
      const options = await optionsRes.json();
      const credential = await startRegistration({ optionsJSON: options });
      const verifyRes = await fetch(`${apiBase}/v1/users/me/passkey/register-verify`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify(credential),
      });
      if (!verifyRes.ok) throw new Error("Passkey verification failed");
      setPasskeyStatus("done");
      setHasPasskey(true);
    } catch (err: any) {
      setPasskeyStatus("error");
      setPasskeyError(err?.message ?? "Something went wrong");
    }
  }

  function saveProfile() {
    setProfileSaved(false);
    profileFetcher.submit(
      {
        intent: "save-profile",
        bio,
        socials: JSON.stringify(socials.filter((s) => s.url)),
        avatarUrl: avatarUrl ?? "",
      },
      { method: "post" },
    );
  }

  // On successful save, exit edit mode. The fetcher auto-revalidates the loader,
  // so view mode (which reads user.*) reflects the persisted profile.
  useEffect(() => {
    if (profileFetcher.state === "idle" && profileFetcher.data && !profileFetcher.data.error) {
      setEditingProfile(false);
      setProfileSaved(true);
      const t = setTimeout(() => setProfileSaved(false), 3000);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [profileFetcher.state, profileFetcher.data]);

  function startEditProfile() {
    setBio(user.bio ?? "");
    setSocials(user.socials ?? []);
    setAvatarUrl(user.avatarUrl ?? null);
    setEditingProfile(true);
  }

  function cancelEditProfile() {
    setBio(user.bio ?? "");
    setSocials(user.socials ?? []);
    setAvatarUrl(user.avatarUrl ?? null);
    setEditingProfile(false);
  }

  const navItems = [
    { id: "inbox" as const, label: "Home", icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /></svg> },
    { id: "map" as const, label: "Map", icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503-11.307l4.994-2.497A.75.75 0 0121 4.196v13.608a.75.75 0 01-.497.708l-5.006 2.503m-6.994-3.015l-5.006 2.503A.75.75 0 013 19.804V6.196a.75.75 0 01.497-.708l5.006-2.503m6.994 3.015L9 4.485m6.497 1.53L9 8.515" /></svg> },
    ...(UI_FEATURES.messages ? [{ id: "messages" as const, label: "Messages", icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443h.004c2.174-.063 4.322-.258 6.426-.573 1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" /></svg> }] : []),
    { id: "profile" as const, label: "Profile", icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg> },
  ];

  function handleNavClick(id: string) {
    if (id === "profile") {
      navigate(`/${user.handle}`);
      return;
    }
    if (id === "messages" && !UI_FEATURES.messages) {
      setTab("inbox");
      return;
    }
    setTab(id as DashboardTab);
  }

  return (
    <main className="h-screen flex flex-col sm:flex-row bg-surface">
      {/* ─── Desktop Sidebar (sm+) ─── */}
      <aside className="hidden sm:flex flex-col w-56 lg:w-64 border-r border-border/50 bg-surface shrink-0">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-border/50">
          <Link to="/dashboard" className="flex items-center gap-2">
            <img src="/secretlink.png" alt="" className="w-7 h-7" />
            <span className="text-lg font-bold tracking-tight">
              secretlink<span className="text-accent">.</span>life
            </span>
          </Link>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeTab === item.id
                  ? "bg-accent/10 text-accent"
                  : "text-text-muted hover:text-text hover:bg-surface-raised"
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
              {item.id === "inbox" && inbox.length > 0 && (
                <span className="ml-auto text-xs bg-accent/20 text-accent px-2 py-0.5 rounded-full">{inbox.length}</span>
              )}
            </button>
          ))}
        </nav>

        {/* Bottom of sidebar */}
        <div className="px-3 py-4 border-t border-border/50 space-y-2">
          <div className="flex items-center justify-between px-3">
            <NotificationBell token={token} onNavigate={handleNavClick} />
            <ThemeToggle />
            <form method="post" action="/logout">
              <button type="submit" className="text-xs text-text-muted hover:text-text">
                Log out
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* ─── Mobile Header ─── */}
      {!(UI_FEATURES.messages && activeTab === "messages") && (
      <header className="sm:hidden flex items-center justify-between px-4 py-3 border-b border-border/50 bg-surface shrink-0">
        <Link to="/dashboard" className="flex items-center gap-2">
          <img src="/secretlink.png" alt="" className="w-6 h-6" />
        </Link>
        <div className="flex items-center gap-2">
          <NotificationBell token={token} onNavigate={handleNavClick} />
          <ThemeToggle />
          <form method="post" action="/logout">
            <button type="submit" className="text-xs text-text-muted hover:text-text">
              Log out
            </button>
          </form>
        </div>
      </header>
      )}

      {/* Content area */}
      {UI_FEATURES.messages && activeTab === "messages" ? (
        <div className="flex-1 min-h-0 flex overflow-hidden">
          <MessagingPanel token={token} />
        </div>
      ) : (
      <div className={`flex-1 min-h-0 ${activeTab === "map" ? "flex flex-col overflow-hidden pb-20 sm:pb-6" : "overflow-y-auto pb-20 sm:pb-6"}`}>
        <div className={`${activeTab === "map" ? "flex flex-col flex-1 min-h-0 max-w-2xl mx-auto px-4 sm:px-6 py-4 sm:py-6 w-full" : "max-w-2xl mx-auto px-4 sm:px-6 py-4 sm:py-6"}`}>

          {/* ─── INBOX TAB ─── */}
          {activeTab === "inbox" && (
            <section>
              {/* Notification permission CTA (visible when off / blocked) */}
              <NotificationPrompt token={token} />

              {/* Profile summary card */}
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-full bg-accent/20 border-2 border-accent flex items-center justify-center shrink-0">
                  <span className="text-lg font-bold text-accent">{user.handle[0]?.toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="text-base sm:text-lg font-bold truncate">@{user.handle}</h1>
                  <p className="text-xs text-text-muted truncate">
                    {user.email ?? "No email"} · {user.isPro ? "Pro ⭐" : "Free"}
                  </p>
                </div>
                <Link to={`/${user.handle}`} className="shrink-0 text-xs bg-accent/10 text-accent px-3 py-1.5 rounded-full">
                  View
                </Link>
              </div>

              {/* Live Streams */}
              {UI_FEATURES.live && <LiveStreams compact />}

              {/* Quick link */}
              <div className="flex items-center gap-2 mb-6 bg-surface-raised rounded-xl border border-border px-3 py-2.5">
                <span className="text-xs text-text-muted shrink-0">🔗</span>
                <code className="text-xs sm:text-sm text-text truncate flex-1">secretlink.life/@{user.handle}</code>
                <button
                  onClick={() => navigator.clipboard?.writeText(`https://secretlink.life/@${user.handle}`)}
                  className="text-xs text-accent shrink-0"
                >
                  Copy
                </button>
              </div>

              {/* Stories — people you follow (above the search bar) */}
              <StoriesRow
                users={following as UserLite[]}
                storyHandles={storyHandleSet}
                viewedHandles={viewedHandles}
                onSelect={(u, hasStory) => setSheetUser({ user: u, hasStory })}
              />

              {/* Search */}
              <div className="mb-6">
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search @username..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface-raised border border-border text-sm text-text placeholder:text-text-muted/40 focus:outline-none focus:ring-2 focus:ring-accent/50"
                  />
                </div>
                {searching && <p className="text-xs text-text-muted text-center mt-2">Searching...</p>}
                {searchResults.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {searchResults.map((u: any) => (
                      <div key={u.id} className="flex items-center gap-3 bg-surface-raised rounded-xl border border-border p-3">
                        <Link to={`/${u.handle}`} className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-9 h-9 rounded-full bg-accent/20 border border-accent/50 flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-accent">{u.handle[0]?.toUpperCase()}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">@{u.handle} {u.isPro && "⭐"}</p>
                            {u.bio && <p className="text-xs text-text-muted truncate">{u.bio}</p>}
                          </div>
                        </Link>
                        {u.id !== user.id && (
                          <button
                            onClick={() => toggleFollow(u.id)}
                            className={`shrink-0 text-xs px-3 py-1.5 rounded-full font-medium transition-all ${
                              followingMap[u.id]
                                ? "bg-surface border border-border text-text-muted"
                                : "bg-accent text-black"
                            }`}
                          >
                            {followingMap[u.id] ? "Following" : "Follow"}
                          </button>
                        )}
                        {u.id !== user.id && (
                          <button
                            onClick={() =>
                              setSheetUser({
                                user: { id: u.id, handle: u.handle, avatarUrl: u.avatarUrl, bio: u.bio, isPro: u.isPro },
                                hasStory: storyHandleSet.has(u.handle.toLowerCase()),
                              })
                            }
                            aria-label={`Actions for @${u.handle}`}
                            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full text-text-muted hover:bg-surface hover:text-text transition-colors"
                          >
                            ⋯
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
                  <p className="text-xs text-text-muted text-center mt-3">No users found</p>
                )}
              </div>

              {/* Passkey */}
              {!hasPasskey && (
                <button
                  onClick={handleAddPasskey}
                  disabled={passkeyStatus === "loading"}
                  className="w-full mb-4 text-sm bg-surface-raised border border-border text-text px-4 py-3 rounded-xl hover:border-accent/50 transition-colors disabled:opacity-50"
                >
                  {passkeyStatus === "loading" ? "Setting up..." : "🔑 Add passkey for faster login"}
                </button>
              )}
              {passkeyError && <p className="text-red-400 text-xs mb-4">{passkeyError}</p>}

              {/* Inbox list */}
              <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
                📥 Inbox
                {inbox.length > 0 && <span className="text-xs bg-accent/20 text-accent px-2 py-0.5 rounded-full">{inbox.length}</span>}
              </h2>

              {inbox.length === 0 ? (
                <div className="bg-surface-raised rounded-xl border border-border p-6 text-center">
                  <span className="text-3xl block mb-2">📥</span>
                  <p className="text-sm text-text-muted">No secrets yet</p>
                  <p className="text-xs text-text-muted/60 mt-1">Share your link to receive secrets</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {inbox.map((secret: any) => (
                    <Link
                      key={secret.id}
                      to={`/s/${secret.id}`}
                      className="flex items-center gap-3 bg-surface-raised rounded-xl border border-border p-3 sm:p-4 hover:border-accent/50 transition-colors active:scale-[0.98]"
                    >
                      <span className="text-xl">
                        {secret.contentType === "text" ? "💬" : secret.contentType === "image" ? "🖼️" : "📎"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{secret.contentType} secret</p>
                        <p className="text-xs text-text-muted">
                          {secret.burned ? "🔥 Burned" : secret.viewCount > 0 ? "👁️ Viewed" : "✨ New"}
                        </p>
                      </div>
                      <span className="text-xs text-text-muted shrink-0">
                        {new Date(secret.createdAt).toLocaleDateString()}
                      </span>
                    </Link>
                  ))}
                </div>
              )}

              {/* Sent section */}
              <h2 className="text-sm font-semibold mt-8 mb-3">📤 Sent</h2>
              {sent.length === 0 ? (
                <div className="bg-surface-raised rounded-xl border border-border p-6 text-center">
                  <p className="text-sm text-text-muted">No secrets sent</p>
                  <Link to="/send" className="text-xs text-accent mt-1 inline-block">Send one →</Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {sent.map((secret: any) => (
                    <div key={secret.id} className="flex items-center gap-3 bg-surface-raised rounded-xl border border-border p-3 sm:p-4">
                      <span className="text-xl">
                        {secret.contentType === "text" ? "💬" : "📎"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          → {secret.recipientHandle ? `@${secret.recipientHandle}` : "Link"}
                        </p>
                        <p className="text-xs text-text-muted">
                          {secret.burned ? "🔥 Burned" : secret.viewCount > 0 ? `👁️ ${secret.viewCount}/${secret.maxViews}` : "⏳ Pending"}
                        </p>
                      </div>
                      <span className="text-xs text-text-muted shrink-0">
                        {new Date(secret.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}



          {/* ─── PROFILE TAB ─── */}
          {activeTab === "profile" && (
            <section>
              {editingProfile ? (
                <ProfileEditForm
                  bio={bio}
                  socials={socials}
                  avatarUrl={avatarUrl}
                  handle={user.handle}
                  onBioChange={setBio}
                  onSocialsChange={setSocials}
                  onAvatarUrlChange={setAvatarUrl}
                  onSave={saveProfile}
                  onCancel={cancelEditProfile}
                  saving={profileSaving}
                />
              ) : (
                <ProfileView
                  profile={{
                    id: user.id,
                    handle: user.handle,
                    bio: user.bio,
                    avatarUrl: user.avatarUrl,
                    socials: user.socials,
                    isPro: user.isPro,
                    followersCount: user.followersCount,
                    followingCount: user.followingCount,
                  }}
                  handle={user.handle}
                  mode="owner"
                  apiBase={getApiBase()}
                  followersCount={user.followersCount ?? 0}
                  followingCount={user.followingCount ?? 0}
                  onShare={() => setShareOpen(true)}
                  onStats={() => setStatsOpen(true)}
                  onEdit={startEditProfile}
                />
              )}

              <p className="text-xs text-text-muted mt-4">
                {user.email ?? "No email set"}
                {hasPasskey ? " · Passkey active" : ""}
                {profileSaved ? " · Saved ✓" : ""}
              </p>

              {!hasPasskey && (
                <button
                  onClick={handleAddPasskey}
                  disabled={passkeyStatus === "loading"}
                  className="w-full mt-4 text-sm bg-surface-raised border border-border text-text px-4 py-3 rounded-xl hover:border-accent/50 transition-colors disabled:opacity-50"
                >
                  {passkeyStatus === "loading" ? "Setting up..." : "Add passkey"}
                </button>
              )}
              {passkeyError && <p className="text-red-400 text-xs mt-2">{passkeyError}</p>}
            </section>
          )}

          {/* ─── MAP TAB (keep mounted to preserve Leaflet state) ─── */}
          <div className={activeTab === "map" ? "flex flex-col flex-1 min-h-0" : "hidden"}>
            <MapTab
              initialSecrets={mapSecrets as MapSecret[]}
              isVisible={activeTab === "map"}
              onRequestComposer={(coords) => openStoryComposer(coords)}
              onViewUserStories={(handle) => {
                const clean = handle.replace(/^@/, "").toLowerCase();
                const u = (following as UserLite[]).find((f) => f.handle.toLowerCase() === clean);
                setStoryViewer(u ?? { id: "", handle: handle.replace(/^@/, ""), avatarUrl: null });
              }}
            />
          </div>
        </div>
      </div>
      )}

      {/* ─── Create FAB (home + map) ─── */}
      {(activeTab === "inbox" || activeTab === "map") && (
        <>
          {fabOpen && (
            <button
              aria-label="Close menu"
              className="fixed inset-0 z-40 bg-black/40"
              onClick={() => setFabOpen(false)}
            />
          )}
          <div className="fixed right-4 bottom-24 sm:bottom-6 z-[200] flex flex-col items-end gap-3 pointer-events-none">
            {fabOpen && (
              <div className="flex flex-col items-end gap-3 mb-1 pointer-events-auto">
                {[
                  ...(UI_FEATURES.live ? [{ label: "Go live", emoji: "🔴", onClick: () => { setFabOpen(false); setShowBroadcast(true); } }] : []),
                  { label: "Add story", emoji: "✨", onClick: () => { setFabOpen(false); openStoryComposer(); } },
                  { label: "Post secret", emoji: "🔐", onClick: () => { setFabOpen(false); navigate("/send"); } },
                ].map((a) => (
                  <button key={a.label} onClick={a.onClick} className="flex items-center gap-2">
                    <span className="text-xs font-medium bg-surface-raised border border-border rounded-full px-3 py-1.5 shadow-lg">
                      {a.label}
                    </span>
                    <span className="w-11 h-11 rounded-full bg-surface-raised border border-border flex items-center justify-center text-lg shadow-lg">
                      {a.emoji}
                    </span>
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => setFabOpen((o) => !o)}
              aria-label="Create"
              className={`pointer-events-auto w-14 h-14 rounded-full bg-accent text-black shadow-lg shadow-accent/20 flex items-center justify-center transition-transform ${fabOpen ? "rotate-45" : ""}`}
            >
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </button>
          </div>
        </>
      )}

      {/* ─── Bottom Navigation (mobile only) ─── */}
      {!(UI_FEATURES.messages && activeTab === "messages") && (
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-surface border-t border-border/50 z-30">
        <div className="flex items-center justify-around px-2 py-2 max-w-lg mx-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all ${
                activeTab === item.id
                  ? "text-accent"
                  : "text-text-muted"
              }`}
            >
              {item.icon}
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
      )}

      {/* Profile action sheet (from stories row / search results) */}
      {sheetUser && (
        <ProfileActionSheet
          user={sheetUser.user}
          hasStory={sheetUser.hasStory}
          onViewStory={() => setStoryViewer(sheetUser.user)}
          onClose={() => setSheetUser(null)}
        />
      )}

      {shareOpen && (
        <ProfileShareModal handle={user.handle} onClose={() => setShareOpen(false)} />
      )}

      {statsOpen && (
        <ProfileStatsModal token={token} onClose={() => setStatsOpen(false)} />
      )}

      {/* Instagram-style story viewer */}
      {storyViewer && (
        <StoryViewer
          handle={storyViewer.handle}
          avatarUrl={storyViewer.avatarUrl}
          onClose={() => setStoryViewer(null)}
          onViewed={(id) => setViewedStoryIds((prev) => (prev.has(id) ? prev : new Set(prev).add(id)))}
        />
      )}

      {/* Add story composer */}
      {storyComposer.open && (
        <StoryComposer
          handle={user.handle}
          token={token}
          initialCoords={storyComposer.initialCoords}
          onClose={() => setStoryComposer({ open: false })}
          onPosted={() => revalidator.revalidate()}
        />
      )}

      {/* Broadcast overlay (Go Live from FAB) */}
      {UI_FEATURES.live && showBroadcast && (
        <div className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl border border-border max-w-md w-full p-5 relative">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold">Go Live</h2>
              <button
                onClick={() => setShowBroadcast(false)}
                className="w-8 h-8 rounded-full bg-surface-raised border border-border flex items-center justify-center text-text-muted hover:text-text transition-colors"
                aria-label="Close"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <GoLiveButton token={token} />
          </div>
        </div>
      )}
    </main>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-surface">
      <div className="text-center max-w-md">
        <h1 className="text-2xl font-bold mb-2">
          {isRouteErrorResponse(error) ? `${error.status} — ${error.statusText}` : "Dashboard Error"}
        </h1>
        <p className="text-text-muted mb-6">
          {isRouteErrorResponse(error) ? error.data : "Something went wrong loading your dashboard."}
        </p>
        <Link to="/login" className="rounded-full bg-accent px-6 py-2.5 text-sm font-bold text-black">
          Back to login
        </Link>
      </div>
    </main>
  );
}
