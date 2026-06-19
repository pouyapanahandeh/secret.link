import { Avatar } from "./Avatar";
import type { UserLite } from "../lib/users";

interface StoriesRowProps {
  /** Users the current user follows. */
  users: UserLite[];
  /** Set of handles (lowercase, no @) that currently have an active story. */
  storyHandles: Set<string>;
  /** Set of handles (lowercase, no @) whose active stories have all been viewed. */
  viewedHandles?: Set<string>;
  /** Invoked when an avatar is tapped — opens the action sheet. */
  onSelect: (user: UserLite, hasStory: boolean) => void;
}

/**
 * Horizontal, Instagram-style row of followed users above the search bar.
 * Users with an active map secret get a brand-yellow story ring; once watched,
 * the ring dims to grey.
 */
export function StoriesRow({ users, storyHandles, viewedHandles, onSelect }: StoriesRowProps) {
  if (users.length === 0) return null;

  const viewed = viewedHandles ?? new Set<string>();

  // Rank: unviewed stories first, then viewed stories, then users with none.
  function rank(handle: string): number {
    const h = handle.toLowerCase();
    if (storyHandles.has(h)) return viewed.has(h) ? 1 : 0;
    return 2;
  }
  const sorted = [...users].sort((a, b) => rank(a.handle) - rank(b.handle));

  return (
    <div className="mb-5 -mx-4 sm:mx-0">
      <div className="flex gap-4 overflow-x-auto px-4 sm:px-0 pb-1 no-scrollbar">
        {sorted.map((u) => {
          const h = u.handle.toLowerCase();
          const hasStory = storyHandles.has(h);
          const isViewed = hasStory && viewed.has(h);
          return (
            <button
              key={u.id}
              type="button"
              onClick={() => onSelect(u, hasStory)}
              className="flex flex-col items-center gap-1 shrink-0 w-16"
            >
              <Avatar
                handle={u.handle}
                avatarUrl={u.avatarUrl}
                sizeClass="w-14 h-14"
                textClass="text-base"
                ring={hasStory}
                viewed={isViewed}
              />
              <span className="text-[11px] text-text-muted truncate max-w-full">@{u.handle}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
