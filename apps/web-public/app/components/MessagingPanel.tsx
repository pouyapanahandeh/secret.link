import { useEffect, useState, useRef } from "react";
import { Link } from "@remix-run/react";
import { getApiBase } from "../lib/api.client";
import {
  type StoredKeyPair,
  getStoredKeyPair,
  generateAndStoreKeyPair,
  migrateFromLocalStorage,
  deriveSharedKey as deriveSharedKeyFromCryptoKey,
  encryptMessage,
  decryptMessage,
} from "../lib/dm-crypto";

interface Conversation {
  id: string;
  participantIds: [string, string];
  participantHandles: [string, string];
  lastMessageAt: string;
}

interface DmMessage {
  id: string;
  senderId: string;
  senderHandle: string;
  encryptedContent: string;
  nonce: string;
  createdAt: string;
  expiresAt: string;
  readAt?: string;
}

interface MessagingPanelProps {
  token: string;
  /** Optional: auto-open conversation with this handle */
  toHandle?: string;
}

export function MessagingPanel({ token, toHandle }: MessagingPanelProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<DmMessage[]>([]);
  const [decryptedMessages, setDecryptedMessages] = useState<Map<string, string>>(new Map());
  const [newMessage, setNewMessage] = useState("");
  const [ttl, setTtl] = useState(5);
  const [sending, setSending] = useState(false);
  const [myUserId, setMyUserId] = useState("");
  const [myHandle, setMyHandle] = useState("");
  const [sharedKey, setSharedKey] = useState<CryptoKey | null>(null);
  const [newConvHandle, setNewConvHandle] = useState("");
  const [showNewConv, setShowNewConv] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [keyWarning, setKeyWarning] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesTopRef = useRef<HTMLDivElement>(null);
  const sseRef = useRef<EventSource | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasAutoOpenedRef = useRef(false);
  const lastFetchedAtRef = useRef<string | null>(null);
  const myKeyPairRef = useRef<StoredKeyPair | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSentRef = useRef(0);
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [tick, setTick] = useState(0);
  const PAGE_SIZE = 50;

  useEffect(() => {
    loadProfile();
    loadConversations();
    loadUnreadCount();
    const tickInterval = setInterval(() => setTick(t => t + 1), 10000);
    return () => {
      clearInterval(tickInterval);
      if (pollRef.current) clearInterval(pollRef.current);
      if (sseRef.current) sseRef.current.close();
    };
  }, []);

  useEffect(() => {
    function handleVisibility() {
      if (document.hidden) {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        if (sseRef.current) { sseRef.current.close(); sseRef.current = null; }
      } else {
        if (activeConv && sharedKey) {
          connectSSE(activeConv.id, sharedKey);
        }
        loadUnreadCount();
      }
    }
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [activeConv, sharedKey]);

  // Handle toHandle prop or ?to= param to auto-open conversation
  useEffect(() => {
    if (!myUserId || hasAutoOpenedRef.current) return;
    const handle = toHandle?.replace(/^@/, "").toLowerCase();
    if (!handle) return;

    hasAutoOpenedRef.current = true;
    const existing = conversations.find(c => c.participantHandles.includes(handle));
    if (existing) {
      openConversation(existing);
    } else {
      setNewConvHandle(handle);
      setShowNewConv(true);
    }
  }, [myUserId, conversations.length]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [decryptedMessages]);

  async function loadProfile() {
    const res = await fetch(`${getApiBase()}/v1/users/me/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) { window.location.href = "/login"; return; }
    const data = await res.json();
    setMyUserId(data.id);
    setMyHandle(data.handle);

    const { ensureAndPublishKey } = await import("../lib/dm-crypto");
    const kp = await ensureAndPublishKey(getApiBase(), token);
    if (!kp) {
      let fallback = await getStoredKeyPair();
      if (!fallback) fallback = await migrateFromLocalStorage();
      if (!fallback) fallback = await generateAndStoreKeyPair();
      myKeyPairRef.current = fallback;
      await fetch(`${getApiBase()}/v1/dms/keys`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ publicKey: fallback.publicKeyB64, deviceId: fallback.deviceId }),
      });
    } else {
      myKeyPairRef.current = kp;
    }
  }

  async function loadConversations() {
    const res = await fetch(`${getApiBase()}/v1/dms/conversations`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) setConversations(await res.json());
  }

  async function connectSSE(convId: string, key: CryptoKey) {
    if (sseRef.current) sseRef.current.close();
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }

    // Fetch a short-lived stream ticket instead of passing the JWT in the URL
    let ticketUrl: string | null = null;
    try {
      const ticketRes = await fetch(`${getApiBase()}/v1/dms/stream-ticket`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ conversationId: convId }),
      });
      if (ticketRes.ok) {
        const { ticket } = await ticketRes.json();
        ticketUrl = `${getApiBase()}/v1/dms/stream?ticket=${encodeURIComponent(ticket)}`;
      }
    } catch {}

    // Fallback to legacy token param if ticket fetch fails
    const url = ticketUrl ?? `${getApiBase()}/v1/dms/stream?token=${encodeURIComponent(token)}&conversationId=${convId}`;
    const sse = new EventSource(url);
    sseRef.current = sse;

    sse.addEventListener("new_message", async (e) => {
      try {
        const msg: DmMessage = JSON.parse(e.data);
        setMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        // Skip decryption if we already have plaintext (from optimistic send)
        const alreadyDecrypted = await new Promise<boolean>(resolve => {
          setDecryptedMessages(prev => { resolve(prev.has(msg.id)); return prev; });
        });
        if (!alreadyDecrypted) {
          try {
            const text = await decryptMessage(msg.encryptedContent, msg.nonce, key);
            setDecryptedMessages(prev => new Map([...prev, [msg.id, text]]));
          } catch {
            setDecryptedMessages(prev => new Map([...prev, [msg.id, "🔒 Unable to decrypt"]]));
          }
        }
        loadUnreadCount();
      } catch {}
    });

    sse.addEventListener("message_deleted", (e) => {
      try {
        const { messageId } = JSON.parse(e.data);
        setMessages(prev => prev.filter(m => m.id !== messageId));
        setDecryptedMessages(prev => { const next = new Map(prev); next.delete(messageId); return next; });
      } catch {}
    });

    sse.addEventListener("typing", () => {
      setIsOtherTyping(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => setIsOtherTyping(false), 3000);
    });

    sse.addEventListener("messages_read", (e) => {
      try {
        const { messageIds, readAt } = JSON.parse(e.data);
        setMessages(prev => prev.map(m =>
          messageIds.includes(m.id) ? { ...m, readAt } : m
        ));
      } catch {}
    });

    sse.onerror = () => {
      sse.close();
      sseRef.current = null;
      if (!pollRef.current && !document.hidden) {
        pollRef.current = setInterval(() => loadMessages(convId, key, true), 3000);
      }
    };
  }

  async function openConversation(conv: Conversation) {
    setActiveConv(conv);
    setMessages([]);
    setDecryptedMessages(new Map());
    setIsOtherTyping(false);
    lastFetchedAtRef.current = null;
    setHasMore(false);
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }

    const otherId = conv.participantIds.find(id => id !== myUserId)!;
    if (!myKeyPairRef.current) return;

    const keyRes = await fetch(`${getApiBase()}/v1/dms/keys/${otherId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!keyRes.ok) {
      setKeyWarning("Recipient has no encryption key yet.");
      return;
    }
    setKeyWarning("");

    const { publicKey: otherPubKey } = await keyRes.json();
    let sk: CryptoKey;
    try {
      sk = await deriveSharedKeyFromCryptoKey(myKeyPairRef.current.privateKey, otherPubKey);
    } catch {
      setKeyWarning("Key mismatch - cannot derive shared secret. The other user may have rotated their key.");
      return;
    }
    setSharedKey(sk);
    await loadMessages(conv.id, sk, false);
    connectSSE(conv.id, sk);
  }

  async function loadMessages(convId: string, key: CryptoKey, incremental: boolean) {
    const params = new URLSearchParams();
    if (incremental && lastFetchedAtRef.current) {
      params.set("since", lastFetchedAtRef.current);
    }
    params.set("limit", String(PAGE_SIZE));

    const res = await fetch(`${getApiBase()}/v1/dms/conversations/${convId}/messages?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const msgs: DmMessage[] = await res.json();

    if (incremental && lastFetchedAtRef.current) {
      if (msgs.length === 0) return;
      setMessages(prev => {
        const existingIds = new Set(prev.map(m => m.id));
        const newMsgs = msgs.filter(m => !existingIds.has(m.id));
        return [...prev, ...newMsgs];
      });
      const newDecrypted = new Map<string, string>();
      for (const m of msgs) {
        try { newDecrypted.set(m.id, await decryptMessage(m.encryptedContent, m.nonce, key)); }
        catch { newDecrypted.set(m.id, "[Unable to decrypt]"); }
      }
      setDecryptedMessages(prev => new Map([...prev, ...newDecrypted]));
    } else {
      setMessages(msgs);
      setHasMore(msgs.length >= PAGE_SIZE);
      const decrypted = new Map<string, string>();
      for (const m of msgs) {
        try { decrypted.set(m.id, await decryptMessage(m.encryptedContent, m.nonce, key)); }
        catch { decrypted.set(m.id, "[Unable to decrypt]"); }
      }
      setDecryptedMessages(decrypted);
    }

    if (msgs.length > 0) {
      lastFetchedAtRef.current = msgs[msgs.length - 1]!.createdAt;
    }
  }

  async function loadOlderMessages() {
    if (!activeConv || !sharedKey || loadingMore || messages.length === 0) return;
    setLoadingMore(true);
    const oldest = messages[0]!.createdAt;
    const params = new URLSearchParams({ before: oldest, limit: String(PAGE_SIZE) });
    const res = await fetch(`${getApiBase()}/v1/dms/conversations/${activeConv.id}/messages?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) { setLoadingMore(false); return; }
    const older: DmMessage[] = await res.json();
    setHasMore(older.length >= PAGE_SIZE);
    if (older.length > 0) {
      setMessages(prev => [...older, ...prev]);
      const dec = new Map<string, string>();
      for (const m of older) {
        try { dec.set(m.id, await decryptMessage(m.encryptedContent, m.nonce, sharedKey)); }
        catch { dec.set(m.id, "[Unable to decrypt]"); }
      }
      setDecryptedMessages(prev => new Map([...dec, ...prev]));
    }
    setLoadingMore(false);
  }

  function sendTyping() {
    if (!activeConv) return;
    const now = Date.now();
    if (now - lastTypingSentRef.current < 2000) return;
    lastTypingSentRef.current = now;
    fetch(`${getApiBase()}/v1/dms/conversations/${activeConv.id}/typing`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  }

  async function sendMessage() {
    if (!newMessage.trim() || !activeConv || !sharedKey) return;
    setSending(true);
    const text = newMessage.trim();

    try {
      const { encrypted, nonce } = await encryptMessage(text, sharedKey);
      const res = await fetch(`${getApiBase()}/v1/dms/conversations/${activeConv.id}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ encryptedContent: encrypted, nonce, ttlMinutes: ttl }),
      });

      if (res.ok) {
        const sentMsg: DmMessage = await res.json();
        // Optimistically add to UI with known plaintext (avoids decryption issues)
        setMessages(prev => prev.some(m => m.id === sentMsg.id) ? prev : [...prev, sentMsg]);
        setDecryptedMessages(prev => new Map([...prev, [sentMsg.id, text]]));
        setNewMessage("");
      }
    } finally {
      setSending(false);
    }
  }

  async function deleteMessage(msgId: string) {
    if (!activeConv) return;
    const res = await fetch(`${getApiBase()}/v1/dms/conversations/${activeConv.id}/messages/${msgId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      setMessages(prev => prev.filter(m => m.id !== msgId));
      setDecryptedMessages(prev => { const next = new Map(prev); next.delete(msgId); return next; });
    }
  }

  async function startNewConversation() {
    if (!newConvHandle.trim()) return;
    const handle = newConvHandle.trim().replace(/^@/, "").toLowerCase();

    const profileRes = await fetch(`${getApiBase()}/v1/users/${handle}`);
    if (!profileRes.ok) { alert("User not found"); return; }
    const profile = await profileRes.json();

    const res = await fetch(`${getApiBase()}/v1/dms/conversations`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ recipientId: profile.id }),
    });

    if (res.ok) {
      const conv = await res.json();
      setShowNewConv(false);
      setNewConvHandle("");
      loadConversations();
      openConversation(conv);
    }
  }

  async function loadUnreadCount() {
    const res = await fetch(`${getApiBase()}/v1/dms/unread`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setUnreadCount(data.count);
    }
  }

  async function deleteConversation(convId: string) {
    if (!confirm("Delete this conversation? All messages will be permanently removed.")) return;
    const res = await fetch(`${getApiBase()}/v1/dms/conversations/${convId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      if (sseRef.current) { sseRef.current.close(); sseRef.current = null; }
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      setActiveConv(null);
      setMessages([]);
      setDecryptedMessages(new Map());
      loadConversations();
    }
  }

  async function rotateKeys() {
    if (!confirm("Generate new encryption keys? Messages encrypted with your old key will become unreadable for new conversations.")) return;
    const kp = await generateAndStoreKeyPair();
    myKeyPairRef.current = kp;
    await fetch(`${getApiBase()}/v1/dms/keys`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ publicKey: kp.publicKeyB64, deviceId: kp.deviceId }),
    });
    alert("Keys rotated. Existing conversations still use the old shared secret until re-opened.");
  }

  function timeRemaining(expiresAt: string, _tick?: number) {
    const ms = new Date(expiresAt).getTime() - Date.now();
    if (ms <= 0) return "expired";
    if (ms < 60000) return `${Math.ceil(ms / 1000)}s`;
    const mins = Math.floor(ms / 60000);
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  }

  return (
    <div className="flex-1 flex overflow-hidden h-full">
      {/* Sidebar: conversations */}
      <aside className={`${activeConv ? "hidden sm:flex" : "flex"} w-full sm:w-72 border-r border-border/50 flex-col`}>
        <div className="p-4 border-b border-border/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link to="/dashboard" className="sm:hidden text-text-muted hover:text-text mr-1">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h2 className="text-sm font-semibold">Messages</h2>
            {unreadCount > 0 && (
              <span className="bg-accent text-black text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={rotateKeys} className="text-xs text-text-muted hover:text-accent" title="Rotate encryption keys">
              🔑
            </button>
            <button
              onClick={() => setShowNewConv(true)}
              className="text-xs bg-accent/10 text-accent px-2.5 py-1 rounded-full hover:bg-accent/20"
            >
              + New
            </button>
          </div>
        </div>

        {showNewConv && (
          <div className="p-3 border-b border-border/50">
            <input
              type="text"
              value={newConvHandle}
              onChange={(e) => setNewConvHandle(e.target.value)}
              placeholder="@handle"
              onKeyDown={(e) => e.key === "Enter" && startNewConversation()}
              className="w-full rounded-lg bg-surface-raised border border-border px-3 py-2 text-sm text-text placeholder:text-text-muted/40 focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
            <button
              onClick={startNewConversation}
              className="w-full mt-2 text-xs bg-accent text-black rounded-lg py-1.5 font-semibold"
            >
              Start Chat
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {conversations.map((conv) => {
            const otherHandle = conv.participantHandles.find(h => h !== myHandle) ?? "?";
            return (
              <button
                key={conv.id}
                onClick={() => openConversation(conv)}
                className={`w-full text-left px-4 py-3 border-b border-border/30 hover:bg-surface-raised transition-colors ${
                  activeConv?.id === conv.id ? "bg-surface-raised" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-text">@{otherHandle}</span>
                  <span className="text-xs text-text-muted">
                    {new Date(conv.lastMessageAt).toLocaleDateString()}
                  </span>
                </div>
              </button>
            );
          })}
          {conversations.length === 0 && !showNewConv && (
            <p className="text-xs text-text-muted text-center mt-8 px-4">
              No conversations yet. Start one!
            </p>
          )}
        </div>
      </aside>

      {/* Chat area */}
      <section className={`${activeConv ? "flex" : "hidden sm:flex"} flex-1 flex-col`}>
        {activeConv ? (
          <>
            {/* Chat header */}
            <div className="px-4 py-3 border-b border-border/50 flex items-center gap-2">
              <button
                onClick={() => setActiveConv(null)}
                className="sm:hidden text-text-muted hover:text-text mr-2"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="text-sm font-semibold text-text">
                @{activeConv.participantHandles.find(h => h !== myHandle)}
              </span>
              <span className="text-xs text-text-muted">• E2E Encrypted</span>
              <span className="ml-auto flex items-center gap-3">
                <span className="text-xs text-accent/70 hidden sm:inline">🔒 Messages disappear</span>
                <button
                  onClick={() => deleteConversation(activeConv.id)}
                  className="text-text-muted hover:text-red-400 transition-colors"
                  title="Delete conversation"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </span>
            </div>

            {/* Timer selector bar */}
            <div className="px-4 py-2.5 border-b-2 border-accent/30 flex items-center gap-2" style={{background: 'rgba(255,252,0,0.07)'}}>
              <span className="text-xs font-semibold text-text whitespace-nowrap">⏱ Timer:</span>
              {[{v:1,l:"1 min"},{v:5,l:"5 min"},{v:15,l:"15 min"},{v:60,l:"1 hr"},{v:1440,l:"24 hr"}].map(o => (
                <button
                  key={o.v}
                  onClick={() => setTtl(o.v)}
                  style={ttl === o.v ? {background: '#FFFC00', color: '#000', fontWeight: 700} : {}}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    ttl === o.v
                      ? "shadow-sm"
                      : "bg-surface-raised border border-border text-text-muted hover:text-text hover:border-accent/50"
                  }`}
                >
                  {o.l}
                </button>
              ))}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {keyWarning && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 text-xs rounded-lg px-3 py-2 text-center">
                  🔑 {keyWarning}
                </div>
              )}
              {hasMore && (
                <div className="text-center">
                  <button
                    onClick={loadOlderMessages}
                    disabled={loadingMore}
                    className="text-xs text-accent hover:text-accent/80 disabled:opacity-50"
                  >
                    {loadingMore ? "Loading..." : "↑ Load older messages"}
                  </button>
                </div>
              )}
              <div ref={messagesTopRef} />
              {messages.map((m) => {
                const isMe = m.senderId === myUserId;
                const text = decryptedMessages.get(m.id) || "...";
                const isUndecryptable = text === "[Unable to decrypt]";
                const remaining = timeRemaining(m.expiresAt, tick);
                const isExpired = remaining === "expired";
                if (isExpired) return null;
                return (
                  <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"} group`}>
                    <div className={`max-w-[80%] sm:max-w-[70%] rounded-2xl px-4 py-2.5 relative ${
                      isMe
                        ? "bg-accent text-black rounded-br-md"
                        : "bg-surface-raised border border-border text-text rounded-bl-md"
                    } ${isUndecryptable ? "opacity-60" : ""}`}>
                      <p className="text-sm break-words">
                        {isUndecryptable ? "🔒 Encrypted - key mismatch" : text}
                      </p>
                      <div className={`flex items-center gap-2 mt-1 ${isMe ? "justify-end" : ""}`}>
                        <span className={`text-[10px] ${isMe ? "text-black/50" : "text-text-muted"}`}>
                          ⏳ {remaining}
                        </span>
                        {isMe && (
                          <span className={`text-[10px] ${isMe ? "text-black/50" : "text-text-muted"}`}>
                            {m.readAt ? "✓✓ seen" : "✓ sent"}
                          </span>
                        )}
                        {isMe && (
                          <button
                            onClick={() => deleteMessage(m.id)}
                            className="text-[10px] opacity-0 group-hover:opacity-100 transition-opacity text-black/40 hover:text-red-600"
                            title="Delete message"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Typing indicator */}
            {isOtherTyping && (
              <div className="px-4 pb-1">
                <span className="text-xs text-text-muted animate-pulse">typing...</span>
              </div>
            )}

            {/* Input - pinned to bottom */}
            <div className="mt-auto border-t border-border/50">
              <div className="px-4 py-3 flex items-center gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => { setNewMessage(e.target.value); sendTyping(); }}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                  placeholder="Type a message..."
                  className="flex-1 rounded-xl bg-surface-raised border border-border px-4 py-2.5 text-sm text-text placeholder:text-text-muted/40 focus:outline-none focus:ring-2 focus:ring-accent/50"
                />
                <button
                  onClick={sendMessage}
                  disabled={sending || !newMessage.trim()}
                  className="rounded-full bg-accent px-4 py-2.5 text-sm font-bold text-black hover:scale-[1.02] transition-all disabled:opacity-50"
                >
                  {sending ? "..." : "Send"}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <p className="text-4xl mb-3">🔒</p>
              <p className="text-sm text-text-muted">Select a conversation or start a new one</p>
              <p className="text-xs text-text-muted/60 mt-1">End-to-end encrypted • Messages disappear</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
