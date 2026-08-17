import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { isSentUnseen, type SentSecret } from "./types";

export function SentSecretRow({ secret }: { secret: SentSecret }) {
  const unseen = isSentUnseen(secret);
  return (
    <div className="flex items-center gap-3 bg-surface p-3 sm:p-4">
      <span className="text-xl">
        {secret.contentType === "text" ? "💬" : "📎"}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-extrabold truncate">
          → {secret.recipientHandle ? `@${secret.recipientHandle}` : "Link"}
        </p>
        <p className="text-xs text-text-muted">
          {secret.burned ? "Burned" : unseen ? "Pending" : `${secret.viewCount}/${secret.maxViews}`}
        </p>
      </div>
      <div className="shrink-0 flex flex-col items-end gap-1">
        {unseen && (
          <span className="font-mono text-[9px] tracking-[0.14em] uppercase font-extrabold bg-accent text-black px-1.5 py-0.5 rounded-full">
            Unseen
          </span>
        )}
        <span className="font-mono text-[10px] text-text-muted">
          {new Date(secret.createdAt).toLocaleDateString()}
        </span>
      </div>
    </div>
  );
}

export function SentSecretsDrawer({
  secrets,
  hasMore,
  loading,
  onLoadMore,
  onClose,
}: {
  secrets: SentSecret[];
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => void;
  onClose: () => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  useEffect(() => {
    const node = sentinelRef.current;
    const root = listRef.current;
    if (!node || !root || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) onLoadMore();
      },
      { root, rootMargin: "160px", threshold: 0 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, onLoadMore, secrets.length]);

  return createPortal(
    <div className="fixed inset-0 z-[260] flex items-end justify-center">
      <div className="absolute inset-0 bg-black/50" aria-hidden="true" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Sent secrets"
        className="drawer-slide-up relative z-10 w-full sm:max-w-lg max-h-[85vh] bg-surface border-t border-border sm:border sm:mb-6 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col"
      >
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>
        <div className="flex items-start justify-between gap-4 px-5 pb-3 shrink-0">
          <div>
            <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-accent">History</p>
            <h2 className="text-lg font-extrabold tracking-tight">Sent</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full border border-border text-text-muted hover:text-text flex items-center justify-center text-lg leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div ref={listRef} className="overflow-y-auto flex-1 border-t border-border">
          <div className="divide-y divide-border">
            {secrets.map((secret) => (
              <SentSecretRow key={secret.id} secret={secret} />
            ))}
          </div>
          {hasMore && (
            <div ref={sentinelRef} className="py-5 text-center">
              <p className="font-mono text-[10px] tracking-[0.16em] uppercase text-text-muted">
                {loading ? "Loading…" : "Scroll for more"}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
