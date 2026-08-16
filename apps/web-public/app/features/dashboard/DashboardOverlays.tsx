import type { UserLite } from "../../lib/users";
import { ProfileActionSheet } from "../../components/ProfileActionSheet";
import { ProfileShareModal } from "../../components/ProfileShareModal";
import { ProfileStatsModal } from "../../components/ProfileStatsModal";
import { StoryViewer } from "../../components/StoryViewer";
import { StoryComposer } from "../../components/StoryComposer";
import { GoLiveButton } from "../../components/GoLiveButton";
import { UI_FEATURES } from "../../lib/feature-flags";

type DashboardOverlaysProps = {
  userHandle: string;
  token: string;
  activeTab: "inbox" | "map" | "messages" | "profile";
  fabOpen: boolean;
  setFabOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  showBroadcast: boolean;
  setShowBroadcast: (open: boolean) => void;
  sheetUser: { user: UserLite; hasStory: boolean } | null;
  setSheetUser: (user: { user: UserLite; hasStory: boolean } | null) => void;
  shareOpen: boolean;
  setShareOpen: (open: boolean) => void;
  statsOpen: boolean;
  setStatsOpen: (open: boolean) => void;
  storyViewer: UserLite | null;
  setStoryViewer: (user: UserLite | null) => void;
  storyComposer: { open: true; initialCoords?: { lat: number; lng: number } } | { open: false };
  setStoryComposer: (state: { open: true; initialCoords?: { lat: number; lng: number } } | { open: false }) => void;
  onViewedStory: (id: string) => void;
  onPostedStory: () => void;
  onOpenComposer: () => void;
  onNavigateSend: () => void;
};

export function DashboardOverlays({
  userHandle,
  token,
  activeTab,
  fabOpen,
  setFabOpen,
  showBroadcast,
  setShowBroadcast,
  sheetUser,
  setSheetUser,
  shareOpen,
  setShareOpen,
  statsOpen,
  setStatsOpen,
  storyViewer,
  setStoryViewer,
  storyComposer,
  setStoryComposer,
  onViewedStory,
  onPostedStory,
  onOpenComposer,
  onNavigateSend,
}: DashboardOverlaysProps) {
  return (
    <>
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
                  { label: "Add story", emoji: "✨", onClick: () => { setFabOpen(false); onOpenComposer(); } },
                  { label: "Post secret", emoji: "🔐", onClick: () => { setFabOpen(false); onNavigateSend(); } },
                ].map((a) => (
                  <button key={a.label} onClick={a.onClick} className="flex items-center gap-2">
                    <span className="text-xs font-extrabold bg-surface-raised border border-border rounded-full px-3 py-1.5 shadow-lg">
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

      {sheetUser && (
        <ProfileActionSheet
          user={sheetUser.user}
          hasStory={sheetUser.hasStory}
          onViewStory={() => setStoryViewer(sheetUser.user)}
          onClose={() => setSheetUser(null)}
        />
      )}

      {shareOpen && (
        <ProfileShareModal handle={userHandle} onClose={() => setShareOpen(false)} />
      )}

      {statsOpen && (
        <ProfileStatsModal token={token} onClose={() => setStatsOpen(false)} />
      )}

      {storyViewer && (
        <StoryViewer
          handle={storyViewer.handle}
          avatarUrl={storyViewer.avatarUrl}
          onClose={() => setStoryViewer(null)}
          onViewed={onViewedStory}
        />
      )}

      {storyComposer.open && (
        <StoryComposer
          handle={userHandle}
          token={token}
          initialCoords={storyComposer.initialCoords}
          onClose={() => setStoryComposer({ open: false })}
          onPosted={onPostedStory}
        />
      )}

      {UI_FEATURES.live && showBroadcast && (
        <div className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-border max-w-md w-full p-5 relative">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-extrabold tracking-tight">Go Live</h2>
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
    </>
  );
}
