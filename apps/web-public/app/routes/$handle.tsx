import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import {
  useLoaderData,
  useActionData,
  useFetcher,
  Link,
  useSearchParams,
  type ClientLoaderFunctionArgs,
} from "@remix-run/react";
import { useState, useEffect } from "react";
import { ThemeToggle } from "../components/ThemeToggle";
import { ProfileView } from "../components/ProfileView";
import { ProfileSecretForm } from "../components/ProfileSecretForm";
import { ProfileEditForm } from "../components/ProfileEditForm";
import { ProfileShareModal } from "../components/ProfileShareModal";
import { ProfileStatsModal } from "../components/ProfileStatsModal";
import { getToken } from "../lib/session.server";
import { API_URL } from "../lib/api.server";
import { getApiBase } from "../lib/api.client";
import { resolveProfileViewMode } from "@secretlink/core/profile-types";
import { FollowListModal, type FollowListTab } from "../components/FollowListModal";
import { ProfileActionSheet } from "../components/ProfileActionSheet";
import type { UserLite } from "../lib/users";
import { UI_FEATURES } from "../lib/feature-flags";
import { ProfilePageSkeleton } from "../components/DashboardSkeleton";

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
  const token = await getToken(request);
  const isLoggedIn = !!token;

  const res = await fetch(`${API_URL}/v1/users/${handle}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  const profile = res.ok ? await res.json() : null;

  let isOwnProfile = false;
  let ownHandle: string | null = null;
  if (token) {
    const meRes = await fetch(`${API_URL}/v1/users/me/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (meRes.ok) {
      const me = await meRes.json();
      ownHandle = me.handle ?? null;
      isOwnProfile = me.handle?.toLowerCase() === handle.toLowerCase();
    }
  }

  return json({
    handle,
    profile,
    isLoggedIn,
    isOwnProfile,
    ownHandle,
    token: token ?? null,
    apiBase: new URL(request.url).origin,
    notFound: !profile,
  });
}

export async function clientLoader({ serverLoader }: ClientLoaderFunctionArgs) {
  return serverLoader<typeof loader>();
}
clientLoader.hydrate = true;

export function HydrateFallback() {
  return <ProfilePageSkeleton />;
}

export async function action({ request, params }: ActionFunctionArgs) {
  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "save-profile") {
    const token = await getToken(request);
    if (!token) {
      return json({ error: "Unauthorized", intent: "save-profile" }, { status: 401 });
    }
    const bio = String(form.get("bio") ?? "");
    const socials = JSON.parse(String(form.get("socials") ?? "[]"));
    const res = await fetch(`${API_URL}/v1/users/me/profile`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ bio, socials }),
    });
    if (!res.ok) {
      return json({ error: "Failed to save profile", intent: "save-profile" });
    }
    return json({ error: null, intent: "save-profile" });
  }

  const ciphertext = String(form.get("ciphertext") ?? "").trim();
  const nonce = String(form.get("nonce") ?? "").trim();
  const handle = (params["handle"] ?? "").replace(/^@/, "");
  const linkExpiry = Number(form.get("linkExpiry")) || 86400;
  const viewDuration = Number(form.get("viewDuration")) || 30;
  const keyBase64 = String(form.get("keyBase64") ?? "").trim();
  const wrappedKey = String(form.get("wrappedKey") ?? "").trim();
  const wrapNonce = String(form.get("wrapNonce") ?? "").trim();
  const wrapEpk = String(form.get("wrapEpk") ?? "").trim();

  if (!ciphertext || !nonce || !keyBase64) {
    return json({ error: "Encryption failed. Please try again.", sent: false });
  }

  if (!wrappedKey || !wrapNonce || !wrapEpk) {
    return json({
      error: "This user hasn't set up secure delivery yet. Ask them to open their dashboard once, then try again.",
      sent: false,
    });
  }

  const senderToken = await getToken(request);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (senderToken) headers["Authorization"] = `Bearer ${senderToken}`;

  const res = await fetch(`${API_URL}/v1/secrets`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      ciphertext,
      contentType: "text",
      nonce,
      ttlSeconds: linkExpiry,
      maxViews: 1,
      mimeType: "text/plain",
      viewDurationSeconds: viewDuration,
      recipientHandle: handle,
      wrappedKey,
      wrapNonce,
      wrapEpk,
    }),
  });

  if (!res.ok) {
    return json({ error: "Failed to send secret. Try again.", sent: false });
  }

  const secretData = await res.json();
  return json({ error: null, sent: true, handle, secretId: secretData.id, keyBase64 });
}

