import type { MetaFunction } from "@remix-run/node";
import { useEffect, useState, useRef } from "react";
import { ThemeToggle } from "../components/ThemeToggle";

export const meta: MetaFunction = () => [
  { title: "Messages — Secretlink.life" },
];

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

// ─── Crypto helpers (X25519 via Web Crypto / tweetnacl-compatible) ───────────
async function generateKeyPair(): Promise<{ publicKey: string; privateKey: string }> {
  const keyPair = await crypto.subtle.generateKey(
    { name: "X25519" } as any,
    true,
    ["deriveBits"]
  );
  const pubRaw = await crypto.subtle.exportKey("raw", keyPair.publicKey);
  const privRaw = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);
  return {
    publicKey: btoa(String.fromCharCode(...new Uint8Array(pubRaw))),
    privateKey: btoa(String.fromCharCode(...new Uint8Array(privRaw))),
  };
}

async function deriveSharedKey(privateKeyB64: string, publicKeyB64: string): Promise<CryptoKey> {
  const privBytes = Uint8Array.from(atob(privateKeyB64), c => c.charCodeAt(0));
  const pubBytes = Uint8Array.from(atob(publicKeyB64), c => c.charCodeAt(0));

  const privateKey = await crypto.subtle.importKey(
    "pkcs8", privBytes, { name: "X25519" } as any, false, ["deriveBits"]
  );
  const publicKey = await crypto.subtle.importKey(
    "raw", pubBytes, { name: "X25519" } as any, false, []
  );

  const sharedBits = await crypto.subtle.deriveBits(
    { name: "X25519", public: publicKey } as any, privateKey, 256
  );

  return crypto.subtle.importKey("raw", sharedBits, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function encryptMessage(text: string, sharedKey: CryptoKey): Promise<{ encrypted: string; nonce: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(text);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, sharedKey, encoded);
  return {
    encrypted: btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
    nonce: btoa(String.fromCharCode(...iv)),
  };
}

async function decryptMessage(encryptedB64: string, nonceB64: string, sharedKey: CryptoKey): Promise<string> {
  const ciphertext = Uint8Array.from(atob(encryptedB64), c => c.charCodeAt(0));
  const iv = Uint8Array.from(atob(nonceB64), c => c.charCodeAt(0));
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, sharedKey, ciphertext);
  return new TextDecoder().decode(decrypted);
}

function getApiBase() {
  const origin = window.location.origin;
  return window.location.port === "3000" ? origin.replace(":3000", ":4000") : origin;
}

function getToken() {
  return document.cookie.match(/sl_token=([^;]+)/)?.[1] ?? "";
}

