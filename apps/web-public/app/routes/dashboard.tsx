import type { MetaFunction, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { useState, useEffect, useRef } from "react";
import { ThemeToggle } from "../components/ThemeToggle";
import { MessagingPanel } from "../components/MessagingPanel";

// ─── DM Crypto helpers ────────────────────────────────────────────────────────
async function dmGenerateKeyPair(): Promise<{ publicKey: string; privateKey: string }> {
  const keyPair = await crypto.subtle.generateKey(
    { name: "X25519" } as any, true, ["deriveBits"]
  );
  const pubRaw = await crypto.subtle.exportKey("raw", keyPair.publicKey);
  const privRaw = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);
  return {
    publicKey: btoa(String.fromCharCode(...new Uint8Array(pubRaw))),
    privateKey: btoa(String.fromCharCode(...new Uint8Array(privRaw))),
  };
}

async function dmDeriveSharedKey(privateKeyB64: string, publicKeyB64: string): Promise<CryptoKey> {
  const privBytes = Uint8Array.from(atob(privateKeyB64), c => c.charCodeAt(0));
  const pubBytes = Uint8Array.from(atob(publicKeyB64), c => c.charCodeAt(0));
  const privateKey = await crypto.subtle.importKey("pkcs8", privBytes, { name: "X25519" } as any, false, ["deriveBits"]);
  const publicKey = await crypto.subtle.importKey("raw", pubBytes, { name: "X25519" } as any, false, []);
  const sharedBits = await crypto.subtle.deriveBits({ name: "X25519", public: publicKey } as any, privateKey, 256);
  return crypto.subtle.importKey("raw", sharedBits, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function dmEncrypt(text: string, sharedKey: CryptoKey): Promise<{ encrypted: string; nonce: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(text);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, sharedKey, encoded);
  return {
    encrypted: btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
    nonce: btoa(String.fromCharCode(...iv)),
  };
}

async function dmDecrypt(encryptedB64: string, nonceB64: string, sharedKey: CryptoKey): Promise<string> {
  try {
    const ciphertext = Uint8Array.from(atob(encryptedB64), c => c.charCodeAt(0));
    const iv = Uint8Array.from(atob(nonceB64), c => c.charCodeAt(0));
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, sharedKey, ciphertext);
    return new TextDecoder().decode(decrypted);
  } catch {
    return encryptedB64; // fallback for legacy plaintext messages
  }
}

export const meta: MetaFunction = () => [
  { title: "Dashboard — Secretlink.life" },
];

const API_URL = process.env["API_URL"] ?? "http://localhost:4000";

