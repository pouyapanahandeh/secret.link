import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import {
  useLoaderData,
  useActionData,
  useFetcher,
  useNavigate,
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
import { ProfileSettingsModal } from "../components/ProfileSettingsModal";
import { getToken } from "../lib/session.server";
import { API_URL } from "../lib/api.server";
import { getApiBase } from "../lib/api.client";
import { resolveProfileViewMode } from "@secretlink/core/profile-types";
import { FollowListModal, type FollowListTab } from "../components/FollowListModal";
import { ProfileActionSheet } from "../components/ProfileActionSheet";
import { Avatar } from "../components/Avatar";
import type { UserLite } from "../lib/users";
import { UI_FEATURES } from "../lib/feature-flags";
import { ProfilePageSkeleton } from "../components/DashboardSkeleton";
import { DashboardMobileHeader } from "../features/dashboard/DashboardNav";

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  const handle = data?.profile?.handle ?? data?.handle ?? "user";
  const title = `@${handle} - Secretlink.life`;
  const description =
    data?.profile?.bio ||
    `Send an anonymous secret to @${handle} on Secretlink.life. It burns after one read.`;
  const origin = data?.apiBase ?? "https://secretlink.life";
  const url = `${origin}/${handle}`;
  const image = data?.profile?.avatarUrl || `${origin}/og/${encodeURIComponent(handle)}`;
  return [
    { title },
    { name: "description", content: description },
    { tagName: "link", rel: "canonical", href: url },
    { property: "og:type", content: "profile" },
    { property: "og:site_name", content: "Secretlink.life" },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:url", content: url },
    { property: "og:image", content: image },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: image },
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
  let ownAvatarUrl: string | null = null;
  if (token) {
    const meRes = await fetch(`${API_URL}/v1/users/me/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (meRes.ok) {
      const me = await meRes.json();
      ownHandle = me.handle ?? null;
      ownAvatarUrl = me.avatarUrl ?? null;
      isOwnProfile = me.handle?.toLowerCase() === handle.toLowerCase();
    }
  }

  // Short CDN/browser cache for anonymous public profiles; no-store when authed.
  const cacheControl = isLoggedIn
    ? "private, no-store"
    : "public, max-age=60, s-maxage=300, stale-while-revalidate=600";

  return json(
    {
      handle,
      profile,
      isLoggedIn,
      isOwnProfile,
      ownHandle,
      ownAvatarUrl,
      token: token ?? null,
      apiBase: new URL(request.url).origin,
      notFound: !profile,
    },
    { headers: { "Cache-Control": cacheControl } },
  );
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
    const avatarUrl = String(form.get("avatarUrl") ?? "");
    const res = await fetch(`${API_URL}/v1/users/me/profile`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ bio, socials, avatarUrl: avatarUrl || null }),
    });
    if (!res.ok) {
      return json({ error: "Failed to save profile", intent: "save-profile" });
    }
    return json({ error: null, intent: "save-profile" });
  }

  if (intent === "save-settings") {
    const token = await getToken(request);
    if (!token) {
      return json({ error: "Unauthorized", intent: "save-settings" }, { status: 401 });
    }
    const acceptsSecrets = form.get("acceptsSecrets") === "true";
    const res = await fetch(`${API_URL}/v1/users/me/profile`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ acceptsSecrets }),
    });
    if (!res.ok) {
      return json({ error: "Failed to save settings", intent: "save-settings" });
    }
    return json({ error: null, intent: "save-settings" });
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
  let wraps: Array<{ wrappedKey: string; wrapNonce: string; wrapEpk: string }> | undefined;
  try {
    const rawWraps = String(form.get("wraps") ?? "").trim();
    if (rawWraps) {
      const parsed = JSON.parse(rawWraps);
      if (Array.isArray(parsed) && parsed.length > 0) wraps = parsed;
    }
  } catch {
    wraps = undefined;
  }

  if (!ciphertext || !nonce || !keyBase64) {
    return json({ error: "Encryption failed. Please try again.", sent: false });
  }

  if ((!wrappedKey || !wrapNonce || !wrapEpk) && (!wraps || wraps.length === 0)) {
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
      wrappedKey: wrappedKey || wraps?.[0]?.wrappedKey,
      wrapNonce: wrapNonce || wraps?.[0]?.wrapNonce,
      wrapEpk: wrapEpk || wraps?.[0]?.wrapEpk,
      wraps,
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
    ownAvatarUrl,
    token,
    apiBase,
    notFound,
  } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const secretFetcher = useFetcher<typeof action>();
  const profileFetcher = useFetcher<{ error?: string | null; intent?: string }>();
  const navigate = useNavigate();
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(profile?.followersCount ?? 0);
  const [followModal, setFollowModal] = useState<FollowListTab | null>(null);
  const [sheetUser, setSheetUser] = useState<UserLite | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [socials, setSocials] = useState<{ platform: string; url: string }[]>(profile?.socials ?? []);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile?.avatarUrl ?? null);
  const [searchParams] = useSearchParams();
  const [showSentConfirmation, setShowSentConfirmation] = useState(false);

  const mode = resolveProfileViewMode(isLoggedIn, isOwnProfile);
  const profileHref = ownHandle ? `/${ownHandle}` : "/dashboard#profile";
  const navAvatarUrl = isOwnProfile ? avatarUrl : ownAvatarUrl;

  function handleMobileNav(id: string) {
    if (id === "profile") {
      navigate(profileHref);
      return;
    }
    if (id === "messages") {
      navigate("/messages");
      return;
    }
    if (id === "map") {
      navigate("/dashboard#map");
      return;
    }
    navigate("/dashboard");
  }

  useEffect(() => {
    if (isOwnProfile && searchParams.get("share") === "1") {
      setShareOpen(true);
    }
  }, [isOwnProfile, searchParams]);

  useEffect(() => {
    if (searchParams.get("src") !== "qr" || isOwnProfile || !handle) return;
    fetch(`${getApiBase()}/v1/users/track/qr/${encodeURIComponent(handle)}`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    }).catch(() => {});
  }, [searchParams, isOwnProfile, handle, token]);

  const secretFetcherData = secretFetcher.data;
  const profileSaving = profileFetcher.state !== "idle";

  useEffect(() => {
    if (secretFetcherData && "sent" in secretFetcherData && secretFetcherData.sent) {
      setShowSentConfirmation(true);
    }
  }, [secretFetcherData]);

  useEffect(() => {
    if (actionData && "sent" in actionData && actionData.sent) {
      setShowSentConfirmation(true);
    }
  }, [actionData]);

  useEffect(() => {
    setShowSentConfirmation(false);
  }, [handle]);

  useEffect(() => {
    setBio(profile?.bio ?? "");
    setSocials(profile?.socials ?? []);
    setAvatarUrl(profile?.avatarUrl ?? null);
  }, [profile?.bio, profile?.socials, profile?.avatarUrl]);

  // Remix automatically revalidates loaders after a fetcher POST, so we only
  // need to reconcile local UI state here - never trigger another revalidation
  // (doing so caused a revalidation storm that briefly flipped the page to a
  // logged-out/visitor view until a manual reload settled it).
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

  useEffect(() => {
    if (
      profileFetcher.state === "idle" &&
      profileFetcher.data &&
      !profileFetcher.data.error &&
      profileFetcher.data.intent === "save-settings"
    ) {
      setSettingsOpen(false);
    }
  }, [profileFetcher.state, profileFetcher.data]);

  function startEditProfile() {
    setBio(profile?.bio ?? "");
    setSocials(profile?.socials ?? []);
    setAvatarUrl(profile?.avatarUrl ?? null);
    setEditingProfile(true);
  }

  function cancelEditProfile() {
    setBio(profile?.bio ?? "");
    setSocials(profile?.socials ?? []);
    setAvatarUrl(profile?.avatarUrl ?? null);
    setEditingProfile(false);
  }

  function saveProfile() {
    profileFetcher.submit(
      {
        intent: "save-profile",
        bio,
        socials: JSON.stringify(socials.filter((s) => s.url.trim())),
        avatarUrl: avatarUrl ?? "",
      },
      { method: "post" },
    );
  }

  function saveSettings(nextAcceptsSecrets: boolean) {
    profileFetcher.submit(
      {
        intent: "save-settings",
        acceptsSecrets: String(nextAcceptsSecrets),
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
          <h1 className="text-2xl font-extrabold tracking-tight mb-2">User not found</h1>
          <p className="text-text-muted mb-6">@{handle} doesn&apos;t exist on Secretlink.life</p>
          <Link to="/" className="text-accent text-sm font-semibold hover:underline">
            Go home →
          </Link>
        </div>
      </main>
    );
  }

  if (showSentConfirmation) {
    return (
      <main className={isLoggedIn ? "h-screen flex flex-col sm:flex-row bg-surface" : "min-h-screen flex flex-col"}>
        {isLoggedIn ? (
          <>
            <Sidebar
              profileHref={profileHref}
              userHandle={ownHandle ?? handle}
              userAvatarUrl={navAvatarUrl}
            />
            {token && <DashboardMobileHeader token={token} onNavClick={handleMobileNav} />}
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
            <h1 className="text-2xl font-extrabold tracking-tight mb-2">Secret sent!</h1>
            <p className="text-text-muted mb-6">
              Your anonymous message has been delivered to{" "}
              <span className="text-accent">@{handle}</span>. It will self-destruct after being read.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                type="button"
                onClick={() => setShowSentConfirmation(false)}
                className="inline-flex justify-center rounded-full bg-accent px-6 py-3 text-sm font-extrabold text-black hover:bg-accent-soft transition-colors"
              >
                Send another →
              </button>
              {isLoggedIn && ownHandle && (
                <Link
                  to={`/${ownHandle}?share=1`}
                  onClick={() => setShowSentConfirmation(false)}
                  className="inline-flex justify-center rounded-full border border-border px-6 py-3 text-sm font-extrabold text-text hover:border-accent transition-colors"
                >
                  Share your profile
                </Link>
              )}
            </div>
          </div>
        </div>
        {isLoggedIn && (
          <MobileBottomNav
            profileHref={profileHref}
            userHandle={ownHandle ?? handle}
            userAvatarUrl={navAvatarUrl}
          />
        )}
      </main>
    );
  }

  return (
    <main className={isLoggedIn ? "h-screen flex flex-col sm:flex-row bg-surface" : "min-h-screen"}>
      {isLoggedIn ? (
        <>
          <Sidebar profileHref={profileHref} userHandle={ownHandle ?? handle} userAvatarUrl={navAvatarUrl} />
          {token && <DashboardMobileHeader token={token} onNavClick={handleMobileNav} />}
        </>
      ) : (
        <Nav isLoggedIn={isLoggedIn} />
      )}

      <div className={isLoggedIn ? "flex-1 overflow-y-auto" : ""}>
        <div className={`max-w-lg mx-auto px-4 ${isLoggedIn ? "pt-8 pb-20 sm:pb-8" : "pt-24 pb-16"}`}>
          <ProfileView
            profile={isOwnProfile ? { ...profile, avatarUrl, bio, socials } : profile}
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
            onSettings={isOwnProfile ? () => setSettingsOpen(true) : undefined}
          />

          {isOwnProfile && editingProfile && (
            <ProfileEditForm
              bio={bio}
              socials={socials}
              avatarUrl={avatarUrl}
              handle={handle}
              onBioChange={setBio}
              onSocialsChange={setSocials}
              onAvatarUrlChange={setAvatarUrl}
              onSave={saveProfile}
              onCancel={cancelEditProfile}
              saving={profileSaving}
            />
          )}

          {!isOwnProfile && profile?.acceptsSecrets !== false && (
            <ProfileSecretForm
              recipientPublicKey={profile?.dmPublicKey}
              recipientPublicKeys={profile?.dmPublicKeys}
              fetcher={secretFetcher}
            />
          )}

          {!isLoggedIn && (
            <div className="text-center mt-8">
              <p className="text-sm text-text-muted mb-1">Want your own anonymous inbox?</p>
              <p className="text-xs text-text-muted/70 mb-3">
                Claim a handle and drop it in your bio.
              </p>
              <Link
                to="/signup"
                className="inline-flex rounded-full bg-accent px-5 py-2.5 text-sm font-extrabold text-black hover:bg-accent-soft transition-colors"
              >
                Get your @handle
              </Link>
            </div>
          )}
        </div>
      </div>

      {isLoggedIn && (
        <MobileBottomNav
          profileHref={profileHref}
          userHandle={ownHandle ?? handle}
          userAvatarUrl={navAvatarUrl}
        />
      )}

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
      {isOwnProfile && settingsOpen && (
        <ProfileSettingsModal
          handle={handle}
          acceptsSecrets={profile?.acceptsSecrets !== false}
          saving={profileSaving}
          onSave={saveSettings}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </main>
  );
}

function Sidebar({
  profileHref,
  userHandle,
  userAvatarUrl,
}: {
  profileHref: string;
  userHandle: string;
  userAvatarUrl?: string | null;
}) {
  const navItems = [
    { id: "inbox", label: "Home", href: "/dashboard", icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /></svg> },
    { id: "map", label: "Map", href: "/dashboard#map", icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503-11.307l4.994-2.497A.75.75 0 0121 4.196v13.608a.75.75 0 01-.497.708l-5.006 2.503m-6.994-3.015l-5.006 2.503A.75.75 0 013 19.804V6.196a.75.75 0 01.497-.708l5.006-2.503m6.994 3.015L9 4.485m6.497 1.53L9 8.515" /></svg> },
    ...(UI_FEATURES.messages ? [{ id: "messages", label: "Messages", href: "/dashboard#messages", icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443h.004c2.174-.063 4.322-.258 6.426-.573 1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" /></svg> }] : []),
    {
      id: "profile",
      label: "Profile",
      href: profileHref,
      icon: (
        <Avatar
          handle={userHandle}
          avatarUrl={userAvatarUrl}
          sizeClass="w-5 h-5"
          textClass="text-[10px]"
          className="border-0"
        />
      ),
    },
  ];

  return (
    <aside className="hidden sm:flex flex-col w-56 lg:w-64 border-r border-border bg-surface shrink-0">
      <div className="px-5 py-5 border-b border-border">
        <Link to="/dashboard" className="flex items-center gap-2">
          <img src="/secretlink.png" alt="" className="w-8 h-8" />
          <span className="text-sm font-extrabold tracking-tight">
            secretlink<span className="text-accent">.</span>life
          </span>
        </Link>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.id}
            to={item.href}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-full text-sm font-semibold transition-colors ${
              item.id === "profile"
                ? "bg-accent text-black"
                : "text-text-muted hover:text-text hover:bg-surface-raised"
            }`}
          >
            {item.icon}
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
      <div className="px-3 py-4 border-t border-border space-y-2">
        <div className="flex items-center justify-between px-3">
          <ThemeToggle />
          <form method="post" action="/logout">
            <button type="submit" className="font-mono text-[10px] tracking-[0.14em] uppercase text-text-muted hover:text-accent">Log out</button>
          </form>
        </div>
      </div>
    </aside>
  );
}

