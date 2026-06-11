import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useActionData, useNavigation } from "@remix-run/react";
import { useState } from "react";
import { ThemeToggle } from "../components/ThemeToggle";

const API_URL = process.env["API_URL"] ?? "http://localhost:4000";

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

export async function loader({ params }: LoaderFunctionArgs) {
  const handle = params["handle"];
  const res = await fetch(`${API_URL}/v1/users/${handle}`);
  const profile = res.ok ? await res.json() : null;
  return json({ handle, profile });
}

export async function action({ request, params }: ActionFunctionArgs) {
  const form = await request.formData();
  const message = String(form.get("message") ?? "").trim();
  const handle = params["handle"];

  if (!message) {
    return json({ error: "Secret cannot be empty", sent: false });
  }
  if (message.length > 10000) {
    return json({ error: "Secret too long (max 10,000 characters)", sent: false });
  }

  // TODO: encrypt client-side, call API gateway with recipient handle
  return json({ error: null, sent: true, handle });
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
  const { handle, profile } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const [charCount, setCharCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(profile?.followersCount ?? 0);

  function getApiBase() {
    if (typeof window === "undefined") return "";
    const origin = window.location.origin;
    return window.location.port === "3000" ? origin.replace(":3000", ":4000") : origin;
  }

  function getToken() {
    if (typeof document === "undefined") return "";
    return document.cookie.match(/sl_token=([^;]+)/)?.[1] ?? "";
  }

  async function toggleFollow() {
    const token = getToken();
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

  if (actionData?.sent) {
    return (
      <main className="min-h-screen">
        <Nav />
        <div className="flex flex-col items-center justify-center min-h-screen px-4">
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
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <Nav />

      <div className="max-w-lg mx-auto px-4 pt-24 pb-16">
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

          {/* Follower counts */}
          <div className="flex items-center justify-center gap-4 mt-2">
            <span className="text-xs text-text-muted"><strong className="text-text">{followersCount}</strong> followers</span>
            <span className="text-xs text-text-muted"><strong className="text-text">{profile?.followingCount ?? 0}</strong> following</span>
          </div>

          {/* Follow button */}
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

          {/* DM button */}
          <a
            href={`/messages?to=${profile?.handle}`}
            className="inline-flex items-center gap-2 mt-4 text-xs bg-surface-raised border border-border hover:border-accent/50 text-text px-4 py-2 rounded-full transition-colors"
          >
            🔒 Send encrypted message
          </a>
        </div>

        {/* Anonymous Secret Box */}
        <div className="bg-surface-raised rounded-2xl border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">👻</span>
            <h2 className="font-semibold text-sm">Send an anonymous secret</h2>
          </div>

          <form method="post" className="space-y-4">
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

            {actionData?.error && (
              <p className="text-red-400 text-sm">{actionData.error}</p>
            )}

            <button
              type="submit"
              disabled={navigation.state === "submitting"}
              className="w-full rounded-full bg-accent px-6 py-3 text-sm font-bold text-black hover:scale-[1.02] transition-all duration-200 disabled:opacity-50"
            >
              {navigation.state === "submitting" ? "Encrypting..." : "Send anonymously 🤫"}
            </button>
          </form>

          <p className="text-xs text-text-muted text-center mt-4">
            🔒 End-to-end encrypted · Burns after one read · Completely anonymous
          </p>
        </div>

        {/* Get your own handle CTA */}
        <div className="text-center mt-8">
          <p className="text-sm text-text-muted mb-2">Want your own anonymous inbox?</p>
          <a
            href="/signup"
            className="inline-flex rounded-full border border-border px-5 py-2 text-sm font-semibold text-text hover:border-accent hover:text-accent transition-all"
          >
            Get your @handle
          </a>
        </div>
      </div>
    </main>
  );
}

function Nav() {
  return (
    <nav className="fixed top-0 left-0 right-0 flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 bg-surface/90 backdrop-blur-md z-10 border-b border-border/50">
      <a href="/" className="flex items-center gap-2">
        <img src="/secretlink.png" alt="Secretlink.life" className="w-7 h-7 sm:w-8 sm:h-8" />
        <span className="text-lg sm:text-xl font-bold tracking-tight">
          secretlink<span className="text-accent">.</span>life
        </span>
      </a>
      <div className="flex items-center gap-3">
        <a href="/send" className="text-sm text-text-muted hover:text-text transition-colors">Send</a>
        <ThemeToggle />
        <a
          href="/login"
          className="rounded-full bg-accent px-3 sm:px-4 py-1.5 sm:py-2 text-sm font-bold text-black hover:scale-[1.03] transition-all"
        >
          Sign in
        </a>
      </div>
    </nav>
  );
}
