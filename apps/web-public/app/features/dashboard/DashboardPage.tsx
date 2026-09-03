import { useLoaderData, useFetcher, useNavigate, useRevalidator } from "@remix-run/react";
import { useState, useEffect } from "react";
import { MessagingPanel } from "../../components/MessagingPanel";
import { MapTab } from "../../components/MapTab";
import type { UserLite } from "../../lib/users";
import { getApiBase } from "../../lib/api.client";
import { getViewedStoryIds, computeViewedHandles } from "../../lib/story-views";
import { UI_FEATURES } from "../../lib/feature-flags";
import type { MapSecret } from "../../lib/map-types";
import { DashboardInboxTab } from "./DashboardInboxTab";
import { DashboardProfileTab } from "./DashboardProfileTab";
import {
  DashboardSidebar,
  DashboardMobileHeader,
  DashboardBottomNav,
} from "./DashboardNav";
import { DashboardOverlays } from "./DashboardOverlays";
import { readTabFromHash, type DashboardTab, type SentSecret, type ActiveChat } from "./types";
import type { loader } from "../../routes/dashboard";
import { registerPasskey } from "../../lib/passkey-register";
import { RecoveryCodesPanel } from "../../components/passkeys/RecoveryCodesPanel";

export function DashboardPage() {
  const { user, inbox, sent, sentHasMore, sentNextOffset, activeChats, token, following, storyHandles, storyIdsByHandle, mapSecrets } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const [activeTab, setActiveTab] = useState<DashboardTab>(() => readTabFromHash());
  const [passkeyStatus, setPasskeyStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [passkeyError, setPasskeyError] = useState("");
  const [hasPasskey, setHasPasskey] = useState(user.hasPasskey);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [bio, setBio] = useState(user.bio ?? "");
  const [socials, setSocials] = useState<{ platform: string; url: string }[]>(user.socials ?? []);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user.avatarUrl ?? null);
  const profileFetcher = useFetcher<{ error?: string }>();
  const profileSaving = profileFetcher.state !== "idle";
  const [profileSaved, setProfileSaved] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);

  const storyHandleSet = new Set<string>(storyHandles);
  const [storyViewer, setStoryViewer] = useState<UserLite | null>(null);
  const [sheetUser, setSheetUser] = useState<{ user: UserLite; hasStory: boolean } | null>(null);
  const [viewedStoryIds, setViewedStoryIds] = useState<Set<string>>(new Set());
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

  useEffect(() => {
    setViewedStoryIds(getViewedStoryIds());
  }, [storyIdsByHandle]);

  useEffect(() => {
    if (!token) return;
    import("../../lib/dm-crypto").then(({ ensureAndPublishKey }) =>
      ensureAndPublishKey(getApiBase(), token),
    ).catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!token) return;
    import("../../lib/push.client").then(({ ensurePushSubscription }) =>
      ensurePushSubscription(token),
    ).catch(() => {});
  }, [token]);

  useEffect(() => {
    if (profileFetcher.state === "idle" && profileFetcher.data && !profileFetcher.data.error) {
      setEditingProfile(false);
      setProfileSaved(true);
      revalidator.revalidate();
      const t = setTimeout(() => setProfileSaved(false), 3000);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [profileFetcher.state, profileFetcher.data, revalidator]);

  useEffect(() => {
    setAvatarUrl(user.avatarUrl ?? null);
  }, [user.avatarUrl]);

  const viewedHandles = computeViewedHandles(storyIdsByHandle, viewedStoryIds);

  function openStoryComposer(initialCoords?: { lat: number; lng: number }) {
    setStoryComposer({ open: true, initialCoords });
  }

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

  async function handleAddPasskey() {
    setPasskeyStatus("loading");
    setPasskeyError("");
    try {
      const result = await registerPasskey(getApiBase(), token);
      setPasskeyStatus("done");
      setHasPasskey(true);
      if (result.recoveryCodes?.length) setRecoveryCodes(result.recoveryCodes);
    } catch (err: unknown) {
      setPasskeyStatus("error");
      setPasskeyError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  const passkey = {
    status: passkeyStatus,
    error: passkeyError,
    hasPasskey,
    onAddPasskey: handleAddPasskey,
  };

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

  const hideMobileChrome = UI_FEATURES.messages && activeTab === "messages";

  return (
    <main className="h-dvh flex flex-col sm:flex-row bg-surface overflow-hidden">
      <DashboardSidebar
        activeTab={activeTab}
        inboxCount={inbox.length}
        token={token}
        userHandle={user.handle}
        userAvatarUrl={avatarUrl}
        onNavClick={handleNavClick}
      />

      {!hideMobileChrome && (
        <DashboardMobileHeader token={token} onNavClick={handleNavClick} />
      )}

      {UI_FEATURES.messages && activeTab === "messages" ? (
        <div className="flex-1 min-h-0 flex overflow-hidden">
          <MessagingPanel token={token} />
        </div>
      ) : (
        <div className={`flex-1 min-h-0 ${activeTab === "map" ? "flex flex-col overflow-hidden sm:pb-6" : "overflow-y-auto sm:pb-6"}`}>
          <div className={`${activeTab === "map" ? "flex flex-col flex-1 min-h-0 h-full w-full sm:max-w-2xl sm:mx-auto sm:px-6 sm:py-6" : "max-w-2xl mx-auto px-4 sm:px-6 py-4 sm:py-6"}`}>
            {activeTab === "inbox" && (
              <DashboardInboxTab
                user={user}
                inbox={inbox}
                sent={sent as SentSecret[]}
                sentHasMore={sentHasMore}
                sentNextOffset={sentNextOffset}
                activeChats={activeChats as ActiveChat[]}
                token={token}
                following={following as UserLite[]}
                storyHandleSet={storyHandleSet}
                viewedHandles={viewedHandles}
                onSelectStoryUser={(u, hasStory) => setSheetUser({ user: u, hasStory })}
                passkey={passkey}
              />
            )}

            {activeTab === "profile" && (
              <DashboardProfileTab
                user={user}
                editingProfile={editingProfile}
                bio={bio}
                socials={socials}
                avatarUrl={avatarUrl}
                profileSaving={profileSaving}
                profileSaved={profileSaved}
                passkey={passkey}
                onBioChange={setBio}
                onSocialsChange={setSocials}
                onAvatarUrlChange={setAvatarUrl}
                onSave={saveProfile}
                onCancelEdit={cancelEditProfile}
                onShare={() => setShareOpen(true)}
                onStats={() => setStatsOpen(true)}
                onEdit={startEditProfile}
              />
            )}

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

      {!hideMobileChrome && (
        <DashboardBottomNav
          activeTab={activeTab}
          userHandle={user.handle}
          userAvatarUrl={avatarUrl}
          onNavClick={handleNavClick}
        />
      )}

      <DashboardOverlays
        userHandle={user.handle}
        token={token}
        activeTab={activeTab}
        fabOpen={fabOpen}
        setFabOpen={setFabOpen}
        showBroadcast={showBroadcast}
        setShowBroadcast={setShowBroadcast}
        sheetUser={sheetUser}
        setSheetUser={setSheetUser}
        shareOpen={shareOpen}
        setShareOpen={setShareOpen}
        statsOpen={statsOpen}
        setStatsOpen={setStatsOpen}
        storyViewer={storyViewer}
        setStoryViewer={setStoryViewer}
        storyComposer={storyComposer}
        setStoryComposer={setStoryComposer}
        onViewedStory={(id) => setViewedStoryIds((prev) => (prev.has(id) ? prev : new Set(prev).add(id)))}
        onPostedStory={() => revalidator.revalidate()}
        onOpenComposer={() => openStoryComposer()}
        onNavigateSend={() => navigate("/send")}
      />

      {recoveryCodes && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/50" aria-hidden="true" />
          <div className="relative z-10 w-full sm:max-w-md bg-surface border-t border-border sm:border sm:rounded-3xl p-6 mb-0 sm:mb-6">
            <RecoveryCodesPanel codes={recoveryCodes} onConfirmed={() => setRecoveryCodes(null)} />
          </div>
        </div>
      )}
    </main>
  );
}