export async function loader({ request }: LoaderFunctionArgs) {
  const cookieHeader = request.headers.get("Cookie") ?? "";
  const token = cookieHeader.match(/sl_token=([^;]+)/)?.[1];

  if (!token) {
    return redirect("/login");
  }

  const profileRes = await fetch(`${API_URL}/v1/users/me/profile`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!profileRes.ok) {
    return redirect("/login");
  }

  const user = await profileRes.json();

  const inboxRes = await fetch(`${API_URL}/v1/secrets/inbox/${user.handle}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const inbox = inboxRes.ok ? await inboxRes.json() : [];

  const sentRes = await fetch(`${API_URL}/v1/secrets/sent/${user.id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const sent = sentRes.ok ? await sentRes.json() : [];

  return json({ user, inbox, sent, token });
}

export default function Dashboard() {
  const { user, inbox, sent, token } = useLoaderData<typeof loader>();
  const [activeTab, setActiveTab] = useState<"inbox" | "map" | "messages" | "profile">("inbox");
  const [passkeyStatus, setPasskeyStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [passkeyError, setPasskeyError] = useState("");
  const [hasPasskey, setHasPasskey] = useState(user.hasPasskey);
  const [bio, setBio] = useState(user.bio ?? "");
  const [socials, setSocials] = useState<{ platform: string; url: string }[]>(user.socials ?? []);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  // Read tab from URL hash on mount
  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (hash === "map" || hash === "messages" || hash === "profile" || hash === "inbox") {
      setActiveTab(hash);
    }
  }, []);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  // Follow state
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});

  // Map state
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const mapPinMarkerRef = useRef<any>(null);
  const [mapSecrets, setMapSecrets] = useState<any[]>([]);
  const [selectedMapSecret, setSelectedMapSecret] = useState<any>(null);
  const [mapSecretRevealed, setMapSecretRevealed] = useState(false);
  const [showMapPost, setShowMapPost] = useState(false);
  const [mapClickedPos, setMapClickedPos] = useState<{ lat: number; lng: number } | null>(null);
  const [mapMessage, setMapMessage] = useState("");
  const [mapEmoji, setMapEmoji] = useState("💬");
  const [mapTtl, setMapTtl] = useState(60);
  const [mapPosting, setMapPosting] = useState(false);
  const [mapFile, setMapFile] = useState<File | null>(null);
  const [mapFilePreview, setMapFilePreview] = useState<string | null>(null);
  const mapFileInputRef = useRef<HTMLInputElement>(null);
  const [mapRevealMode, setMapRevealMode] = useState<"timer" | "clicks">("timer");
  const [mapRevealTimer, setMapRevealTimer] = useState(30);
  const [mapMaxClicks, setMapMaxClicks] = useState(3);
  const [revealCountdown, setRevealCountdown] = useState<number | null>(null);
  const revealTimerRef = useRef<any>(null);

  // DM state
  const [dmConversations, setDmConversations] = useState<any[]>([]);
  const [dmActiveConv, setDmActiveConv] = useState<any>(null);
  const [dmMessages, setDmMessages] = useState<any[]>([]);
  const [dmDecrypted, setDmDecrypted] = useState<Map<string, string>>(new Map());
  const [dmNewMessage, setDmNewMessage] = useState("");
  const [dmSending, setDmSending] = useState(false);
  const [dmNewConvHandle, setDmNewConvHandle] = useState("");
  const [dmShowNewConv, setDmShowNewConv] = useState(false);
  const [dmLoaded, setDmLoaded] = useState(false);
  const [dmSharedKey, setDmSharedKey] = useState<CryptoKey | null>(null);
  const dmMessagesEndRef = useRef<HTMLDivElement>(null);

  function getApiBase() {
    const origin = window.location.origin;
    return window.location.port === "3000" ? origin.replace(":3000", ":4000") : origin;
  }

  async function searchUsers(q: string) {
    if (q.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const res = await fetch(`${getApiBase()}/v1/users/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const results = await res.json();
        setSearchResults(results);
        // Check follow status for each result
        const followMap: Record<string, boolean> = {};
        await Promise.all(results.map(async (u: any) => {
          if (u.id === user.id) return;
          try {
            const fRes = await fetch(`${getApiBase()}/v1/users/follow/${u.id}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (fRes.ok) {
              const fData = await fRes.json();
              followMap[u.id] = fData.isFollowing;
            }
          } catch {}
        }));
        setFollowingMap(prev => ({ ...prev, ...followMap }));
      }
    } finally {
      setSearching(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => { if (searchQuery) searchUsers(searchQuery); }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  async function toggleFollow(targetId: string) {
    const isFollowing = followingMap[targetId];
    const method = isFollowing ? "DELETE" : "POST";
    const res = await fetch(`${getApiBase()}/v1/users/follow/${targetId}`, {
      method,
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setFollowingMap(prev => ({ ...prev, [targetId]: data.following }));
    }
  }

  async function handleAddPasskey() {
    setPasskeyStatus("loading");
    setPasskeyError("");
    try {
      const { startRegistration } = await import("@simplewebauthn/browser");
      const apiBase = getApiBase();
      const optionsRes = await fetch(`${apiBase}/v1/users/me/passkey/register-options`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!optionsRes.ok) throw new Error("Failed to get registration options");
      const options = await optionsRes.json();
      const credential = await startRegistration({ optionsJSON: options });
      const verifyRes = await fetch(`${apiBase}/v1/users/me/passkey/register-verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(credential),
      });
      if (!verifyRes.ok) throw new Error("Passkey verification failed");
      setPasskeyStatus("done");
      setHasPasskey(true);
    } catch (err: any) {
      setPasskeyStatus("error");
      setPasskeyError(err?.message ?? "Something went wrong");
    }
  }

  async function saveProfile() {
    setProfileSaving(true);
    setProfileSaved(false);
    try {
      const res = await fetch(`${getApiBase()}/v1/users/me/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ bio, socials: socials.filter(s => s.url) }),
      });
      if (res.ok) {
        setProfileSaved(true);
        setTimeout(() => setProfileSaved(false), 3000);
      } else {
        alert("Failed to save profile. Please try again.");
      }
    } finally {
      setProfileSaving(false);
    }
  }

  function addSocial() { setSocials([...socials, { platform: "", url: "" }]); }
  function removeSocial(i: number) { setSocials(socials.filter((_, idx) => idx !== i)); }
  function updateSocial(i: number, field: "platform" | "url", value: string) {
    const updated = [...socials];
    updated[i] = { ...updated[i], [field]: value };
    setSocials(updated);
  }

  const navItems = [
    { id: "inbox" as const, label: "Home", icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /></svg> },
    { id: "map" as const, label: "Map", icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503-11.307l4.994-2.497A.75.75 0 0121 4.196v13.608a.75.75 0 01-.497.708l-5.006 2.503m-6.994-3.015l-5.006 2.503A.75.75 0 013 19.804V6.196a.75.75 0 01.497-.708l5.006-2.503m6.994 3.015L9 4.485m6.497 1.53L9 8.515" /></svg> },
    { id: "messages" as const, label: "Messages", icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443h.004c2.174-.063 4.322-.258 6.426-.573 1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" /></svg> },
    { id: "profile" as const, label: "Profile", icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg> },
  ];

  function handleNavClick(id: string) {
    setActiveTab(id as any);
  }

  // ─── Map functions ────────────────────────────────────────────────────────
  useEffect(() => {
    if (activeTab !== "map") return;

    // Load Leaflet dynamically
    const existingLink = document.querySelector('link[href*="leaflet"]');
    if (!existingLink) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    const existingScript = document.querySelector('script[src*="leaflet"]');
    if (existingScript) {
      // Small delay to ensure DOM is ready
      setTimeout(() => initMapTab(), 50);
    } else {
      const script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.onload = () => initMapTab();
      document.head.appendChild(script);
    }

    return () => {
      // Destroy map when leaving tab so it re-inits fresh next time
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [activeTab]);

  function initMapTab() {
    const L = (window as any).L;
    if (!L || !mapContainerRef.current) return;

    const map = L.map(mapContainerRef.current, { zoomControl: false }).setView([51.505, -0.09], 3);
    mapInstanceRef.current = map;

    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: '',
      maxZoom: 19,
    }).addTo(map);

    map.attributionControl.remove();

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => map.setView([pos.coords.latitude, pos.coords.longitude], 13),
        () => {}
      );
    }

    map.on("click", (e: any) => {
      setMapClickedPos({ lat: e.latlng.lat, lng: e.latlng.lng });
      setShowMapPost(true);
      setSelectedMapSecret(null);
      // Show pin marker
      const L = (window as any).L;
      if (mapPinMarkerRef.current) map.removeLayer(mapPinMarkerRef.current);
      const pinIcon = L.divIcon({
        html: '<div style="font-size:28px;text-align:center;line-height:34px;">📍</div>',
        className: "",
        iconSize: [34, 34],
        iconAnchor: [17, 34],
      });
      mapPinMarkerRef.current = L.marker([e.latlng.lat, e.latlng.lng], { icon: pinIcon }).addTo(map);
    });

    loadMapSecrets(map);
  }

  async function loadMapSecrets(map?: any) {
    const m = map || mapInstanceRef.current;
    const L = (window as any).L;
    if (!L || !m) return;

    try {
      const res = await fetch(`${getApiBase()}/v1/secrets/map`);
      if (!res.ok) return;
      const data = await res.json();
      setMapSecrets(data);

      m.eachLayer((layer: any) => { if (layer._isSecretMarker) m.removeLayer(layer); });

      data.forEach((s: any) => {
        const icon = L.divIcon({
          className: "secret-marker",
          html: `<div style="font-size:24px;cursor:pointer;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5))">${s.emoji}</div>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        });
        const marker = L.marker([s.lat, s.lng], { icon }).addTo(m);
        marker._isSecretMarker = true;
        marker.on("click", () => { setSelectedMapSecret(s); setMapSecretRevealed(false); setShowMapPost(false); });
      });
    } catch {}
  }

  async function postMapSecret() {
    if (!mapClickedPos || !mapMessage.trim()) return;
    setMapPosting(true);
    try {
      let mediaPath: string | null = null;
      let mediaType: string | null = null;

      // Upload file first if attached
      if (mapFile) {
        const uploadRes = await fetch(`${getApiBase()}/v1/secrets/blob`, {
          method: "POST",
          body: mapFile,
        });
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          mediaPath = uploadData.blobPath;
          mediaType = mapFile.type;
        }
      }

      const res = await fetch(`${getApiBase()}/v1/secrets/map`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: mapMessage.trim(),
          lat: mapClickedPos.lat,
          lng: mapClickedPos.lng,
          emoji: mapEmoji,
          ttlMinutes: mapTtl,
          handle: user.handle,
          mediaPath,
          mediaType,
          revealMode: mapRevealMode,
          revealTimerSeconds: mapRevealMode === "timer" ? mapRevealTimer : undefined,
          maxClicks: mapRevealMode === "clicks" ? mapMaxClicks : undefined,
        }),
      });
      if (res.ok) {
        setMapMessage("");
        setShowMapPost(false);
        setMapClickedPos(null);
        setMapFile(null);
        setMapFilePreview(null);
        if (mapPinMarkerRef.current && mapInstanceRef.current) { mapInstanceRef.current.removeLayer(mapPinMarkerRef.current); mapPinMarkerRef.current = null; }
        loadMapSecrets();
      }
    } finally {
      setMapPosting(false);
    }
  }

  function handleMapFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setMapFile(file);
    if (file.type.startsWith("image/") || file.type.startsWith("video/")) {
      setMapFilePreview(URL.createObjectURL(file));
    } else {
      setMapFilePreview(null);
    }
  }

  function mapTimeRemaining(expiresAt: string) {
    if (!expiresAt) return "Unknown";
    // Handle SQLite datetime format (YYYY-MM-DD HH:MM:SS) by adding T separator
    const normalized = expiresAt.includes("T") ? expiresAt : expiresAt.replace(" ", "T") + "Z";
    const ms = new Date(normalized).getTime() - Date.now();
    if (isNaN(ms) || ms <= 0) return "Expired";
    const mins = Math.floor(ms / 60000);
    if (mins < 60) return `${mins}m left`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m left`;
  }

  // ─── DM functions ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (activeTab !== "messages" || dmLoaded) return;
    loadDmConversations();
    setDmLoaded(true);
  }, [activeTab]);

  useEffect(() => {
    dmMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [dmMessages]);

  async function loadDmConversations() {
    try {
      const res = await fetch(`${getApiBase()}/v1/dms/conversations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setDmConversations(await res.json());
    } catch {}
  }

  async function openDmConversation(conv: any) {
    setDmActiveConv(conv);
    setDmDecrypted(new Map());
    try {
      // Ensure we have a keypair
      let keyPairStr = localStorage.getItem("sl_dm_keys");
      if (!keyPairStr) {
        const keys = await dmGenerateKeyPair();
        localStorage.setItem("sl_dm_keys", JSON.stringify(keys));
        keyPairStr = JSON.stringify(keys);
        await fetch(`${getApiBase()}/v1/dms/keys`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ publicKey: keys.publicKey }),
        });
      }
      const keyPair = JSON.parse(keyPairStr);

      // Get other participant's public key
      const otherId = conv.participantIds.find((id: string) => id !== user.id);
      const keyRes = await fetch(`${getApiBase()}/v1/dms/keys/${otherId}`);
      let sk: CryptoKey | null = null;
      if (keyRes.ok) {
        const { publicKey: otherPubKey } = await keyRes.json();
        sk = await dmDeriveSharedKey(keyPair.privateKey, otherPubKey);
        setDmSharedKey(sk);
      }

      // Load messages
      const res = await fetch(`${getApiBase()}/v1/dms/conversations/${conv.id}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const msgs = await res.json();
        setDmMessages(msgs);
        // Decrypt all messages
        if (sk) {
          const decMap = new Map<string, string>();
          for (const m of msgs) {
            const text = await dmDecrypt(m.encryptedContent, m.nonce, sk);
            decMap.set(m.id, text);
          }
          setDmDecrypted(decMap);
        }
      }
    } catch {}
  }

  async function sendDmMessage() {
    if (!dmActiveConv || !dmNewMessage.trim()) return;
    setDmSending(true);
    try {
      let encryptedContent = dmNewMessage.trim();
      let nonce = "plain";

      if (dmSharedKey) {
        const encrypted = await dmEncrypt(dmNewMessage.trim(), dmSharedKey);
        encryptedContent = encrypted.encrypted;
        nonce = encrypted.nonce;
      }

      const res = await fetch(`${getApiBase()}/v1/dms/conversations/${dmActiveConv.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ encryptedContent, nonce, ttlMinutes: 60 }),
      });
      if (res.ok) {
        setDmNewMessage("");
        openDmConversation(dmActiveConv);
      }
    } finally {
      setDmSending(false);
    }
  }

  async function startNewDmConversation() {
    if (!dmNewConvHandle.trim()) return;
    const handle = dmNewConvHandle.trim().replace(/^@/, "").toLowerCase();
    try {
      // First get the user
      const userRes = await fetch(`${getApiBase()}/v1/users/${handle}`);
      if (!userRes.ok) return;
      const targetUser = await userRes.json();

      const res = await fetch(`${getApiBase()}/v1/dms/conversations`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ recipientId: targetUser.id, recipientHandle: targetUser.handle }),
      });
      if (res.ok) {
        const conv = await res.json();
        setDmShowNewConv(false);
        setDmNewConvHandle("");
        loadDmConversations();
        openDmConversation(conv);
      }
    } catch {}
  }

  return (
    <main className="h-screen flex flex-col sm:flex-row bg-surface">
      {/* ─── Desktop Sidebar (sm+) ─── */}
      <aside className="hidden sm:flex flex-col w-56 lg:w-64 border-r border-border/50 bg-surface shrink-0">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-border/50">
          <a href="/dashboard" className="flex items-center gap-2">
            <img src="/secretlink.png" alt="" className="w-7 h-7" />
            <span className="text-lg font-bold tracking-tight">
              secretlink<span className="text-accent">.</span>life
            </span>
          </a>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeTab === item.id
                  ? "bg-accent/10 text-accent"
                  : "text-text-muted hover:text-text hover:bg-surface-raised"
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
              {item.id === "inbox" && inbox.length > 0 && (
                <span className="ml-auto text-xs bg-accent/20 text-accent px-2 py-0.5 rounded-full">{inbox.length}</span>
              )}
            </button>
          ))}
        </nav>

        {/* Bottom of sidebar */}
        <div className="px-3 py-4 border-t border-border/50 space-y-2">
          <div className="flex items-center justify-between px-3">
            <ThemeToggle />
            <form method="post" action="/logout">
              <button type="submit" className="text-xs text-text-muted hover:text-text">
                Log out
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* ─── Mobile Header ─── */}
      {activeTab !== "messages" && (
      <header className="sm:hidden flex items-center justify-between px-4 py-3 border-b border-border/50 bg-surface shrink-0">
        <a href="/dashboard" className="flex items-center gap-2">
          <img src="/secretlink.png" alt="" className="w-6 h-6" />
        </a>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <form method="post" action="/logout">
            <button type="submit" className="text-xs text-text-muted hover:text-text">
              Log out
            </button>
          </form>
        </div>
      </header>
      )}

      {/* Content area */}
      {activeTab === "messages" ? (
        <div className="flex-1 min-h-0 flex overflow-hidden">
          <MessagingPanel token={token} />
        </div>
      ) : (
      <div className="flex-1 overflow-y-auto pb-20 sm:pb-6">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4 sm:py-6">

          {/* ─── INBOX TAB ─── */}
          {activeTab === "inbox" && (
            <section>
              {/* Profile summary card */}
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-full bg-accent/20 border-2 border-accent flex items-center justify-center shrink-0">
                  <span className="text-lg font-bold text-accent">{user.handle[0]?.toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="text-base sm:text-lg font-bold truncate">@{user.handle}</h1>
                  <p className="text-xs text-text-muted truncate">
                    {user.email ?? "No email"} · {user.isPro ? "Pro ⭐" : "Free"}
                  </p>
                </div>
                <a href={`/${user.handle}`} className="shrink-0 text-xs bg-accent/10 text-accent px-3 py-1.5 rounded-full">
                  View
                </a>
              </div>

              {/* Quick link */}
              <div className="flex items-center gap-2 mb-6 bg-surface-raised rounded-xl border border-border px-3 py-2.5">
                <span className="text-xs text-text-muted shrink-0">🔗</span>
                <code className="text-xs sm:text-sm text-text truncate flex-1">secretlink.life/@{user.handle}</code>
                <button
                  onClick={() => navigator.clipboard?.writeText(`https://secretlink.life/@${user.handle}`)}
                  className="text-xs text-accent shrink-0"
                >
                  Copy
                </button>
              </div>

              {/* Search */}
              <div className="mb-6">
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search @username..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface-raised border border-border text-sm text-text placeholder:text-text-muted/40 focus:outline-none focus:ring-2 focus:ring-accent/50"
                  />
                </div>
                {searching && <p className="text-xs text-text-muted text-center mt-2">Searching...</p>}
                {searchResults.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {searchResults.map((u: any) => (
                      <div key={u.id} className="flex items-center gap-3 bg-surface-raised rounded-xl border border-border p-3">
                        <a href={`/${u.handle}`} className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-9 h-9 rounded-full bg-accent/20 border border-accent/50 flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-accent">{u.handle[0]?.toUpperCase()}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">@{u.handle} {u.isPro && "⭐"}</p>
                            {u.bio && <p className="text-xs text-text-muted truncate">{u.bio}</p>}
                          </div>
                        </a>
                        {u.id !== user.id && (
                          <button
                            onClick={() => toggleFollow(u.id)}
                            className={`shrink-0 text-xs px-3 py-1.5 rounded-full font-medium transition-all ${
                              followingMap[u.id]
                                ? "bg-surface border border-border text-text-muted"
                                : "bg-accent text-black"
                            }`}
                          >
                            {followingMap[u.id] ? "Following" : "Follow"}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
                  <p className="text-xs text-text-muted text-center mt-3">No users found</p>
                )}
              </div>

              {/* Passkey */}
              {!hasPasskey && (
                <button
                  onClick={handleAddPasskey}
                  disabled={passkeyStatus === "loading"}
                  className="w-full mb-4 text-sm bg-surface-raised border border-border text-text px-4 py-3 rounded-xl hover:border-accent/50 transition-colors disabled:opacity-50"
                >
                  {passkeyStatus === "loading" ? "Setting up..." : "🔑 Add passkey for faster login"}
                </button>
              )}
              {passkeyError && <p className="text-red-400 text-xs mb-4">{passkeyError}</p>}

              {/* Inbox list */}
              <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
                📥 Inbox
                {inbox.length > 0 && <span className="text-xs bg-accent/20 text-accent px-2 py-0.5 rounded-full">{inbox.length}</span>}
              </h2>

              {inbox.length === 0 ? (
                <div className="bg-surface-raised rounded-xl border border-border p-6 text-center">
                  <span className="text-3xl block mb-2">📥</span>
                  <p className="text-sm text-text-muted">No secrets yet</p>
                  <p className="text-xs text-text-muted/60 mt-1">Share your link to receive secrets</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {inbox.map((secret: any) => (
                    <Link
                      key={secret.id}
                      to={`/s/${secret.id}`}
                      className="flex items-center gap-3 bg-surface-raised rounded-xl border border-border p-3 sm:p-4 hover:border-accent/50 transition-colors active:scale-[0.98]"
                    >
                      <span className="text-xl">
                        {secret.contentType === "text" ? "💬" : secret.contentType === "image" ? "🖼️" : "📎"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{secret.contentType} secret</p>
                        <p className="text-xs text-text-muted">
                          {secret.burned ? "🔥 Burned" : secret.viewCount > 0 ? "👁️ Viewed" : "✨ New"}
                        </p>
                      </div>
                      <span className="text-xs text-text-muted shrink-0">
                        {new Date(secret.createdAt).toLocaleDateString()}
                      </span>
                    </Link>
                  ))}
                </div>
              )}

              {/* Sent section */}
              <h2 className="text-sm font-semibold mt-8 mb-3">📤 Sent</h2>
              {sent.length === 0 ? (
                <div className="bg-surface-raised rounded-xl border border-border p-6 text-center">
                  <p className="text-sm text-text-muted">No secrets sent</p>
                  <Link to="/send" className="text-xs text-accent mt-1 inline-block">Send one →</Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {sent.map((secret: any) => (
                    <div key={secret.id} className="flex items-center gap-3 bg-surface-raised rounded-xl border border-border p-3 sm:p-4">
                      <span className="text-xl">
                        {secret.contentType === "text" ? "💬" : "📎"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          → {secret.recipientHandle ? `@${secret.recipientHandle}` : "Link"}
                        </p>
                        <p className="text-xs text-text-muted">
                          {secret.burned ? "🔥 Burned" : secret.viewCount > 0 ? `👁️ ${secret.viewCount}/${secret.maxViews}` : "⏳ Pending"}
                        </p>
                      </div>
                      <span className="text-xs text-text-muted shrink-0">
                        {new Date(secret.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}



          {/* ─── MESSAGES TAB ─── (rendered outside this container) */}

          {false && (
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold">💬 Messages</h2>
                <button
                  onClick={() => setDmShowNewConv(true)}
                  className="text-xs bg-accent/10 text-accent px-3 py-1.5 rounded-full hover:bg-accent/20"
                >
                  + New
                </button>
              </div>

              {/* New conversation input */}
              {dmShowNewConv && (
                <div className="mb-4 bg-surface-raised rounded-xl border border-border p-3">
                  <p className="text-xs text-text-muted mb-2">Start a conversation</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={dmNewConvHandle}
                      onChange={(e) => setDmNewConvHandle(e.target.value)}
                      placeholder="@username"
                      className="flex-1 rounded-lg bg-surface border border-border px-3 py-2 text-sm text-text placeholder:text-text-muted/40 focus:outline-none focus:ring-2 focus:ring-accent/50"
                      onKeyDown={(e) => { if (e.key === "Enter") startNewDmConversation(); }}
                    />
                    <button
                      onClick={startNewDmConversation}
                      className="px-3 py-2 bg-accent text-black text-sm font-medium rounded-lg"
                    >
                      Start
                    </button>
                    <button
                      onClick={() => { setDmShowNewConv(false); setDmNewConvHandle(""); }}
                      className="px-2 py-2 text-text-muted hover:text-text"
                    >
                      ×
                    </button>
                  </div>
                </div>
              )}

              {/* Active conversation */}
              {dmActiveConv ? (
                <div className="bg-surface-raised rounded-2xl border border-border overflow-hidden">
                  {/* Conversation header */}
                  <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50">
                    <button onClick={() => { setDmActiveConv(null); setDmMessages([]); }} className="text-text-muted hover:text-text">
                      ←
                    </button>
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        @{dmActiveConv.participantHandles.find((h: string) => h !== user.handle) ?? dmActiveConv.participantHandles[1]}
                      </p>
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="h-72 overflow-y-auto px-4 py-3 space-y-3">
                    {dmMessages.length === 0 && (
                      <p className="text-center text-xs text-text-muted py-8">No messages yet. Say hi!</p>
                    )}
                    {dmMessages.map((m: any) => (
                      <div
                        key={m.id}
                        className={`flex ${m.senderId === user.id ? "justify-end" : "justify-start"}`}
                      >
                        <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                          m.senderId === user.id
                            ? "bg-accent text-black rounded-br-md"
                            : "bg-surface border border-border rounded-bl-md"
                        }`}>
                          <p className="break-words">{dmDecrypted.get(m.id) ?? m.encryptedContent}</p>
                          <p className={`text-[10px] mt-1 ${m.senderId === user.id ? "text-black/50" : "text-text-muted"}`}>
                            {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      </div>
                    ))}
                    <div ref={dmMessagesEndRef} />
                  </div>

                  {/* Input */}
                  <div className="border-t border-border/50 px-3 py-3 flex gap-2">
                    <input
                      type="text"
                      value={dmNewMessage}
                      onChange={(e) => setDmNewMessage(e.target.value)}
                      placeholder="Type a message..."
                      className="flex-1 rounded-full bg-surface border border-border px-4 py-2 text-sm text-text placeholder:text-text-muted/40 focus:outline-none focus:ring-2 focus:ring-accent/50"
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendDmMessage(); } }}
                    />
                    <button
                      onClick={sendDmMessage}
                      disabled={dmSending || !dmNewMessage.trim()}
                      className="w-9 h-9 rounded-full bg-accent flex items-center justify-center text-black disabled:opacity-50"
                    >
                      ↑
                    </button>
                  </div>
                </div>
              ) : (
                /* Conversation list */
                <div className="space-y-2">
                  {dmConversations.length === 0 && !dmShowNewConv && (
                    <div className="bg-surface-raised rounded-xl border border-border p-8 text-center">
                      <span className="text-3xl block mb-2">💬</span>
                      <p className="text-sm text-text-muted">No conversations yet</p>
                      <button
                        onClick={() => setDmShowNewConv(true)}
                        className="text-xs text-accent mt-2"
                      >
                        Start a conversation →
                      </button>
                    </div>
                  )}
                  {dmConversations.map((conv: any) => {
                    const otherHandle = conv.participantHandles.find((h: string) => h !== user.handle) ?? conv.participantHandles[1];
                    return (
                      <button
                        key={conv.id}
                        onClick={() => openDmConversation(conv)}
                        className="w-full flex items-center gap-3 bg-surface-raised rounded-xl border border-border p-3 hover:border-accent/50 transition-colors text-left"
                      >
                        <div className="w-10 h-10 rounded-full bg-accent/20 border border-accent/50 flex items-center justify-center shrink-0">
                          <span className="text-sm font-bold text-accent">{otherHandle[0]?.toUpperCase()}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">@{otherHandle}</p>
                          <p className="text-xs text-text-muted">
                            {new Date(conv.lastMessageAt).toLocaleDateString()}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* ─── PROFILE TAB ─── */}
          {activeTab === "profile" && (
            <section>
              {/* Profile header */}
              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-full bg-accent/20 border-2 border-accent flex items-center justify-center mx-auto mb-3">
                  <span className="text-2xl font-bold text-accent">{user.handle[0]?.toUpperCase()}</span>
                </div>
                <h2 className="text-lg font-bold">@{user.handle}</h2>
                <p className="text-xs text-text-muted mt-1">{user.email ?? "No email set"}</p>
                {hasPasskey && <span className="inline-block text-xs bg-success/10 text-success px-2 py-0.5 rounded-full mt-2">🔑 Passkey active</span>}
              </div>

              {/* Edit form */}
              <div className="bg-surface-raised rounded-2xl border border-border p-4 sm:p-6 space-y-5">
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1.5">Bio</label>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    maxLength={300}
                    rows={3}
                    placeholder="Tell people about yourself..."
                    className="w-full rounded-xl bg-surface border border-border px-3 py-2.5 text-sm text-text placeholder:text-text-muted/40 focus:outline-none focus:ring-2 focus:ring-accent/50 resize-none"
                  />
                  <p className="text-xs text-text-muted mt-1">{bio.length}/300</p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1.5">Social links</label>
                  <div className="space-y-2">
                    {socials.map((s, i) => (
                      <div key={i} className="flex gap-2">
                        <select
                          value={s.platform}
                          onChange={(e) => updateSocial(i, "platform", e.target.value)}
                          className="w-24 sm:w-32 rounded-lg bg-surface border border-border px-2 py-2 text-xs sm:text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent/50"
                        >
                          <option value="">Platform</option>
                          <option value="instagram">Instagram</option>
                          <option value="twitter">Twitter/X</option>
                          <option value="tiktok">TikTok</option>
                          <option value="youtube">YouTube</option>
                          <option value="github">GitHub</option>
                          <option value="linkedin">LinkedIn</option>
                          <option value="snapchat">Snapchat</option>
                          <option value="telegram">Telegram</option>
                          <option value="website">Website</option>
                        </select>
                        <input
                          type="url"
                          value={s.url}
                          onChange={(e) => updateSocial(i, "url", e.target.value)}
                          placeholder="https://..."
                          className="flex-1 min-w-0 rounded-lg bg-surface border border-border px-2 py-2 text-xs sm:text-sm text-text placeholder:text-text-muted/40 focus:outline-none focus:ring-2 focus:ring-accent/50"
                        />
                        <button
                          onClick={() => removeSocial(i)}
                          className="w-8 h-8 rounded-lg border border-border text-text-muted hover:text-red-400 hover:border-red-400/50 transition-colors flex items-center justify-center shrink-0 text-sm"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    {socials.length < 10 && (
                      <button onClick={addSocial} className="text-xs text-accent">+ Add link</button>
                    )}
                  </div>
                </div>

                <button
                  onClick={saveProfile}
                  disabled={profileSaving}
                  className="w-full rounded-xl bg-accent px-4 py-3 text-sm font-bold text-black hover:scale-[1.01] transition-all disabled:opacity-50"
                >
                  {profileSaving ? "Saving..." : profileSaved ? "Saved ✓" : "Save profile"}
                </button>
              </div>

              {/* Passkey section */}
              {!hasPasskey && (
                <button
                  onClick={handleAddPasskey}
                  disabled={passkeyStatus === "loading"}
                  className="w-full mt-4 text-sm bg-surface-raised border border-border text-text px-4 py-3 rounded-xl hover:border-accent/50 transition-colors disabled:opacity-50"
                >
                  {passkeyStatus === "loading" ? "Setting up..." : "🔑 Add passkey"}
                </button>
              )}
              {passkeyError && <p className="text-red-400 text-xs mt-2">{passkeyError}</p>}
            </section>
          )}

          {/* ─── MAP TAB ─── */}
          {activeTab === "map" && (
            <section>
              <h2 className="text-lg font-bold mb-4">🗺️ Secret Map</h2>
              <p className="text-xs text-text-muted mb-4">Tap anywhere on the map to drop a secret</p>

              {/* Map container */}
              <div className="relative rounded-2xl border border-border overflow-hidden" style={{ height: "400px" }}>
                <div ref={mapContainerRef} className="w-full h-full" />
                {/* Locate me button */}
                <button
                  onClick={() => {
                    if (navigator.geolocation) {
                      navigator.geolocation.getCurrentPosition(
                        (pos) => {
                          const map = mapInstanceRef.current;
                          const L = (window as any).L;
                          if (map && L) {
                            map.setView([pos.coords.latitude, pos.coords.longitude], 15);
                            const marker = L.circleMarker([pos.coords.latitude, pos.coords.longitude], {
                              radius: 8, fillColor: '#facc15', fillOpacity: 1, color: '#fff', weight: 2
                            }).addTo(map);
                            setTimeout(() => map.removeLayer(marker), 5000);
                          }
                        },
                        () => {}
                      );
                    }
                  }}
                  className="absolute bottom-4 right-4 z-[1000] w-10 h-10 rounded-full bg-surface-raised border border-border shadow-lg flex items-center justify-center hover:border-accent/50 transition-colors"
                  aria-label="Locate me"
                >
                  <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v2m0 16v2m10-10h-2M4 12H2m15.364-6.364l-1.414 1.414M7.05 16.95l-1.414 1.414m12.728 0l-1.414-1.414M7.05 7.05L5.636 5.636M12 8a4 4 0 100 8 4 4 0 000-8z" />
                  </svg>
                </button>
              </div>

              {/* Selected secret popup (outside map container so it's not clipped) */}
              {selectedMapSecret && (
                <div className="mt-4 bg-surface-raised rounded-xl border border-border p-4 relative">
                  <button onClick={() => { setSelectedMapSecret(null); setMapSecretRevealed(false); setRevealCountdown(null); if (revealTimerRef.current) clearInterval(revealTimerRef.current); }} className="absolute top-2 right-3 text-text-muted hover:text-text text-lg">×</button>

                  {!mapSecretRevealed ? (
                    /* Tap to reveal state */
                    <div className="text-center py-4">
                      <span className="text-4xl block mb-3">{selectedMapSecret.emoji}</span>
                      <p className="text-sm text-text-muted mb-1">
                        {selectedMapSecret.handle ? `@${selectedMapSecret.handle} dropped a secret` : "Someone dropped a secret"}
                      </p>
                      <p className="text-xs text-text-muted mb-2">⏳ {mapTimeRemaining(selectedMapSecret.expires_at || selectedMapSecret.expiresAt)}</p>
                      <p className="text-xs text-text-muted mb-4">
                        {(selectedMapSecret.reveal_mode || selectedMapSecret.revealMode) === "clicks"
                          ? `👆 ${selectedMapSecret.click_count ?? selectedMapSecret.clickCount ?? 0}/${selectedMapSecret.max_clicks ?? selectedMapSecret.maxClicks ?? "?"} reveals used`
                          : `⏱️ Disappears ${selectedMapSecret.reveal_timer_seconds ?? selectedMapSecret.revealTimerSeconds ?? 30}s after reveal`
                        }
                      </p>
                      <button
                        onClick={async () => {
                          try {
                            const res = await fetch(`${getApiBase()}/v1/secrets/map/${selectedMapSecret.id}/reveal`, { method: "POST" });
                            const data = await res.json();
                            if (!res.ok) {
                              if (data.error === "limit_reached") {
                                setSelectedMapSecret({ ...selectedMapSecret, _limitReached: true, _limitMessage: data.message });
                                setMapSecretRevealed(true);
                              }
                              return;
                            }
                            setSelectedMapSecret({ ...selectedMapSecret, ...data });
                            setMapSecretRevealed(true);
                            // Start countdown for timer mode
                            const mode = data.reveal_mode || data.revealMode || "timer";
                            if (mode === "timer") {
                              const secs = data.reveal_timer_seconds ?? data.revealTimerSeconds ?? 30;
                              setRevealCountdown(secs);
                              if (revealTimerRef.current) clearInterval(revealTimerRef.current);
                              revealTimerRef.current = setInterval(() => {
                                setRevealCountdown((prev: number | null) => {
                                  if (prev === null || prev <= 1) {
                                    clearInterval(revealTimerRef.current);
                                    setMapSecretRevealed(false);
                                    setSelectedMapSecret(null);
                                    return null;
                                  }
                                  return prev - 1;
                                });
                              }, 1000);
                            }
                          } catch {}
                        }}
                        className="rounded-full bg-accent px-6 py-2.5 text-sm font-bold text-black hover:scale-[1.03] transition-all"
                      >
                        Tap to reveal 👁️
                      </button>
                    </div>
                  ) : selectedMapSecret._limitReached ? (
                    /* Limit reached state */
                    <div className="text-center py-6">
                      <span className="text-4xl block mb-3">🚫</span>
                      <p className="text-sm text-text font-medium">{selectedMapSecret._limitMessage || "This secret has reached its reveal limit."}</p>
                      <p className="text-xs text-text-muted mt-2">No more reveals available</p>
                    </div>
                  ) : (
                    /* Revealed state */
                    <div className="flex flex-col gap-3">
                      {/* Timer countdown bar */}
                      {revealCountdown !== null && (
                        <div className="flex items-center gap-2 mb-1">
                          <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
                            <div
                              className="h-full bg-accent rounded-full transition-all duration-1000"
                              style={{ width: `${(revealCountdown / (selectedMapSecret.reveal_timer_seconds ?? selectedMapSecret.revealTimerSeconds ?? 30)) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs text-accent font-mono">{revealCountdown}s</span>
                        </div>
                      )}
                      {/* Click count badge */}
                      {(selectedMapSecret.reveal_mode || selectedMapSecret.revealMode) === "clicks" && (
                        <div className="text-xs text-text-muted">
                          👆 {selectedMapSecret.click_count ?? selectedMapSecret.clickCount}/{selectedMapSecret.max_clicks ?? selectedMapSecret.maxClicks} reveals used
                        </div>
                      )}
                      <div className="flex items-start gap-3">
                        <span className="text-2xl">{selectedMapSecret.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-text text-sm leading-relaxed break-words whitespace-pre-wrap">{selectedMapSecret.message}</p>
                          <div className="flex items-center gap-2 mt-3">
                            {selectedMapSecret.handle && (
                              <a href={`/${selectedMapSecret.handle}`} className="text-xs text-accent">@{selectedMapSecret.handle}</a>
                            )}
                            <span className="text-xs text-text-muted">⏳ {mapTimeRemaining(selectedMapSecret.expires_at || selectedMapSecret.expiresAt)}</span>
                          </div>
                        </div>
                      </div>
                      {/* Media attachment */}
                      {(selectedMapSecret.media_path || selectedMapSecret.mediaPath) && (
                        <div className="mt-2">
                          {(selectedMapSecret.media_type || selectedMapSecret.mediaType || "").startsWith("image/") ? (
                            <img
                              src={`${getApiBase()}/v1/secrets/blob/${selectedMapSecret.media_path || selectedMapSecret.mediaPath}`}
                              alt="Attached image"
                              className="max-w-full max-h-64 rounded-xl border border-border"
                            />
                          ) : (selectedMapSecret.media_type || selectedMapSecret.mediaType || "").startsWith("video/") ? (
                            <video
                              src={`${getApiBase()}/v1/secrets/blob/${selectedMapSecret.media_path || selectedMapSecret.mediaPath}`}
                              controls
                              className="max-w-full max-h-64 rounded-xl border border-border"
                            />
                          ) : (
                            <a
                              href={`${getApiBase()}/v1/secrets/blob/${selectedMapSecret.media_path || selectedMapSecret.mediaPath}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 text-sm text-accent bg-accent/10 px-4 py-2 rounded-lg hover:bg-accent/20 transition-colors"
                            >
                              📎 Download attachment
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Post form (shown when map is clicked) */}
              {showMapPost && mapClickedPos && (
                <div className="mt-4 bg-surface-raised rounded-2xl border border-border p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold">Drop a secret here</h3>
                    <button onClick={() => { setShowMapPost(false); setMapClickedPos(null); if (mapPinMarkerRef.current && mapInstanceRef.current) { mapInstanceRef.current.removeLayer(mapPinMarkerRef.current); mapPinMarkerRef.current = null; } }} className="text-text-muted hover:text-text text-lg">×</button>
                  </div>

                  {/* Message input */}
                  <textarea
                    value={mapMessage}
                    onChange={(e) => setMapMessage(e.target.value)}
                    maxLength={500}
                    rows={3}
                    placeholder="Write your secret..."
                    className="w-full rounded-xl bg-surface border border-border px-3 py-2.5 text-sm text-text placeholder:text-text-muted/40 focus:outline-none focus:ring-2 focus:ring-accent/50 resize-none"
                  />

                  {/* File preview */}
                  {mapFilePreview && mapFile && (
                    <div className="mt-2 relative inline-block">
                      {mapFile.type.startsWith("image/") ? (
                        <img src={mapFilePreview} alt="preview" className="max-h-24 rounded-lg border border-border" />
                      ) : mapFile.type.startsWith("video/") ? (
                        <video src={mapFilePreview} className="max-h-24 rounded-lg border border-border" controls />
                      ) : null}
                      <button
                        onClick={() => { setMapFile(null); setMapFilePreview(null); }}
                        className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center"
                      >×</button>
                    </div>
                  )}
                  {mapFile && !mapFilePreview && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-text-muted bg-surface rounded-lg border border-border px-3 py-2">
                      <span>📎</span>
                      <span className="truncate">{mapFile.name}</span>
                      <button onClick={() => { setMapFile(null); setMapFilePreview(null); }} className="text-red-400 ml-auto">×</button>
                    </div>
                  )}

                  {/* Attachments row */}
                  <input ref={mapFileInputRef} type="file" accept="image/*,video/*,.pdf,.txt,.doc,.docx" className="hidden" onChange={handleMapFileSelect} />
                  <div className="flex items-center gap-1.5 mt-3">
                    <button
                      onClick={() => mapFileInputRef.current?.click()}
                      className="flex items-center gap-1 text-xs text-text-muted bg-surface border border-border rounded-lg px-2 py-1.5 hover:border-accent/50 transition-colors"
                    >📎</button>
                    <button
                      onClick={() => { if (mapFileInputRef.current) { mapFileInputRef.current.accept = "image/*"; mapFileInputRef.current.click(); mapFileInputRef.current.accept = "image/*,video/*,.pdf,.txt,.doc,.docx"; } }}
                      className="flex items-center gap-1 text-xs text-text-muted bg-surface border border-border rounded-lg px-2 py-1.5 hover:border-accent/50 transition-colors"
                    >📸</button>
                    <button
                      onClick={() => { if (mapFileInputRef.current) { mapFileInputRef.current.accept = "video/*"; mapFileInputRef.current.click(); mapFileInputRef.current.accept = "image/*,video/*,.pdf,.txt,.doc,.docx"; } }}
                      className="flex items-center gap-1 text-xs text-text-muted bg-surface border border-border rounded-lg px-2 py-1.5 hover:border-accent/50 transition-colors"
                    >🎬</button>
                    <div className="flex-1" />
                    {/* Emoji selector */}
                    {["💬", "❤️", "🔥", "👀", "🤫", "💀", "🎉", "😂"].map((e) => (
                      <button
                        key={e}
                        onClick={() => setMapEmoji(e)}
                        className={`w-6 h-6 rounded flex items-center justify-center text-xs transition-all ${
                          mapEmoji === e ? "bg-accent/20 scale-110 ring-1 ring-accent" : "hover:bg-surface-raised"
                        }`}
                      >
                        {e}
                      </button>
                    ))}
                  </div>

                  {/* Settings grid */}
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {/* Pin expires */}
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider text-text-muted mb-1">Pin expires</label>
                      <select
                        value={mapTtl}
                        onChange={(e) => setMapTtl(Number(e.target.value))}
                        className="w-full text-xs bg-surface border border-border rounded-lg px-2 py-1.5 text-text"
                      >
                        <option value={5}>5 min</option>
                        <option value={30}>30 min</option>
                        <option value={60}>1 hour</option>
                        <option value={360}>6 hours</option>
                        <option value={1440}>24 hours</option>
                      </select>
                    </div>

                    {/* Reveal mode */}
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider text-text-muted mb-1">Reveal mode</label>
                      <div className="flex rounded-lg border border-border overflow-hidden">
                        <button
                          onClick={() => setMapRevealMode("timer")}
                          className={`flex-1 text-xs py-1.5 transition-colors ${
                            mapRevealMode === "timer" ? "bg-accent text-black font-medium" : "bg-surface text-text-muted"
                          }`}
                        >⏱️</button>
                        <button
                          onClick={() => setMapRevealMode("clicks")}
                          className={`flex-1 text-xs py-1.5 transition-colors ${
                            mapRevealMode === "clicks" ? "bg-accent text-black font-medium" : "bg-surface text-text-muted"
                          }`}
                        >👆</button>
                      </div>
                    </div>

                    {/* Timer / clicks value */}
                    <div className="col-span-2">
                      {mapRevealMode === "timer" ? (
                        <div>
                          <label className="block text-[10px] uppercase tracking-wider text-text-muted mb-1">View time</label>
                          <select
                            value={mapRevealTimer}
                            onChange={(e) => setMapRevealTimer(Number(e.target.value))}
                            className="w-full text-xs bg-surface border border-border rounded-lg px-2 py-1.5 text-text"
                          >
                            <option value={5}>5 seconds</option>
                            <option value={10}>10 seconds</option>
                            <option value={15}>15 seconds</option>
                            <option value={30}>30 seconds</option>
                            <option value={60}>1 minute</option>
                            <option value={120}>2 minutes</option>
                          </select>
                        </div>
                      ) : (
                        <div>
                          <label className="block text-[10px] uppercase tracking-wider text-text-muted mb-1">Max reveals</label>
                          <select
                            value={mapMaxClicks}
                            onChange={(e) => setMapMaxClicks(Number(e.target.value))}
                            className="w-full text-xs bg-surface border border-border rounded-lg px-2 py-1.5 text-text"
                          >
                            <option value={1}>1 reveal only</option>
                            <option value={3}>3 reveals</option>
                            <option value={5}>5 reveals</option>
                            <option value={10}>10 reveals</option>
                            <option value={25}>25 reveals</option>
                            <option value={50}>50 reveals</option>
                          </select>
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={postMapSecret}
                    disabled={mapPosting || !mapMessage.trim()}
                    className="w-full mt-4 rounded-full bg-accent px-4 py-2.5 text-sm font-bold text-black hover:scale-[1.02] transition-all disabled:opacity-50"
                  >
                    {mapPosting ? "Dropping..." : "Drop secret 📍"}
                  </button>
                </div>
              )}

              {/* Recent secrets list */}
              {mapSecrets.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-semibold mb-3">Recent drops</h3>
                  <div className="space-y-2">
                    {mapSecrets.slice(0, 10).map((s: any) => (
                      <div key={s.id} className="flex items-center gap-3 bg-surface-raised rounded-xl border border-border p-3">
                        <span className="text-lg">{s.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{s.message}</p>
                          <p className="text-xs text-text-muted">
                            {s.handle && `@${s.handle} · `}⏳ {mapTimeRemaining(s.expires_at || s.expiresAt)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      </div>
      )}

      {/* ─── Bottom Navigation (mobile only) ─── */}
      {activeTab !== "messages" && (
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-surface border-t border-border/50 z-30">
        <div className="flex items-center justify-around px-2 py-2 max-w-lg mx-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all ${
                activeTab === item.id
                  ? "text-accent"
                  : "text-text-muted"
              }`}
            >
              {item.icon}
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
      )}
    </main>
  );
}
