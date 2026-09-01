import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { SiteChrome } from "../components/SiteChrome";
import { getApiBase } from "../lib/api.client";
import { API_URL } from "../lib/api.server";
import { loadChatSession, saveChatSession, type ChatSession } from "../lib/chat-session";
import { getToken } from "../lib/session.server";

export const meta: MetaFunction = () => [
  { title: "Secret chat - Secretlink.life" },
  { name: "description", content: "Join an encrypted, self-destructing chat. When the link expires, everything is deleted." },
];

export async function loader({ request, params }: LoaderFunctionArgs) {
  const token = await getToken(request);
  let handle: string | null = null;
  if (token) {
    try {
      const res = await fetch(`${API_URL}/v1/users/me/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const profile = (await res.json()) as { handle?: string };
        handle = profile.handle ?? null;
      }
    } catch {
      /* ignore */
    }
  }
  return json({
    roomId: params["id"] ?? "",
    isLoggedIn: Boolean(token),
    handle,
  });
}

const fieldLabel = "block font-mono text-[10px] tracking-[0.18em] uppercase text-text-muted mb-2";
const fieldControl =
  "w-full min-h-12 bg-surface border border-border px-4 py-3 text-text placeholder:text-text-muted/50 focus:outline-none focus:border-accent transition-colors";
const primaryBtn =
  "w-full min-h-12 rounded-full bg-accent px-6 text-sm font-extrabold text-black hover:bg-accent-soft transition-colors disabled:opacity-60";

type RoomStatus = {
  id: string;
  hasPin: boolean;
  memberCount: number;
  maxMembers: number;
  expiresAt: string;
  available: boolean;
};

type ChatMessage = {
  id: string;
  memberId: string;
  displayName: string;
  ciphertext: string;
  nonce: string;
  createdAt: string;
  text?: string;
};

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

function GoneState({ title, body }: { title: string; body: string }) {
  return (
    <div className="max-w-md mx-auto text-center space-y-4 pt-8">
      <h1 className="font-extrabold tracking-[-0.04em] text-4xl leading-[0.95]">
        {title}
      </h1>
      <p className="text-text-muted leading-relaxed">{body}</p>
      <Link to="/send" className="inline-block text-sm font-medium text-accent hover:text-accent-soft">
        Create a secret chat →
      </Link>
    </div>
  );
}

export default function SecretChat() {
  const { roomId, isLoggedIn, handle } = useLoaderData<typeof loader>();
  const [phase, setPhase] = useState<"boot" | "join" | "room" | "gone" | "full" | "missing-key">("boot");
  const [goneReason, setGoneReason] = useState("This chat is gone. Every message was deleted.");
  const [status, setStatus] = useState<RoomStatus | null>(null);
  const [session, setSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [members, setMembers] = useState<Array<{ id: string; displayName: string }>>([]);
  const [pin, setPin] = useState("");
  const [nickname, setNickname] = useState("anon");
  const [joinAnonymous, setJoinAnonymous] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [countdown, setCountdown] = useState("");
  const keyRef = useRef<CryptoKey | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const decryptMany = useCallback(async (rows: ChatMessage[], key: CryptoKey): Promise<ChatMessage[]> => {
    const { decryptChatText } = await import("../lib/crypto");
    const out: ChatMessage[] = [];
    for (const row of rows) {
      try {
        out.push({ ...row, text: await decryptChatText(row.ciphertext, row.nonce, key) });
      } catch {
        out.push({ ...row, text: "Unable to decrypt this message." });
      }
    }
    return out;
  }, []);

  const enterRoom = useCallback(
    async (sess: ChatSession, key: CryptoKey) => {
      const res = await fetch(`${getApiBase()}/v1/chats/${roomId}/messages`, {
        credentials: "include",
        headers: { "X-Chat-Token": sess.token },
      });
      if (res.status === 410 || res.status === 404) {
        setPhase("gone");
        return;
      }
      if (!res.ok) {
        setPhase("join");
        return;
      }
      const body = (await res.json()) as RoomStatus & {
        members: Array<{ id: string; displayName: string }>;
        messages: ChatMessage[];
      };
      setStatus(body);
      setMembers(body.members);
      setMessages(await decryptMany(body.messages, key));
      setSession(sess);
      setPhase("room");
    },
    [decryptMany, roomId],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const fragment = window.location.hash;
      const keyParam = fragment.match(/k=([A-Za-z0-9_-]+)/)?.[1];
      if (!keyParam) {
        setPhase("missing-key");
        return;
      }
      try {
        const { importAesGcmKey } = await import("../lib/crypto");
        keyRef.current = await importAesGcmKey(keyParam);
      } catch {
        setPhase("missing-key");
        return;
      }

      const statusRes = await fetch(`${getApiBase()}/v1/chats/${roomId}`, { credentials: "include" });
      if (cancelled) return;
      if (statusRes.status === 410) {
        setPhase("gone");
        return;
      }
      if (!statusRes.ok) {
        setGoneReason("This chat doesn't exist.");
        setPhase("gone");
        return;
      }
      const room = (await statusRes.json()) as RoomStatus;
      setStatus(room);

      const existing = loadChatSession(roomId);
      if (existing && keyRef.current) {
        await enterRoom(existing, keyRef.current);
        return;
      }
      if (!room.available) {
        setPhase(new Date(room.expiresAt).getTime() <= Date.now() ? "gone" : "full");
        return;
      }
      setPhase("join");
    })().catch(() => {
      if (!cancelled) {
        setGoneReason("Something went wrong.");
        setPhase("gone");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [enterRoom, roomId]);

  useEffect(() => {
    if (phase !== "room" || !session || !status) return;
    let closed = false;
    let retry: ReturnType<typeof setTimeout> | undefined;

    const connect = async () => {
      if (closed) return;
      const ticketRes = await fetch(`${getApiBase()}/v1/chats/${roomId}/sse-ticket`, {
        method: "POST",
        credentials: "include",
        headers: { "X-Chat-Token": session.token },
      });
      if (closed) return;
      if (!ticketRes.ok) {
        if (ticketRes.status === 410) setPhase("gone");
        else retry = setTimeout(() => void connect(), 2000);
        return;
      }
      const { ticket } = (await ticketRes.json()) as { ticket: string };
      const es = new EventSource(`${getApiBase()}/v1/chats/${roomId}/sse?ticket=${encodeURIComponent(ticket)}`);
      eventSourceRef.current = es;
      es.addEventListener("message", async (ev) => {
        try {
          const row = JSON.parse(ev.data) as ChatMessage;
          const key = keyRef.current;
          if (!key) return;
          const decrypted = (await decryptMany([row], key))[0];
          if (!decrypted) return;
          setMessages((prev) => (prev.some((m) => m.id === decrypted.id) ? prev : [...prev, decrypted]));
        } catch {
          /* ignore malformed events */
        }
      });
      es.addEventListener("expired", () => {
        setPhase("gone");
        es.close();
      });
      es.onerror = () => {
        es.close();
        if (!closed) retry = setTimeout(() => void connect(), 2000);
      };
    };
    void connect();
    return () => {
      closed = true;
      if (retry) clearTimeout(retry);
      eventSourceRef.current?.close();
    };
  }, [decryptMany, phase, roomId, session, status]);

  useEffect(() => {
    if (!status?.expiresAt) return;
    const tick = () => {
      const label = formatCountdown(status.expiresAt);
      setCountdown(label);
      if (label === "expired") setPhase("gone");
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [status?.expiresAt]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleJoin = async () => {
    if (!status) return;
    setJoining(true);
    setError(null);
    const anonymous = !handle || joinAnonymous;
    const displayName = anonymous ? (nickname.trim() || "anon").slice(0, 32) : `@${handle}`;
    const payload: Record<string, unknown> = { displayName, anonymous };
    if (status.hasPin) {
      if (!/^\d{4,8}$/.test(pin)) {
        setError("Enter the 4–8 digit PIN.");
        setJoining(false);
        return;
      }
      payload.pin = pin;
    }
    const res = await fetch(`${getApiBase()}/v1/chats/${roomId}/join`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.status === 409) {
      setPhase("full");
      setJoining(false);
      return;
    }
    if (res.status === 410 || res.status === 404) {
      if (status.hasPin) setError("Could not join. Check the PIN and try again.");
      else {
        setGoneReason("This chat doesn't exist or has expired.");
        setPhase("gone");
      }
      setJoining(false);
      return;
    }
    if (!res.ok) {
      setError("Could not join this chat.");
      setJoining(false);
      return;
    }
    const body = (await res.json()) as { memberId: string; token: string; displayName: string };
    const sess: ChatSession = {
      token: body.token,
      memberId: body.memberId,
      displayName: body.displayName,
    };
    saveChatSession(roomId, sess);
    if (keyRef.current) await enterRoom(sess, keyRef.current);
    setJoining(false);
  };

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || !session || !keyRef.current) return;
    if (text.length > 2000) {
      setError("Messages can be at most 2,000 characters.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      const { encryptChatText } = await import("../lib/crypto");
      const enc = await encryptChatText(text, keyRef.current);
      const res = await fetch(`${getApiBase()}/v1/chats/${roomId}/messages`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-Chat-Token": session.token,
        },
        body: JSON.stringify(enc),
      });
      if (res.status === 410) {
        setPhase("gone");
        return;
      }
      if (!res.ok) {
        setError("Message failed to send.");
        return;
      }
      const saved = (await res.json()) as ChatMessage;
      setMessages((prev) => [
        ...prev,
        { ...saved, text, displayName: session.displayName, memberId: session.memberId },
      ]);
      setDraft("");
    } finally {
      setSending(false);
    }
  };

  return (
    <SiteChrome isLoggedIn={isLoggedIn} currentPath="/send">
      <div className="relative min-h-screen">
        <div className="absolute -top-24 right-[-20%] w-[70vw] h-[70vw] max-w-[560px] max-h-[560px] rounded-full bg-accent/10 blur-[120px] pointer-events-none" />
        <div className="relative mx-auto max-w-xl px-4 sm:px-6 pt-28 sm:pt-32 pb-10">
          {phase === "boot" && (
            <p className="text-center text-sm text-text-muted">Opening chat…</p>
          )}

          {phase === "missing-key" && (
            <GoneState
              title="Missing key"
              body="This shared link is missing its decryption key. Copy the full URL, including the #k=… part at the end."
            />
          )}

          {phase === "gone" && <GoneState title="This chat is gone" body={goneReason} />}

          {phase === "full" && (
            <GoneState
              title="Chat is full"
              body="The member limit for this room has been reached. Ask the creator for a new link."
            />
          )}

          {phase === "join" && status && (
            <div className="space-y-6">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.28em] uppercase text-accent mb-4">
                  Encrypted · link only
                </p>
                <h1 className="font-extrabold tracking-[-0.04em] text-4xl sm:text-5xl leading-[0.95] mb-3">
                  Join the <span className="font-display font-bold text-accent">chat</span>
                </h1>
                <p className="text-sm text-text-muted">
                  {status.memberCount} / {status.maxMembers} people · dies in {formatCountdown(status.expiresAt)}
                </p>
              </div>

              {status.hasPin && (
                <div>
                  <label htmlFor="pin" className={fieldLabel}>PIN</label>
                  <input
                    id="pin"
                    type="password"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={8}
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
                    className={fieldControl}
                    placeholder="4–8 digits"
                  />
                </div>
              )}

              {handle && (
                <label className="flex items-center gap-3 text-sm text-text">
                  <input
                    type="checkbox"
                    checked={joinAnonymous}
                    onChange={(e) => setJoinAnonymous(e.target.checked)}
                    className="h-4 w-4 accent-accent"
                  />
                  Join anonymously instead of @{handle}
                </label>
              )}

              {(!handle || joinAnonymous) && (
                <div>
                  <label htmlFor="nickname" className={fieldLabel}>Nickname</label>
                  <input
                    id="nickname"
                    type="text"
                    maxLength={32}
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    className={fieldControl}
                    placeholder="anon"
                  />
                </div>
              )}

              {error && <p className="text-red-400 text-sm">{error}</p>}

              <button type="button" onClick={handleJoin} disabled={joining} className={primaryBtn}>
                {joining ? "Joining…" : "Join chat"}
              </button>
            </div>
          )}

          {phase === "room" && status && session && (
            <div className="flex flex-col h-[calc(100vh-9rem)]">
              <div className="flex items-center justify-between gap-3 pb-4 border-b border-border">
                <div>
                  <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-accent">Secret chat</p>
                  <p className="text-sm text-text-muted mt-1">
                    {members.length || status.memberCount} / {status.maxMembers} · {countdown}
                  </p>
                </div>
                <span className="font-mono text-[10px] tracking-[0.14em] uppercase text-text-muted truncate max-w-[40%]">
                  {session.displayName}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto py-4 space-y-3">
                {messages.length === 0 && (
                  <p className="text-sm text-text-muted text-center py-10">No messages yet. Say something.</p>
                )}
                {messages.map((m) => {
                  const mine = m.memberId === session.memberId;
                  return (
                    <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[80%] px-4 py-2.5 ${
                          mine ? "bg-accent/15 border border-accent/30" : "bg-surface-raised border border-border"
                        }`}
                      >
                        <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-text-muted mb-1">
                          {mine ? "You" : m.displayName}
                        </p>
                        <p className="text-sm whitespace-pre-wrap break-words">{m.text}</p>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              {error && <p className="text-red-400 text-sm pb-2">{error}</p>}

              <form
                className="flex gap-2 pt-3 border-t border-border"
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleSend();
                }}
              >
                <input
                  type="text"
                  value={draft}
                  maxLength={2000}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Encrypted message"
                  className={`${fieldControl} min-h-11`}
                />
                <button
                  type="submit"
                  disabled={sending || !draft.trim()}
                  className="min-h-11 px-5 rounded-full bg-accent text-sm font-extrabold text-black hover:bg-accent-soft disabled:opacity-60"
                >
                  Send
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </SiteChrome>
  );
}
