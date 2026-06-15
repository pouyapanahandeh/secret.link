import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useActionData, useFetcher } from "@remix-run/react";
import { useState, useEffect } from "react";
import { ThemeToggle } from "../components/ThemeToggle";
import { getToken } from "../lib/session.server";
import { API_URL } from "../lib/api.server";
import { getApiBase } from "../lib/api.client";

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  return [
    { title: `@${data?.profile?.handle ?? data?.handle} — Secretlink.life` },
    {
      name: "description",
      content: `Send an anonymous secret to @${data?.profile?.handle ?? data?.handle} on Secretlink.life. It burns after one read.`,
    },
    { property: "og:title", content: `@${data?.profile?.handle ?? data?.handle} — Secretlink.life` },
    {
      property: "og:description",
      content: data?.profile?.bio ?? "Send me a secret. It burns after I read it.",
    },
  ];
};

export async function loader({ params, request }: LoaderFunctionArgs) {
  const rawHandle = params["handle"] ?? "";
  const handle = rawHandle.replace(/^@/, "");
  const res = await fetch(`${API_URL}/v1/users/${handle}`);
  const profile = res.ok ? await res.json() : null;
  const token = await getToken(request);
  const isLoggedIn = !!token;

  let isOwnProfile = false;
  if (token) {
    const meRes = await fetch(`${API_URL}/v1/users/me/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (meRes.ok) {
      const me = await meRes.json();
      isOwnProfile = me.handle?.toLowerCase() === handle.toLowerCase();
    }
  }

  return json({ handle, profile, isLoggedIn, isOwnProfile, token: token ?? null });
}

export async function action({ request, params }: ActionFunctionArgs) {
  const form = await request.formData();
  const ciphertext = String(form.get("ciphertext") ?? "").trim();
  const nonce = String(form.get("nonce") ?? "").trim();
  const handle = (params["handle"] ?? "").replace(/^@/, "");
  const linkExpiry = Number(form.get("linkExpiry")) || 86400;
  const viewDuration = Number(form.get("viewDuration")) || 30;
  const keyBase64 = String(form.get("keyBase64") ?? "").trim();

  if (!ciphertext || !nonce || !keyBase64) {
    return json({ error: "Encryption failed. Please try again.", sent: false });
  }

  const res = await fetch(`${API_URL}/v1/secrets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ciphertext,
      contentType: "text",
      nonce,
      ttlSeconds: linkExpiry,
      maxViews: 1,
      mimeType: "text/plain",
      viewDurationSeconds: viewDuration,
      recipientHandle: handle,
    }),
  });

  if (!res.ok) {
    return json({ error: "Failed to send secret. Try again.", sent: false });
  }

  const secretData = await res.json();
  return json({ error: null, sent: true, handle, secretId: secretData.id, keyBase64 });
}

