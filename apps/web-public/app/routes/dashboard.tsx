import type { MetaFunction, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { useState, useEffect } from "react";
import { ThemeToggle } from "../components/ThemeToggle";

export const meta: MetaFunction = () => [
  { title: "Dashboard — Secretlink.life" },
];

const API_URL = process.env["API_URL"] ?? "http://localhost:4000";

export async function loader({ request }: LoaderFunctionArgs) {
  const cookieHeader = request.headers.get("Cookie") ?? "";
  const token = cookieHeader.match(/sl_token=([^;]+)/)?.[1];

  if (!token) {
    return redirect("/login");
  }

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

  return json({ user, inbox, sent, token });
}

export default function Dashboard() {
  const { user, inbox, sent, token } = useLoaderData<typeof loader>();
  const [activeTab, setActiveTab] = useState<"inbox" | "search" | "map" | "messages" | "profile">("inbox");
  const [passkeyStatus, setPasskeyStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [passkeyError, setPasskeyError] = useState("");
  const [hasPasskey, setHasPasskey] = useState(user.hasPasskey);
  const [bio, setBio] = useState(user.bio ?? "");
  const [socials, setSocials] = useState<{ platform: string; url: string }[]>(user.socials ?? []);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  // Follow state
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});

  function getApiBase() {
    const origin = window.location.origin;
    return window.location.port === "3000" ? origin.replace(":3000", ":4000") : origin;
  }

  async function searchUsers(q: string) {
    if (q.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const res = await fetch(`${getApiBase()}/v1/users/search?q=${encodeURIComponent(q)}`);
      if (res.ok) setSearchResults(await res.json());
    } finally {
      setSearching(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => { if (searchQuery) searchUsers(searchQuery); }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  async function toggleFollow(targetId: string) {
    const isFollowing = followingMap[targetId];
    const method = isFollowing ? "DELETE" : "POST";
    const res = await fetch(`${getApiBase()}/v1/users/follow/${targetId}`, {
      method,
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setFollowingMap(prev => ({ ...prev, [targetId]: data.following }));
    }
  }

  async function handleAddPasskey() {
    setPasskeyStatus("loading");
    setPasskeyError("");
    try {
      const { startRegistration } = await import("@simplewebauthn/browser");
      const apiBase = getApiBase();
      const optionsRes = await fetch(`${apiBase}/v1/users/me/passkey/register-options`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!optionsRes.ok) throw new Error("Failed to get registration options");
      const options = await optionsRes.json();
      const credential = await startRegistration({ optionsJSON: options });
      const verifyRes = await fetch(`${apiBase}/v1/users/me/passkey/register-verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
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

  async function saveProfile() {
    setProfileSaving(true);
    setProfileSaved(false);
    try {
      await fetch(`${getApiBase()}/v1/users/me/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ bio, socials: socials.filter(s => s.url) }),
      });
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    } finally {
      setProfileSaving(false);
    }
  }

  function addSocial() { setSocials([...socials, { platform: "", url: "" }]); }
  function removeSocial(i: number) { setSocials(socials.filter((_, idx) => idx !== i)); }
  function updateSocial(i: number, field: "platform" | "url", value: string) {
    const updated = [...socials];
    updated[i] = { ...updated[i], [field]: value };
    setSocials(updated);
  }

  return (
    <main className="h-screen flex flex-col bg-surface">
      {/* Top header - compact on mobile */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-border/50 bg-surface shrink-0">
        <a href="/" className="flex items-center gap-2">
          <img src="/secretlink.png" alt="" className="w-6 h-6 sm:w-7 sm:h-7" />
          <span className="text-base sm:text-lg font-bold tracking-tight hidden sm:inline">
            secretlink<span className="text-accent">.</span>life
          </span>
        </a>
        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle />
          <form method="post" action="/logout">
            <button type="submit" className="text-xs sm:text-sm text-text-muted hover:text-text">
              Log out
            </button>
          </form>
        </div>
      </header>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto pb-20 sm:pb-6">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4 sm:py-6">

          {/* ─── INBOX TAB ─── */}
          {activeTab === "inbox" && (
            <section>
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
                <a href={`/${user.handle}`} className="shrink-0 text-xs bg-accent/10 text-accent px-3 py-1.5 rounded-full">
                  View
                </a>
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
                      to={`/s/${secret.id}#k=${secret.keyHint ?? ""}`}
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

          {/* ─── SEARCH TAB ─── */}
          {activeTab === "search" && (
            <section>
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
                    autoFocus
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-surface-raised border border-border text-sm text-text placeholder:text-text-muted/40 focus:outline-none focus:ring-2 focus:ring-accent/50"
                  />
                </div>
              </div>

              {searching && <p className="text-xs text-text-muted text-center">Searching...</p>}

              {searchResults.length > 0 && (
                <div className="space-y-2">
                  {searchResults.map((u: any) => (
                    <div key={u.id} className="flex items-center gap-3 bg-surface-raised rounded-xl border border-border p-3 sm:p-4">
                      <a href={`/${u.handle}`} className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-accent/20 border border-accent/50 flex items-center justify-center shrink-0">
                          <span className="text-sm font-bold text-accent">{u.handle[0]?.toUpperCase()}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            @{u.handle} {u.isPro && "⭐"}
                          </p>
                          {u.bio && <p className="text-xs text-text-muted truncate">{u.bio}</p>}
                        </div>
                      </a>
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
                    </div>
                  ))}
                </div>
              )}

              {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
                <div className="text-center py-8">
                  <span className="text-3xl block mb-2">🔍</span>
                  <p className="text-sm text-text-muted">No users found</p>
                </div>
              )}

              {!searchQuery && (
                <div className="text-center py-8">
                  <span className="text-3xl block mb-2">👥</span>
                  <p className="text-sm text-text-muted">Find people to follow</p>
                  <p className="text-xs text-text-muted/60 mt-1">Search by username</p>
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
              </div>

              {/* Edit form */}
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
                  <div className="space-y-2">
                    {socials.map((s, i) => (
                      <div key={i} className="flex gap-2">
                        <select
                          value={s.platform}
                          onChange={(e) => updateSocial(i, "platform", e.target.value)}
                          className="w-24 sm:w-32 rounded-lg bg-surface border border-border px-2 py-2 text-xs sm:text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent/50"
                        >
                          <option value="">Platform</option>
                          <option value="instagram">Instagram</option>
                          <option value="twitter">Twitter/X</option>
                          <option value="tiktok">TikTok</option>
                          <option value="youtube">YouTube</option>
                          <option value="github">GitHub</option>
                          <option value="linkedin">LinkedIn</option>
                          <option value="snapchat">Snapchat</option>
                          <option value="telegram">Telegram</option>
                          <option value="website">Website</option>
                        </select>
                        <input
                          type="url"
                          value={s.url}
                          onChange={(e) => updateSocial(i, "url", e.target.value)}
                          placeholder="https://..."
                          className="flex-1 min-w-0 rounded-lg bg-surface border border-border px-2 py-2 text-xs sm:text-sm text-text placeholder:text-text-muted/40 focus:outline-none focus:ring-2 focus:ring-accent/50"
                        />
                        <button
                          onClick={() => removeSocial(i)}
                          className="w-8 h-8 rounded-lg border border-border text-text-muted hover:text-red-400 hover:border-red-400/50 transition-colors flex items-center justify-center shrink-0 text-sm"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    {socials.length < 10 && (
                      <button onClick={addSocial} className="text-xs text-accent">+ Add link</button>
                    )}
                  </div>
                </div>

                <button
                  onClick={saveProfile}
                  disabled={profileSaving}
                  className="w-full rounded-xl bg-accent px-4 py-3 text-sm font-bold text-black hover:scale-[1.01] transition-all disabled:opacity-50"
                >
                  {profileSaving ? "Saving..." : profileSaved ? "Saved ✓" : "Save profile"}
                </button>
              </div>

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
        </div>
      </div>

      {/* ─── Bottom Navigation (mobile) / Side tabs (desktop) ─── */}
      <nav className="fixed bottom-0 left-0 right-0 sm:relative sm:bottom-auto bg-surface border-t border-border/50 z-30 sm:hidden">
        <div className="flex items-center justify-around px-2 py-2 max-w-lg mx-auto">
          {[
            { id: "inbox" as const, icon: "📥", label: "Inbox" },
            { id: "search" as const, icon: "🔍", label: "Search" },
            { id: "map" as const, icon: "🗺️", label: "Map" },
            { id: "messages" as const, icon: "💬", label: "DMs" },
            { id: "profile" as const, icon: "👤", label: "Profile" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => {
                if (item.id === "map") { window.location.href = "/map"; return; }
                if (item.id === "messages") { window.location.href = "/messages"; return; }
                setActiveTab(item.id);
              }}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all ${
                activeTab === item.id
                  ? "text-accent"
                  : "text-text-muted"
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Desktop tab bar (hidden on mobile, shown sm+) */}
      <nav className="hidden sm:block fixed bottom-0 left-0 right-0 bg-surface border-t border-border/50 z-30">
        <div className="flex items-center justify-center gap-1 px-4 py-2 max-w-2xl mx-auto">
          {[
            { id: "inbox" as const, icon: "📥", label: "Inbox" },
            { id: "search" as const, icon: "🔍", label: "Search" },
            { id: "map" as const, icon: "🗺️", label: "Map" },
            { id: "messages" as const, icon: "💬", label: "Messages" },
            { id: "profile" as const, icon: "👤", label: "Profile" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => {
                if (item.id === "map") { window.location.href = "/map"; return; }
                if (item.id === "messages") { window.location.href = "/messages"; return; }
                setActiveTab(item.id);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                activeTab === item.id
                  ? "bg-accent/10 text-accent"
                  : "text-text-muted hover:text-text hover:bg-surface-raised"
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </main>
  );
}