export default function MessagesPage() {
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadProfile();
    loadConversations();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [decryptedMessages]);

  async function loadProfile() {
    const token = getToken();
    if (!token) { window.location.href = "/login"; return; }

    const res = await fetch(`${getApiBase()}/v1/users/me/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) { window.location.href = "/login"; return; }
    const data = await res.json();
    setMyUserId(data.id);
    setMyHandle(data.handle);

    // Ensure we have a keypair stored locally
    let keyPair = localStorage.getItem("sl_dm_keys");
    if (!keyPair) {
      const keys = await generateKeyPair();
      localStorage.setItem("sl_dm_keys", JSON.stringify(keys));
      keyPair = JSON.stringify(keys);
      // Register public key with server
      await fetch(`${getApiBase()}/v1/dms/keys`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ publicKey: keys.publicKey }),
      });
    }
  }

  async function loadConversations() {
    const token = getToken();
    if (!token) return;
    const res = await fetch(`${getApiBase()}/v1/dms/conversations`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) setConversations(await res.json());
  }

  async function openConversation(conv: Conversation) {
    setActiveConv(conv);
    if (pollRef.current) clearInterval(pollRef.current);

    // Derive shared key with the other participant
    const otherId = conv.participantIds.find(id => id !== myUserId)!;
    const keyPair = JSON.parse(localStorage.getItem("sl_dm_keys") || "{}");

    const keyRes = await fetch(`${getApiBase()}/v1/dms/keys/${otherId}`);
    if (keyRes.ok) {
      const { publicKey: otherPubKey } = await keyRes.json();
      const sk = await deriveSharedKey(keyPair.privateKey, otherPubKey);
      setSharedKey(sk);
      await loadMessages(conv.id, sk);

      // Poll for new messages
      pollRef.current = setInterval(() => loadMessages(conv.id, sk), 3000);
    }
  }

  async function loadMessages(convId: string, key: CryptoKey) {
    const token = getToken();
    const res = await fetch(`${getApiBase()}/v1/dms/conversations/${convId}/messages`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const msgs: DmMessage[] = await res.json();
    setMessages(msgs);

    // Decrypt all messages
    const decrypted = new Map<string, string>();
    for (const m of msgs) {
      try {
        decrypted.set(m.id, await decryptMessage(m.encryptedContent, m.nonce, key));
      } catch {
        decrypted.set(m.id, "[Unable to decrypt]");
      }
    }
    setDecryptedMessages(decrypted);
  }

  async function sendMessage() {
    if (!newMessage.trim() || !activeConv || !sharedKey) return;
    setSending(true);

    try {
      const { encrypted, nonce } = await encryptMessage(newMessage.trim(), sharedKey);
      const token = getToken();
      const res = await fetch(`${getApiBase()}/v1/dms/conversations/${activeConv.id}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ encryptedContent: encrypted, nonce, ttlMinutes: ttl }),
      });

      if (res.ok) {
        setNewMessage("");
        loadMessages(activeConv.id, sharedKey);
      }
    } finally {
      setSending(false);
    }
  }

  async function startNewConversation() {
    if (!newConvHandle.trim()) return;
    const token = getToken();
    const handle = newConvHandle.trim().replace(/^@/, "").toLowerCase();

    // Get recipient's profile to find userId
    const profileRes = await fetch(`${getApiBase()}/v1/users/${handle}`);
    if (!profileRes.ok) { alert("User not found"); return; }
    const profile = await profileRes.json();

    const res = await fetch(`${getApiBase()}/v1/dms/conversations`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ recipientId: profile.id, recipientHandle: handle }),
    });

    if (res.ok) {
      const conv = await res.json();
      setShowNewConv(false);
      setNewConvHandle("");
      loadConversations();
      openConversation(conv);
    }
  }

  function timeRemaining(expiresAt: string) {
    const ms = new Date(expiresAt).getTime() - Date.now();
    if (ms <= 0) return "expired";
    const mins = Math.floor(ms / 60000);
    if (mins < 1) return "<1m";
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  }

  return (
    <main className="h-screen flex flex-col bg-surface">
      {/* Nav */}
      <nav className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-border/50 z-20">
        <a href="/" className="flex items-center gap-2">
          <img src="/secretlink.png" alt="" className="w-7 h-7" />
          <span className="text-lg font-bold tracking-tight">
            secretlink<span className="text-accent">.</span>life
          </span>
        </a>
        <div className="flex items-center gap-3">
          <a href="/dashboard" className="text-sm text-text-muted hover:text-text">Dashboard</a>
          <ThemeToggle />
        </div>
      </nav>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar: conversations */}
        <aside className="w-72 border-r border-border/50 flex flex-col">
          <div className="p-4 border-b border-border/50 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Messages</h2>
            <button
              onClick={() => setShowNewConv(true)}
              className="text-xs bg-accent/10 text-accent px-2.5 py-1 rounded-full hover:bg-accent/20"
            >
              + New
            </button>
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
        <section className="flex-1 flex flex-col">
          {activeConv ? (
            <>
              {/* Chat header */}
              <div className="px-4 py-3 border-b border-border/50 flex items-center gap-2">
                <span className="text-sm font-semibold text-text">
                  @{activeConv.participantHandles.find(h => h !== myHandle)}
                </span>
                <span className="text-xs text-text-muted">• E2E Encrypted</span>
                <span className="ml-auto text-xs text-accent/70">🔒 Messages disappear</span>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                {messages.map((m) => {
                  const isMe = m.senderId === myUserId;
                  const text = decryptedMessages.get(m.id) || "...";
                  return (
                    <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${
                        isMe
                          ? "bg-accent text-black rounded-br-md"
                          : "bg-surface-raised border border-border text-text rounded-bl-md"
                      }`}>
                        <p className="text-sm break-words">{text}</p>
                        <div className={`flex items-center gap-2 mt-1 ${isMe ? "justify-end" : ""}`}>
                          <span className={`text-[10px] ${isMe ? "text-black/50" : "text-text-muted"}`}>
                            ⏳ {timeRemaining(m.expiresAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="px-4 py-3 border-t border-border/50">
                <div className="flex items-center gap-2">
                  <select
                    value={ttl}
                    onChange={(e) => setTtl(Number(e.target.value))}
                    className="text-xs bg-surface-raised border border-border rounded-lg px-2 py-2 text-text"
                  >
                    <option value={1}>1m</option>
                    <option value={5}>5m</option>
                    <option value={15}>15m</option>
                    <option value={60}>1h</option>
                    <option value={1440}>24h</option>
                  </select>
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
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
    </main>
  );
}
