import { handleInitial } from "../lib/users";

interface AvatarProps {
  handle: string;
  avatarUrl?: string | null;
  /** Tailwind size classes, e.g. "w-9 h-9". */
  sizeClass?: string;
  /** Text size for the fallback initial, e.g. "text-xs". */
  textClass?: string;
  /** Render a brand "story" ring around the avatar (active, unviewed story). */
  ring?: boolean;
  /** When true, dim the ring to indicate the story has already been viewed. */
  viewed?: boolean;
  className?: string;
}

/**
 * Circular user avatar with image + initial fallback. Optionally wrapped in a
 * brand-yellow gradient ring to indicate an active "story" (map secret). Once
 * viewed, the ring dims to grey (still tappable to re-watch).
 */
export function Avatar({
  handle,
  avatarUrl,
  sizeClass = "w-9 h-9",
  textClass = "text-xs",
  ring = false,
  viewed = false,
  className = "",
}: AvatarProps) {
  const inner = (
    <div
      className={`${sizeClass} rounded-full bg-accent/20 border border-accent/50 flex items-center justify-center shrink-0 overflow-hidden ${className}`}
    >
      {avatarUrl ? (
        <img src={avatarUrl} alt={`@${handle}`} className="w-full h-full object-cover" />
      ) : (
        <span className={`${textClass} font-bold text-accent`}>{handleInitial(handle)}</span>
      )}
    </div>
  );

  if (!ring) return inner;

  return (
    <div
      className={`rounded-full p-[2px] ${
        viewed
          ? "bg-white/20"
          : "bg-gradient-to-tr from-accent via-yellow-400 to-amber-500"
      }`}
    >
      <div className="rounded-full p-[2px] bg-surface">{inner}</div>
    </div>
  );
}
