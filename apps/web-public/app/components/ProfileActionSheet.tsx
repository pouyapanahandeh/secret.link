import { useEffect } from "react";
import { Avatar } from "./Avatar";
import type { UserLite } from "../lib/users";

interface ProfileActionSheetProps {
  user: UserLite;
  /** Show the "View story" action when the user has an active map secret. */
  hasStory?: boolean;
  onViewStory?: () => void;
  onClose: () => void;
}

/**
 * Bottom-sheet (mobile) / centered popover (desktop) presenting the actions you
 * can take on another user: view their story, send a message, send a secret, or
 * open their profile. Dismissed by tapping the backdrop or pressing Escape.
 */
export function ProfileActionSheet({ user, hasStory, onViewStory, onClose }: ProfileActionSheetProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const actions: Array<{ icon: string; label: string; onClick: () => void; href?: string }> = [];

  if (hasStory && onViewStory) {
    actions.push({ icon: "📖", label: "View story", onClick: () => { onClose(); onViewStory(); } });
  }
  actions.push({ icon: "💬", label: "Send message", onClick: () => onClose(), href: `/messages?to=${user.handle}` });
  actions.push({ icon: "🔒", label: "Send secret", onClick: () => onClose(), href: `/${user.handle}` });
  actions.push({ icon: "👤", label: "Open profile", onClick: () => onClose(), href: `/${user.handle}` });

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50" aria-hidden="true" onClick={onClose} />
      <div
        role="dialog"
        aria-label={`Actions for @${user.handle}`}
        className="fixed z-50 left-1/2 -translate-x-1/2 bottom-0 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 w-full sm:w-80 max-w-md bg-surface border border-border/50 rounded-t-2xl sm:rounded-2xl shadow-xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-border/50">
          <Avatar handle={user.handle} avatarUrl={user.avatarUrl} sizeClass="w-11 h-11" textClass="text-sm" ring={hasStory} />
          <div className="min-w-0">
            <p className="text-sm font-bold truncate">@{user.handle} {user.isPro && "⭐"}</p>
            {user.bio && <p className="text-xs text-text-muted truncate">{user.bio}</p>}
          </div>
        </div>

        {/* Actions */}
        <div className="py-1">
          {actions.map((a) =>
            a.href ? (
              <a
                key={a.label}
                href={a.href}
                onClick={a.onClick}
                className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm hover:bg-surface-raised transition-colors"
              >
                <span className="text-lg leading-none">{a.icon}</span>
                <span>{a.label}</span>
              </a>
            ) : (
              <button
                key={a.label}
                type="button"
                onClick={a.onClick}
                className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm hover:bg-surface-raised transition-colors"
              >
                <span className="text-lg leading-none">{a.icon}</span>
                <span>{a.label}</span>
              </button>
            ),
          )}
        </div>

        {/* Cancel */}
        <button
          type="button"
          onClick={onClose}
          className="w-full px-4 py-3 text-sm font-medium text-text-muted border-t border-border/50 hover:bg-surface-raised transition-colors"
        >
          Cancel
        </button>
        <div className="h-[env(safe-area-inset-bottom)] sm:hidden" />
      </div>
    </>
  );
}
