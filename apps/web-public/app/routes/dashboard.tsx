import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, Link, useRouteError, isRouteErrorResponse, useFetcher, useNavigate, useRevalidator } from "@remix-run/react";
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
import { getSocialMeta, detectPlatform, SOCIAL_META, SOCIAL_PLATFORMS } from "../lib/socials";

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
      const res = await fetch(`${API_URL}/v1/users/me/profile`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ bio, socials }),
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
      // Return the token for client-side DM operations (E2E encryption requires client-side API calls)
      return json({ token });
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

  return json({ user, inbox, sent, token, following, storyHandles, storyIdsByHandle });
}

export default function Dashboard() {
  const { user, inbox, sent, token, following, storyHandles, storyIdsByHandle } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const [activeTab, setActiveTab] = useState<"inbox" | "map" | "messages" | "profile">("inbox");
  const [passkeyStatus, setPasskeyStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [passkeyError, setPasskeyError] = useState("");
  const [hasPasskey, setHasPasskey] = useState(user.hasPasskey);
  const [bio, setBio] = useState(user.bio ?? "");
  const [socials, setSocials] = useState<{ platform: string; url: string }[]>(user.socials ?? []);
  // Idiomatic Remix data flow: fetchers run actions and auto-revalidate the loader.
  const searchFetcher = useFetcher<any[]>();
  const followFetcher = useFetcher<{ following: boolean; followersCount: number }>();
  const profileFetcher = useFetcher<{ error?: string }>();
  const profileSaving = profileFetcher.state !== "idle";
  const [profileSaved, setProfileSaved] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);

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

  // Home "+" action button (post story / secret / pin on map).
  const [fabOpen, setFabOpen] = useState(false);
  const [showStoryComposer, setShowStoryComposer] = useState(false);

  // Read tab from URL hash on mount
  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (hash === "map" || hash === "messages" || hash === "profile" || hash === "inbox") {
      setActiveTab(hash);
    }
  }, []);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        socials: JSON.stringify(socials.filter(s => s.url)),
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
    setEditingProfile(true);
  }

  function cancelEditProfile() {
    setBio(user.bio ?? "");
    setSocials(user.socials ?? []);
    setEditingProfile(false);
  }

  function addSocial() { setSocials([...socials, { platform: "", url: "" }]); }
  function removeSocial(i: number) { setSocials(socials.filter((_, idx) => idx !== i)); }
  function updateSocial(i: number, field: "platform" | "url", value: string) {
    const updated = [...socials];
    if (field === "url") {
      // Auto-detect platform from the URL (unless user manually overrode it)
      const detected = detectPlatform(value);
      updated[i] = { ...updated[i]!, url: value, platform: detected || updated[i]!.platform };
    } else {
      updated[i] = { ...updated[i]!, [field]: value };
    }
    setSocials(updated);
  }

  const navItems = [
    { id: "inbox" as const, label: "Home", icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /></svg> },
    { id: "map" as const, label: "Map", icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503-11.307l4.994-2.497A.75.75 0 0121 4.196v13.608a.75.75 0 01-.497.708l-5.006 2.503m-6.994-3.015l-5.006 2.503A.75.75 0 013 19.804V6.196a.75.75 0 01.497-.708l5.006-2.503m6.994 3.015L9 4.485m6.497 1.53L9 8.515" /></svg> },
    { id: "messages" as const, label: "Messages", icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443h.004c2.174-.063 4.322-.258 6.426-.573 1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" /></svg> },
    { id: "profile" as const, label: "Profile", icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg> },
  ];

  function handleNavClick(id: string) {
    setActiveTab(id as any);
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
      {activeTab !== "messages" && (
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
      {activeTab === "messages" ? (
        <div className="flex-1 min-h-0 flex overflow-hidden">
          <MessagingPanel token={token} />
        </div>
      ) : (
      <div className="flex-1 overflow-y-auto pb-20 sm:pb-6">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4 sm:py-6">

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
              {/* Profile header */}
              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-full bg-accent/20 border-2 border-accent flex items-center justify-center mx-auto mb-3">
                  <span className="text-2xl font-bold text-accent">{user.handle[0]?.toUpperCase()}</span>
                </div>
                <h2 className="text-lg font-bold">@{user.handle}</h2>
                <p className="text-xs text-text-muted mt-1">{user.email ?? "No email set"}</p>
                {hasPasskey && <span className="inline-block text-xs bg-success/10 text-success px-2 py-0.5 rounded-full mt-2">🔑 Passkey active</span>}
                <div className="flex items-center justify-center gap-4 mt-3">
                  <span className="text-xs text-text-muted"><strong className="text-text">{user.followersCount ?? 0}</strong> followers</span>
                  <span className="text-xs text-text-muted"><strong className="text-text">{user.followingCount ?? 0}</strong> following</span>
                </div>
              </div>

              {/* Edit form */}
              {editingProfile ? (
              <div className="bg-surface-raised rounded-2xl border border-border p-4 sm:p-6 space-y-5">
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1.5">Bio</label>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    maxLength={300}
                    rows={3}
                    placeholder="Tell people about yourself..."
                    className="w-full rounded-xl bg-surface border border-border px-3 py-2.5 text-sm text-text placeholder:text-text-muted/40 focus:outline-none focus:ring-2 focus:ring-accent/50 resize-none"
                  />
                  <p className="text-xs text-text-muted mt-1">{bio.length}/300</p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1.5">Social links</label>
                  <p className="text-xs text-text-muted/70 mb-2">Paste a link — we'll detect the platform automatically.</p>
                  <div className="space-y-2">
                    {socials.map((s, i) => {
                      const meta = getSocialMeta(s.platform);
                      return (
                      <div key={i} className="flex gap-2 items-center">
                        <div className="w-9 h-9 shrink-0 rounded-lg bg-surface border border-border flex items-center justify-center text-base" title={meta.label}>
                          {s.url ? meta.icon : "🔗"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <input
                            type="url"
                            value={s.url}
                            onChange={(e) => updateSocial(i, "url", e.target.value)}
                            placeholder="https://instagram.com/yourname"
                            className="w-full rounded-lg bg-surface border border-border px-2.5 py-2 text-xs sm:text-sm text-text placeholder:text-text-muted/40 focus:outline-none focus:ring-2 focus:ring-accent/50"
                          />
                          {s.url && (
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className="text-xs text-text-muted">{meta.label}</span>
                              <select
                                value={s.platform}
                                onChange={(e) => updateSocial(i, "platform", e.target.value)}
                                className="text-xs bg-transparent text-text-muted/60 border-none focus:outline-none cursor-pointer hover:text-accent"
                                title="Change platform"
                              >
                                {SOCIAL_PLATFORMS.map((p) => (
                                  <option key={p} value={p}>{SOCIAL_META[p]!.label}</option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => removeSocial(i)}
                          className="w-8 h-8 rounded-lg border border-border text-text-muted hover:text-red-400 hover:border-red-400/50 transition-colors flex items-center justify-center shrink-0 text-sm"
                        >
                          ×
                        </button>
                      </div>
                      );
                    })}
                    {socials.length < 10 && (
                      <button onClick={addSocial} className="text-xs text-accent">+ Add link</button>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={cancelEditProfile}
                    disabled={profileSaving}
                    className="flex-1 rounded-xl bg-surface border border-border px-4 py-3 text-sm font-bold text-text hover:border-accent/50 transition-all disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveProfile}
                    disabled={profileSaving}
                    className="flex-1 rounded-xl bg-accent px-4 py-3 text-sm font-bold text-black hover:scale-[1.01] transition-all disabled:opacity-50"
                  >
                    {profileSaving ? "Saving..." : "Save profile"}
                  </button>
                </div>
              </div>
              ) : (
              /* View mode */
              <div className="bg-surface-raised rounded-2xl border border-border p-4 sm:p-6 space-y-5">
                <div>
                  <h3 className="text-xs font-medium text-text-muted mb-1.5">Bio</h3>
                  {user.bio ? (
                    <p className="text-sm text-text whitespace-pre-wrap leading-relaxed">{user.bio}</p>
                  ) : (
                    <p className="text-sm text-text-muted/50 italic">No bio yet</p>
                  )}
                </div>

                <div>
                  <h3 className="text-xs font-medium text-text-muted mb-2">Social links</h3>
                  {(user.socials?.length ?? 0) > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {user.socials.map((s: { platform: string; url: string }, i: number) => {
                        const meta = getSocialMeta(s.platform);
                        return (
                          <a
                            key={i}
                            href={s.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 rounded-full bg-surface border border-border px-3 py-1.5 text-sm text-text hover:border-accent/50 hover:scale-[1.03] transition-all"
                            title={s.url}
                          >
                            <span className="text-base">{meta.icon}</span>
                            <span className="text-xs font-medium">{meta.label}</span>
                          </a>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-text-muted/50 italic">No social links yet</p>
                  )}
                </div>

                <button
                  onClick={startEditProfile}
                  className="w-full rounded-xl bg-accent px-4 py-3 text-sm font-bold text-black hover:scale-[1.01] transition-all"
                >
                  {profileSaved ? "Saved ✓" : "Edit profile"}
                </button>
              </div>
              )}

              {/* Passkey section */}
              {!hasPasskey && (
                <button
                  onClick={handleAddPasskey}
                  disabled={passkeyStatus === "loading"}
                  className="w-full mt-4 text-sm bg-surface-raised border border-border text-text px-4 py-3 rounded-xl hover:border-accent/50 transition-colors disabled:opacity-50"
                >
                  {passkeyStatus === "loading" ? "Setting up..." : "🔑 Add passkey"}
                </button>
              )}
              {passkeyError && <p className="text-red-400 text-xs mt-2">{passkeyError}</p>}
            </section>
          )}

          {/* ─── MAP TAB ─── */}
          {activeTab === "map" && (
            <MapTab user={user} following={following as Array<{ handle?: string; avatarUrl?: string | null }>} />
          )}
        </div>
      </div>
      )}

      {/* ─── Home create button (post story / secret / pin on map) ─── */}
      {activeTab === "inbox" && (
        <>
          {fabOpen && (
            <button
              aria-label="Close menu"
              className="fixed inset-0 z-40 bg-black/40"
              onClick={() => setFabOpen(false)}
            />
          )}
          <div className="fixed right-4 bottom-20 sm:bottom-6 z-50 flex flex-col items-end gap-3">
            {fabOpen && (
              <div className="flex flex-col items-end gap-3 mb-1">
                {[
                  { label: "Post story", emoji: "✨", onClick: () => { setFabOpen(false); setShowStoryComposer(true); } },
                  { label: "Post secret", emoji: "🔐", onClick: () => { setFabOpen(false); navigate("/send"); } },
                  { label: "Pin on map", emoji: "📍", onClick: () => { setFabOpen(false); setActiveTab("map"); } },
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
              className={`w-14 h-14 rounded-full bg-accent text-black shadow-lg flex items-center justify-center transition-transform ${fabOpen ? "rotate-45" : ""}`}
            >
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </button>
          </div>
        </>
      )}

      {/* ─── Bottom Navigation (mobile only) ─── */}
      {activeTab !== "messages" && (
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

      {/* Instagram-style story viewer */}
      {storyViewer && (
        <StoryViewer
          handle={storyViewer.handle}
          avatarUrl={storyViewer.avatarUrl}
          onClose={() => setStoryViewer(null)}
          onViewed={(id) => setViewedStoryIds((prev) => (prev.has(id) ? prev : new Set(prev).add(id)))}
        />
      )}

      {/* Quick "add to your story" composer (current-location) */}
      {showStoryComposer && (
        <StoryComposer
          handle={user.handle}
          onClose={() => setShowStoryComposer(false)}
          onPosted={() => revalidator.revalidate()}
        />
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