const SOCIAL_ICONS: Record<string, string> = {
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

export default function ProfilePage() {
  const { handle, profile, isLoggedIn, isOwnProfile, token } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const fetcher = useFetcher<typeof action>();
  const [charCount, setCharCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(profile?.followersCount ?? 0);
  const [encrypting, setEncrypting] = useState(false);
  const [encryptError, setEncryptError] = useState<string | null>(null);

  const fetcherData = fetcher.data;
  const isSent = fetcherData?.sent || actionData?.sent;
  const formError = fetcherData?.error || actionData?.error || encryptError;

  async function handleSecretSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setEncryptError(null);
    setEncrypting(true);

    try {
      const formEl = e.currentTarget;
      const formData = new FormData(formEl);
      const message = String(formData.get("message") ?? "").trim();

      if (!message) {
        setEncryptError("Secret cannot be empty");
        setEncrypting(false);
        return;
      }
      if (message.length > 10000) {
        setEncryptError("Secret too long (max 10,000 characters)");
        setEncrypting(false);
        return;
      }

      const { encryptBlob, generateKeyBase64 } = await import("../lib/crypto");
      const { key, keyBase64 } = await generateKeyBase64();
      const encoder = new TextEncoder();
      const data = encoder.encode(message);
      const { ciphertext, nonce } = await encryptBlob(data, key);

      // Encode encrypted bytes as base64
      let binary = "";
      for (let i = 0; i < ciphertext.length; i++) {
        binary += String.fromCharCode(ciphertext[i]!);
      }
      const ciphertextB64 = btoa(binary);

      const submitData = new FormData();
      submitData.append("ciphertext", ciphertextB64);
      submitData.append("nonce", nonce);
      submitData.append("keyBase64", keyBase64);
      submitData.append("linkExpiry", String(formData.get("linkExpiry") ?? "86400"));
      submitData.append("viewDuration", String(formData.get("viewDuration") ?? "30"));

      fetcher.submit(submitData, { method: "post" });
    } catch {
      setEncryptError("Encryption failed. Please try again.");
    } finally {
      setEncrypting(false);
    }
  }

  useEffect(() => {
    if (!token || !profile?.id || isOwnProfile) return;
    fetch(`${getApiBase()}/v1/users/follow/${profile.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setIsFollowing(data.isFollowing);
          setFollowersCount(data.followersCount);
        }
      })
      .catch(() => {});
  }, [token, profile?.id, isOwnProfile]);

  async function toggleFollow() {
    if (!token || !profile?.id) { window.location.href = "/login"; return; }
    const method = isFollowing ? "DELETE" : "POST";
    const res = await fetch(`${getApiBase()}/v1/users/follow/${profile.id}`, {
      method,
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setIsFollowing(data.following);
      setFollowersCount(data.followersCount);
    }
  }

  if (isSent) {
    return (
      <main className={isLoggedIn ? "h-screen flex flex-col sm:flex-row bg-surface" : "min-h-screen"}>
        {isLoggedIn ? <Sidebar /> : <Nav isLoggedIn={isLoggedIn} handle={handle} />}
        <div className="flex flex-col items-center justify-center flex-1 min-h-0 px-4">
          <div className="max-w-md w-full text-center">
            <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">✓</span>
            </div>
            <h1 className="text-2xl font-bold mb-2">Secret sent!</h1>
            <p className="text-text-muted mb-8">
              Your anonymous message has been delivered to <span className="text-accent">@{handle}</span>.
              It will self-destruct after being read.
            </p>
            <a
              href={`/${handle}`}
              className="inline-flex rounded-full bg-accent px-6 py-3 text-sm font-bold text-black hover:scale-[1.02] transition-all"
            >
              Send another →
            </a>
          </div>
        </div>
        {isLoggedIn && <MobileBottomNav handle={handle} />}
      </main>
    );
  }

  return (
    <main className={isLoggedIn ? "h-screen flex flex-col sm:flex-row bg-surface" : "min-h-screen"}>
      {isLoggedIn ? (
        <>
          <Sidebar />
          {/* Mobile header for logged-in */}
          <header className="sm:hidden flex items-center justify-between px-4 py-3 border-b border-border/50 bg-surface shrink-0">
            <a href="/dashboard" className="flex items-center gap-2">
              <img src="/secretlink.png" alt="" className="w-7 h-7" />
              <span className="text-lg font-bold tracking-tight">
                secretlink<span className="text-accent">.</span>life
              </span>
            </a>
            <ThemeToggle />
          </header>
        </>
      ) : (
        <Nav isLoggedIn={isLoggedIn} handle={handle} />
      )}

      <div className={isLoggedIn ? "flex-1 overflow-y-auto" : ""}>
        <div className={`max-w-lg mx-auto px-4 ${isLoggedIn ? "pt-8 pb-20 sm:pb-8" : "pt-24 pb-16"}`}>
        {/* Profile Card */}
        <div className="text-center mb-8">
          {/* Avatar */}
          <div className="w-20 h-20 rounded-full bg-accent/20 border-2 border-accent flex items-center justify-center mx-auto mb-4">
            {profile?.avatarUrl ? (
              <img src={profile.avatarUrl} alt={`@${handle}`} className="w-full h-full rounded-full object-cover" />
            ) : (
              <span className="text-3xl font-bold text-accent">
                {(handle ?? "?")[0]?.toUpperCase()}
              </span>
            )}
          </div>

          {/* Handle */}
          <h1 className="text-2xl font-bold">@{handle}</h1>

          {/* Follower counts — visible for own profile or logged-in others */}
          {(isOwnProfile || isLoggedIn) && (
            <div className="flex items-center justify-center gap-4 mt-2">
              <span className="text-xs text-text-muted"><strong className="text-text">{followersCount}</strong> followers</span>
              <span className="text-xs text-text-muted"><strong className="text-text">{profile?.followingCount ?? 0}</strong> following</span>
            </div>
          )}

          {/* Follow button — only for logged-in users viewing someone else */}
          {isLoggedIn && !isOwnProfile && (
            <button
              onClick={toggleFollow}
              className={`mt-3 text-xs px-5 py-2 rounded-full font-semibold transition-all ${
                isFollowing
                  ? "bg-surface-raised border border-border text-text-muted hover:border-red-400/50 hover:text-red-400"
                  : "bg-accent text-black hover:scale-[1.02]"
              }`}
            >
              {isFollowing ? "Following ✓" : "Follow"}
            </button>
          )}

          {/* Bio */}
          {profile?.bio && (
            <p className="text-text-muted mt-2 max-w-sm mx-auto text-sm leading-relaxed">
              {profile.bio}
            </p>
          )}

          {/* Social links */}
          {profile?.socials && profile.socials.length > 0 && (
            <div className="flex items-center justify-center gap-3 mt-4">
              {profile.socials.map((s: { platform: string; url: string }, i: number) => (
                <a
                  key={i}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-full bg-surface-raised border border-border flex items-center justify-center hover:border-accent/50 hover:scale-110 transition-all"
                  title={s.platform}
                >
                  <span className="text-sm">{SOCIAL_ICONS[s.platform.toLowerCase()] ?? "🔗"}</span>
                </a>
              ))}
            </div>
          )}

          {/* Pro badge */}
          {profile?.isPro && (
            <span className="inline-flex items-center gap-1 mt-3 text-xs bg-accent/10 text-accent px-3 py-1 rounded-full">
              ⭐ Pro
            </span>
          )}

          {/* DM button — only for logged-in users viewing someone else */}
          {isLoggedIn && !isOwnProfile && (
            <a
              href={`/messages?to=${profile?.handle ?? handle}`}
              className="inline-flex items-center gap-2 mt-4 text-xs bg-surface-raised border border-border hover:border-accent/50 text-text px-4 py-2 rounded-full transition-colors"
            >
              🔒 Send encrypted message
            </a>
          )}

          {/* Edit profile link for own profile */}
          {isOwnProfile && (
            <a
              href="/dashboard#profile"
              className="inline-flex items-center gap-2 mt-4 text-xs bg-surface-raised border border-border hover:border-accent/50 text-text px-4 py-2 rounded-full transition-colors"
            >
              ✏️ Edit profile
            </a>
          )}
        </div>

        {/* Anonymous Secret Box — only for others */}
        {!isOwnProfile && (
        <div className="bg-surface-raised rounded-2xl border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">👻</span>
            <h2 className="font-semibold text-sm">Send an anonymous secret</h2>
          </div>

          <form onSubmit={handleSecretSubmit} className="space-y-4">
            <div className="relative">
              <textarea
                name="message"
                rows={4}
                required
                maxLength={10000}
                placeholder="Type your secret message..."
                onChange={(e) => setCharCount(e.target.value.length)}
                className="w-full rounded-xl bg-surface border border-border px-4 py-3 text-text placeholder:text-text-muted/40 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 resize-none transition-all"
              />
              {charCount > 0 && (
                <span className="absolute bottom-3 right-3 text-xs text-text-muted">
                  {charCount}/10000
                </span>
              )}
            </div>

            {/* Settings row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-text-muted mb-1">Link expires in</label>
                <select
                  name="linkExpiry"
                  className="w-full rounded-xl bg-surface border border-border px-3 py-2 text-sm text-text"
                >
                  <option value="300">5 minutes</option>
                  <option value="3600">1 hour</option>
                  <option value="86400" selected>24 hours</option>
                  <option value="604800">7 days</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">View time</label>
                <select
                  name="viewDuration"
                  className="w-full rounded-xl bg-surface border border-border px-3 py-2 text-sm text-text"
                >
                  <option value="10">10 seconds</option>
                  <option value="30" selected>30 seconds</option>
                  <option value="60">1 minute</option>
                  <option value="120">2 minutes</option>
                </select>
              </div>
            </div>

            {formError && (
              <p className="text-red-400 text-sm">{formError}</p>
            )}

            <button
              type="submit"
              disabled={encrypting || fetcher.state === "submitting"}
              className="w-full rounded-full bg-accent px-6 py-3 text-sm font-bold text-black hover:scale-[1.02] transition-all duration-200 disabled:opacity-50"
            >
              {encrypting || fetcher.state === "submitting" ? "Encrypting..." : "Send anonymously 🤫"}
            </button>
          </form>

          <p className="text-xs text-text-muted text-center mt-4">
            🔒 End-to-end encrypted · Burns after one read · Completely anonymous
          </p>
        </div>
        )}

        {/* Get your own handle CTA — only for non-logged-in users */}
        {!isLoggedIn && (
        <div className="text-center mt-8">
          <p className="text-sm text-text-muted mb-2">Want your own anonymous inbox?</p>
          <a
            href="/signup"
            className="inline-flex rounded-full border border-border px-5 py-2 text-sm font-semibold text-text hover:border-accent hover:text-accent transition-all"
          >
            Get your @handle
          </a>
        </div>
        )}
      </div>
      </div>
      {isLoggedIn && <MobileBottomNav handle={handle} />}
    </main>
  );
}

function Sidebar() {
  const navItems = [
    { id: "inbox", label: "Home", href: "/dashboard", icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /></svg> },
    { id: "map", label: "Map", href: "/dashboard#map", icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503-11.307l4.994-2.497A.75.75 0 0121 4.196v13.608a.75.75 0 01-.497.708l-5.006 2.503m-6.994-3.015l-5.006 2.503A.75.75 0 013 19.804V6.196a.75.75 0 01.497-.708l5.006-2.503m6.994 3.015L9 4.485m6.497 1.53L9 8.515" /></svg> },
    { id: "messages", label: "Messages", href: "/dashboard#messages", icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443h.004c2.174-.063 4.322-.258 6.426-.573 1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" /></svg> },
    { id: "profile", label: "Profile", href: "/dashboard#profile", icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg> },
  ];

  return (
    <aside className="hidden sm:flex flex-col w-56 lg:w-64 border-r border-border/50 bg-surface shrink-0">
      <div className="px-5 py-5 border-b border-border/50">
        <a href="/dashboard" className="flex items-center gap-2">
          <img src="/secretlink.png" alt="" className="w-7 h-7" />
          <span className="text-lg font-bold tracking-tight">
            secretlink<span className="text-accent">.</span>life
          </span>
        </a>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => (
          <a
            key={item.id}
            href={item.href}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-text-muted hover:text-text hover:bg-surface-raised transition-all"
          >
            {item.icon}
            <span>{item.label}</span>
          </a>
        ))}
      </nav>
      <div className="px-3 py-4 border-t border-border/50 space-y-2">
        <div className="flex items-center justify-between px-3">
          <ThemeToggle />
          <form method="post" action="/logout">
            <button type="submit" className="text-xs text-text-muted hover:text-text">Log out</button>
          </form>
        </div>
      </div>
    </aside>
  );
}

function MobileBottomNav({ handle }: { handle: string }) {
  return (
    <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-surface border-t border-border/50 z-30">
      <div className="flex items-center justify-around px-2 py-2 max-w-lg mx-auto">
        <a href="/dashboard" className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl text-text-muted">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /></svg>
          <span className="text-[10px] font-medium">Home</span>
        </a>
        <a href="/dashboard#map" className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl text-text-muted">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503-11.307l4.994-2.497A.75.75 0 0121 4.196v13.608a.75.75 0 01-.497.708l-5.006 2.503m-6.994-3.015l-5.006 2.503A.75.75 0 013 19.804V6.196a.75.75 0 01.497-.708l5.006-2.503m6.994 3.015L9 4.485m6.497 1.53L9 8.515" /></svg>
          <span className="text-[10px] font-medium">Map</span>
        </a>
        <a href="/messages" className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl text-text-muted">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443h.004c2.174-.063 4.322-.258 6.426-.573 1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" /></svg>
          <span className="text-[10px] font-medium">Messages</span>
        </a>
        <a href={`/${handle}`} className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl text-accent">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>
          <span className="text-[10px] font-medium">Profile</span>
        </a>
      </div>
    </nav>
  );
}

function Nav({ isLoggedIn, handle: _handle }: { isLoggedIn: boolean; handle: string }) {
  return (
    <nav className={`${isLoggedIn ? "sm:hidden" : ""} fixed top-0 left-0 right-0 flex items-center justify-between px-4 py-3 bg-surface/90 backdrop-blur-md z-10 border-b border-border/50`}>
      <a href="/" className="flex items-center gap-2">
        <img src="/secretlink.png" alt="Secretlink.life" className="w-7 h-7" />
        <span className="text-lg font-bold tracking-tight">
          secretlink<span className="text-accent">.</span>life
        </span>
      </a>
      <div className="flex items-center gap-3">
        <ThemeToggle />
        {!isLoggedIn && (
          <a
            href="/login"
            className="rounded-full bg-accent px-3 py-1.5 text-sm font-bold text-black hover:scale-[1.03] transition-all"
          >
            Sign in
          </a>
        )}
      </div>
    </nav>
  );
}