export default function ProfilePage() {
  const {
    handle,
    profile,
    isLoggedIn,
    isOwnProfile,
    ownHandle,
    token,
    apiBase,
    notFound,
  } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const secretFetcher = useFetcher<typeof action>();
  const profileFetcher = useFetcher<{ error?: string | null; intent?: string }>();
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(profile?.followersCount ?? 0);
  const [followModal, setFollowModal] = useState<FollowListTab | null>(null);
  const [sheetUser, setSheetUser] = useState<UserLite | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [socials, setSocials] = useState<{ platform: string; url: string }[]>(profile?.socials ?? []);
  const [searchParams] = useSearchParams();

  const mode = resolveProfileViewMode(isLoggedIn, isOwnProfile);
  const profileHref = ownHandle ? `/${ownHandle}` : "/dashboard#profile";

  useEffect(() => {
    if (searchParams.get("src") !== "qr" || isOwnProfile || !handle) return;
    fetch(`${getApiBase()}/v1/users/track/qr/${encodeURIComponent(handle)}`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    }).catch(() => {});
  }, [searchParams, isOwnProfile, handle, token]);

  const secretFetcherData = secretFetcher.data;
  const isSent =
    (secretFetcherData && "sent" in secretFetcherData && secretFetcherData.sent) ||
    (actionData && "sent" in actionData && actionData.sent);
  const profileSaving = profileFetcher.state !== "idle";

  useEffect(() => {
    setBio(profile?.bio ?? "");
    setSocials(profile?.socials ?? []);
  }, [profile?.bio, profile?.socials]);

  useEffect(() => {
    if (
      profileFetcher.state === "idle" &&
      profileFetcher.data &&
      !profileFetcher.data.error &&
      profileFetcher.data.intent === "save-profile"
    ) {
      setEditingProfile(false);
    }
  }, [profileFetcher.state, profileFetcher.data]);

  function startEditProfile() {
    setBio(profile?.bio ?? "");
    setSocials(profile?.socials ?? []);
    setEditingProfile(true);
  }

  function cancelEditProfile() {
    setBio(profile?.bio ?? "");
    setSocials(profile?.socials ?? []);
    setEditingProfile(false);
  }

  function saveProfile() {
    profileFetcher.submit(
      {
        intent: "save-profile",
        bio,
        socials: JSON.stringify(socials.filter((s) => s.url.trim())),
      },
      { method: "post" },
    );
  }

  useEffect(() => {
    if (!token || !profile?.id || isOwnProfile) return;
    fetch(`${getApiBase()}/v1/users/follow/${profile.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setIsFollowing(data.isFollowing);
          setFollowersCount(data.followersCount);
        }
      })
      .catch(() => {});
  }, [token, profile?.id, isOwnProfile]);

  useEffect(() => {
    if (isOwnProfile && profile?.followersCount != null) {
      setFollowersCount(profile.followersCount);
    }
  }, [isOwnProfile, profile?.followersCount]);

  async function toggleFollow() {
    if (!token || !profile?.id) {
      window.location.href = "/login";
      return;
    }
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

  if (notFound) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-4">
        <Nav isLoggedIn={isLoggedIn} />
        <div className="text-center pt-24">
          <span className="text-5xl mb-4 block">👻</span>
          <h1 className="text-2xl font-bold mb-2">User not found</h1>
          <p className="text-text-muted mb-6">@{handle} doesn&apos;t exist on Secretlink.life</p>
          <Link to="/" className="text-accent text-sm font-semibold hover:underline">
            Go home →
          </Link>
        </div>
      </main>
    );
  }

  if (isSent) {
    return (
      <main className={isLoggedIn ? "h-screen flex flex-col sm:flex-row bg-surface" : "min-h-screen flex flex-col"}>
        {isLoggedIn ? (
          <>
            <Sidebar profileHref={profileHref} />
            <header className="sm:hidden flex items-center justify-between px-4 py-3 border-b border-border/50 bg-surface shrink-0">
              <Link to="/dashboard" className="flex items-center gap-2">
                <img src="/secretlink.png" alt="" className="w-7 h-7" />
                <span className="text-lg font-bold tracking-tight">
                  secretlink<span className="text-accent">.</span>life
                </span>
              </Link>
              <ThemeToggle />
            </header>
          </>
        ) : (
          <Nav isLoggedIn={isLoggedIn} />
        )}
        <div
          className={`flex flex-col items-center justify-center flex-1 min-h-0 px-4 ${
            isLoggedIn ? "pt-8 pb-20 sm:pb-8" : "pt-24 pb-16"
          }`}
        >
          <div className="max-w-md w-full text-center">
            <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">✓</span>
            </div>
            <h1 className="text-2xl font-bold mb-2">Secret sent!</h1>
            <p className="text-text-muted mb-8">
              Your anonymous message has been delivered to{" "}
              <span className="text-accent">@{handle}</span>. It will self-destruct after being read.
            </p>
            <Link
              to={`/${handle}`}
              className="inline-flex rounded-full bg-accent px-6 py-3 text-sm font-bold text-black hover:scale-[1.02] transition-all"
            >
              Send another →
            </Link>
          </div>
        </div>
        {isLoggedIn && <MobileBottomNav profileHref={profileHref} />}
      </main>
    );
  }

  return (
    <main className={isLoggedIn ? "h-screen flex flex-col sm:flex-row bg-surface" : "min-h-screen"}>
      {isLoggedIn ? (
        <>
          <Sidebar profileHref={profileHref} />
          <header className="sm:hidden flex items-center justify-between px-4 py-3 border-b border-border/50 bg-surface shrink-0">
            <Link to="/dashboard" className="flex items-center gap-2">
              <img src="/secretlink.png" alt="" className="w-7 h-7" />
              <span className="text-lg font-bold tracking-tight">
                secretlink<span className="text-accent">.</span>life
              </span>
            </Link>
            <ThemeToggle />
          </header>
        </>
      ) : (
        <Nav isLoggedIn={isLoggedIn} />
      )}

      <div className={isLoggedIn ? "flex-1 overflow-y-auto" : ""}>
        <div className={`max-w-lg mx-auto px-4 ${isLoggedIn ? "pt-8 pb-20 sm:pb-8" : "pt-24 pb-16"}`}>
          <ProfileView
            profile={profile}
            handle={handle}
            mode={mode}
            apiBase={apiBase}
            followersCount={followersCount}
            followingCount={profile?.followingCount ?? 0}
            isFollowing={isFollowing}
            onFollow={toggleFollow}
            onFollowersClick={() => setFollowModal("followers")}
            onFollowingClick={() => setFollowModal("following")}
            onShare={isOwnProfile ? () => setShareOpen(true) : undefined}
            onStats={isOwnProfile ? () => setStatsOpen(true) : undefined}
            onEdit={isOwnProfile && !editingProfile ? startEditProfile : undefined}
          />

          {isOwnProfile && editingProfile && (
            <ProfileEditForm
              bio={bio}
              socials={socials}
              onBioChange={setBio}
              onSocialsChange={setSocials}
              onSave={saveProfile}
              onCancel={cancelEditProfile}
              saving={profileSaving}
            />
          )}

          {!isOwnProfile && (
            <ProfileSecretForm recipientPublicKey={profile?.dmPublicKey} fetcher={secretFetcher} />
          )}

          {!isLoggedIn && (
            <div className="text-center mt-8">
              <p className="text-sm text-text-muted mb-2">Want your own anonymous inbox?</p>
              <Link
                to="/signup"
                className="inline-flex rounded-full border border-border px-5 py-2 text-sm font-semibold text-text hover:border-accent hover:text-accent transition-all"
              >
                Get your @handle
              </Link>
            </div>
          )}
        </div>
      </div>

      {isLoggedIn && <MobileBottomNav profileHref={profileHref} />}

      {isOwnProfile && token && followModal && (
        <FollowListModal
          token={token}
          initialTab={followModal}
          onClose={() => setFollowModal(null)}
          onSelectUser={(u) => {
            setFollowModal(null);
            if (!u.isSelf) setSheetUser(u);
          }}
        />
      )}

      {sheetUser && (
        <ProfileActionSheet user={sheetUser} onClose={() => setSheetUser(null)} />
      )}

      {isOwnProfile && handle && shareOpen && (
        <ProfileShareModal handle={handle} onClose={() => setShareOpen(false)} />
      )}
      {isOwnProfile && token && statsOpen && (
        <ProfileStatsModal token={token} onClose={() => setStatsOpen(false)} />
      )}
    </main>
  );
}

function Sidebar({ profileHref }: { profileHref: string }) {
  const navItems = [
    { id: "inbox", label: "Home", href: "/dashboard", icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /></svg> },
    { id: "map", label: "Map", href: "/dashboard#map", icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503-11.307l4.994-2.497A.75.75 0 0121 4.196v13.608a.75.75 0 01-.497.708l-5.006 2.503m-6.994-3.015l-5.006 2.503A.75.75 0 013 19.804V6.196a.75.75 0 01.497-.708l5.006-2.503m6.994 3.015L9 4.485m6.497 1.53L9 8.515" /></svg> },
    ...(UI_FEATURES.messages ? [{ id: "messages", label: "Messages", href: "/dashboard#messages", icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443h.004c2.174-.063 4.322-.258 6.426-.573 1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" /></svg> }] : []),
    { id: "profile", label: "Profile", href: profileHref, icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg> },
  ];

  return (
    <aside className="hidden sm:flex flex-col w-56 lg:w-64 border-r border-border/50 bg-surface shrink-0">
      <div className="px-5 py-5 border-b border-border/50">
        <Link to="/dashboard" className="flex items-center gap-2">
          <img src="/secretlink.png" alt="" className="w-7 h-7" />
          <span className="text-lg font-bold tracking-tight">
            secretlink<span className="text-accent">.</span>life
          </span>
        </Link>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.id}
            to={item.href}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-text-muted hover:text-text hover:bg-surface-raised transition-all"
          >
            {item.icon}
            <span>{item.label}</span>
          </Link>
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

function MobileBottomNav({ profileHref }: { profileHref: string }) {
  return (
    <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-surface border-t border-border/50 z-30">
      <div className="flex items-center justify-around px-2 py-2 max-w-lg mx-auto">
        <Link to="/dashboard" className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl text-text-muted">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /></svg>
          <span className="text-[10px] font-medium">Home</span>
        </Link>
        <Link to="/dashboard#map" className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl text-text-muted">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503-11.307l4.994-2.497A.75.75 0 0121 4.196v13.608a.75.75 0 01-.497.708l-5.006 2.503m-6.994-3.015l-5.006 2.503A.75.75 0 013 19.804V6.196a.75.75 0 01.497-.708l5.006-2.503m6.994 3.015L9 4.485m6.497 1.53L9 8.515" /></svg>
          <span className="text-[10px] font-medium">Map</span>
        </Link>
        {UI_FEATURES.messages && (
        <Link to="/messages" className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl text-text-muted">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443h.004c2.174-.063 4.322-.258 6.426-.573 1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" /></svg>
          <span className="text-[10px] font-medium">Messages</span>
        </Link>
        )}
        <Link to={profileHref} className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl text-accent">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>
          <span className="text-[10px] font-medium">Profile</span>
        </Link>
      </div>
    </nav>
  );
}

function Nav({ isLoggedIn }: { isLoggedIn: boolean }) {
  return (
    <nav className={`${isLoggedIn ? "sm:hidden" : ""} fixed top-0 left-0 right-0 flex items-center justify-between px-4 py-3 bg-surface/90 backdrop-blur-md z-10 border-b border-border/50`}>
      <Link to="/" className="flex items-center gap-2">
        <img src="/secretlink.png" alt="Secretlink.life" className="w-7 h-7" />
        <span className="text-lg font-bold tracking-tight">
          secretlink<span className="text-accent">.</span>life
        </span>
      </Link>
      <div className="flex items-center gap-3">
        <ThemeToggle />
        {!isLoggedIn && (
          <Link
            to="/login"
            className="rounded-full bg-accent px-3 py-1.5 text-sm font-bold text-black hover:scale-[1.03] transition-all"
          >
            Sign in
          </Link>
        )}
      </div>
    </nav>
  );
}
