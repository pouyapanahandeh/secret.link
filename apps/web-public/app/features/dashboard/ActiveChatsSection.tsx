import { Link } from "@remix-run/react";
import { useEffect, useMemo, useState } from "react";
import { loadChatKeyMap } from "../../lib/chat-keys";
import type { ActiveChat } from "./types";

function formatCountdown(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "expired";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

function ChatCard({ chat, keyBase64, ready }: { chat: ActiveChat; keyBase64: string | null; ready: boolean }) {
  const [countdown, setCountdown] = useState(() => formatCountdown(chat.expiresAt));

  useEffect(() => {
    const tick = () => setCountdown(formatCountdown(chat.expiresAt));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [chat.expiresAt]);

  if (countdown === "expired") return null;

  const locked = ready && !keyBase64;

  const inner = (
    <>
      <span className="absolute top-2 right-2 font-mono text-[10px] tracking-[0.12em] uppercase bg-black/70 text-accent px-2 py-1 rounded-full">
        {countdown}
      </span>
      <p className="text-2xl mb-3" aria-hidden>
        💬
      </p>
      <p className="text-sm font-extrabold truncate pr-16">Secret chat</p>
      <p className={`text-xs mt-1 ${!locked ? "text-text-muted group-hover:text-black/70" : "text-text-muted"}`}>
        {chat.memberCount}/{chat.maxMembers} people
        {chat.hasPin ? " · PIN" : ""}
      </p>
      {locked && (
        <p className="text-[11px] text-text-muted mt-2 leading-snug">Open the original link to decrypt</p>
      )}
    </>
  );

  const shell =
    "relative block overflow-hidden rounded-2xl border border-border bg-surface p-4 min-h-[8.5rem] transition-colors";

  if (!ready || !keyBase64) {
    return (
      <div
        className={`${shell} ${locked ? "opacity-60 cursor-not-allowed" : ""}`}
        aria-disabled={locked}
        title={locked ? "Open the original link to decrypt" : undefined}
      >
        {inner}
      </div>
    );
  }

  return (
    <Link to={`/c/${chat.id}#k=${keyBase64}`} className={`${shell} group hover:bg-accent hover:text-black hover:border-accent`}>
      {inner}
    </Link>
  );
}

export function ActiveChatsSection({ userId, chats }: { userId: string; chats: ActiveChat[] }) {
  const [keys, setKeys] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    setKeys(loadChatKeyMap(userId));
  }, [userId]);

  const live = useMemo(
    () => chats.filter((c) => new Date(c.expiresAt).getTime() > Date.now()),
    [chats],
  );

  if (live.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="font-mono text-[11px] tracking-[0.2em] uppercase text-accent mb-3 flex items-center gap-2">
        Active chats
        <span className="font-sans text-[10px] font-extrabold bg-accent text-black px-2 py-0.5 rounded-full">
          {live.length}
        </span>
      </h2>
      <div className="grid grid-cols-2 gap-3">
        {live.map((chat) => (
          <ChatCard
            key={chat.id}
            chat={chat}
            ready={keys !== null}
            keyBase64={keys?.[chat.id] ?? null}
          />
        ))}
      </div>
    </section>
  );
}