function MobileBottomNav({
  profileHref,
  userHandle,
  userAvatarUrl,
}: {
  profileHref: string;
  userHandle: string;
  userAvatarUrl?: string | null;
}) {
  return (
    <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-surface/95 backdrop-blur-xl border-t border-border z-30 pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around px-2 py-2 max-w-lg mx-auto">
        <Link to="/dashboard" className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-full text-text-muted">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /></svg>
          <span className="text-[10px] font-extrabold tracking-wide uppercase">Home</span>
        </Link>
        <Link to="/dashboard#map" className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-full text-text-muted">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503-11.307l4.994-2.497A.75.75 0 0121 4.196v13.608a.75.75 0 01-.497.708l-5.006 2.503m-6.994-3.015l-5.006 2.503A.75.75 0 013 19.804V6.196a.75.75 0 01.497-.708l5.006-2.503m6.994 3.015L9 4.485m6.497 1.53L9 8.515" /></svg>
          <span className="text-[10px] font-extrabold tracking-wide uppercase">Map</span>
        </Link>
        {UI_FEATURES.messages && (
        <Link to="/messages" className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-full text-text-muted">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443h.004c2.174-.063 4.322-.258 6.426-.573 1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" /></svg>
          <span className="text-[10px] font-extrabold tracking-wide uppercase">Messages</span>
        </Link>
        )}
        <Link to={profileHref} className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-full text-accent">
          <Avatar handle={userHandle} avatarUrl={userAvatarUrl} sizeClass="w-5 h-5" textClass="text-[10px]" className="border-0" />
          <span className="text-[10px] font-extrabold tracking-wide uppercase">Profile</span>
        </Link>
      </div>
    </nav>
  );
}

function Nav({ isLoggedIn }: { isLoggedIn: boolean }) {
  return (
    <nav className={`${isLoggedIn ? "sm:hidden" : ""} fixed top-0 left-0 right-0 z-50 pt-[max(0.75rem,env(safe-area-inset-top))] px-3 sm:px-4`}>
      <div className="mx-auto max-w-6xl flex items-center justify-between gap-3 rounded-full border border-border/80 bg-surface/80 backdrop-blur-xl px-3 sm:px-4 py-2 shadow-[0_8px_40px_rgba(0,0,0,0.35)]">
        <Link to="/" className="flex items-center gap-2 min-w-0">
          <img src="/secretlink.png" alt="Secretlink.life" className="w-8 h-8 shrink-0" />
          <span className="text-sm sm:text-base font-extrabold tracking-tight truncate">
            secretlink<span className="text-accent">.</span>life
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {!isLoggedIn && (
            <Link
              to="/login"
              className="rounded-full bg-accent px-4 py-2 text-sm font-extrabold text-black hover:bg-accent-soft transition-colors"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
