import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useState, useRef, useEffect } from "react";
import { Link, useLoaderData } from "@remix-run/react";
import { CameraCapture } from "../components/CameraCapture";
import { SiteChrome } from "../components/SiteChrome";
import { getApiBase } from "../lib/api.client";
import { getToken } from "../lib/session.server";

export const meta: MetaFunction = () => [
  { title: "Send a Secret — Secretlink.life" },
  { name: "description", content: "Send an anonymous, encrypted, self-destructing secret. Burns after one read." },
];

export async function loader({ request }: LoaderFunctionArgs) {
  const token = await getToken(request);
  return json({ isLoggedIn: Boolean(token) });
}

type Tab = "text" | "file" | "camera";

async function encryptAndUpload(
  data: Uint8Array,
  contentType: "text" | "image" | "video" | "file",
  mimeType: string,
  ttlSeconds: number,
  viewDurationSeconds: number,
  maxViews: number = 1,
): Promise<{ link: string } | { error: string }> {
  const { encryptBlob, generateKeyBase64 } = await import("../lib/crypto");
  const apiBase = getApiBase();

  // 1. Generate encryption key
  const { key, keyBase64 } = await generateKeyBase64();

  // 2. Encrypt the data
  const { ciphertext: encryptedData, nonce } = await encryptBlob(data, key);

  let blobPath: string | undefined;
  let blobSizeBytes: number | undefined;

  if (contentType !== "text") {
    // 3. Upload encrypted blob
    const uploadRes = await fetch(`${apiBase}/v1/secrets/blob`, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: encryptedData as unknown as BodyInit,
    });

    if (!uploadRes.ok) return { error: "Failed to upload file" };
    const uploadData = await uploadRes.json();
    blobPath = uploadData.blobPath;
    blobSizeBytes = uploadData.sizeBytes;
  }

  // 4. Create secret metadata
  let ciphertextStr: string;
  if (contentType === "text") {
    // Encode encrypted bytes as base64 for storage
    let binary = "";
    for (let i = 0; i < encryptedData.length; i++) {
      binary += String.fromCharCode(encryptedData[i]!);
    }
    ciphertextStr = btoa(binary);
  } else {
    ciphertextStr = "blob";
  }

  const payload: Record<string, unknown> = {
    ciphertext: ciphertextStr,
    contentType,
    nonce,
    ttlSeconds,
    maxViews,
    mimeType,
    viewDurationSeconds,
  };
  if (blobPath) payload.blobPath = blobPath;
  if (blobSizeBytes) payload.blobSizeBytes = blobSizeBytes;

  const res = await fetch(`${apiBase}/v1/secrets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    return { error: body?.error ?? "Failed to create secret" };
  }

  const secretData = await res.json();
  // Key goes in URL fragment — never sent to server
  const link = `${window.location.origin}/s/${secretData.id}#k=${keyBase64}`;
  return { link };
}

const fieldLabel = "block font-mono text-[10px] tracking-[0.18em] uppercase text-text-muted mb-2";
const fieldControl =
  "w-full min-h-12 bg-surface border border-border px-4 py-3 text-text placeholder:text-text-muted/50 focus:outline-none focus:border-accent transition-colors";
const settingControl =
  "w-full min-h-11 bg-surface border border-border px-3 py-2.5 text-sm text-text focus:outline-none focus:border-accent transition-colors";
const primaryBtn =
  "w-full min-h-12 rounded-full bg-accent px-6 text-sm font-extrabold text-black hover:bg-accent-soft transition-colors disabled:opacity-60";
const secondaryBtn =
  "inline-flex items-center justify-center min-h-12 w-full sm:w-auto rounded-full border border-text/20 px-8 text-sm font-semibold text-text hover:border-accent hover:text-accent transition-colors";

const DISAPPEAR_PRESETS = [
  {
    id: "once",
    name: "Once",
    linkExpiry: "86400",
    viewDuration: "30",
    maxViews: "1",
  },
  {
    id: "flash",
    name: "Flash",
    linkExpiry: "3600",
    viewDuration: "10",
    maxViews: "1",
  },
  {
    id: "few",
    name: "A few times",
    linkExpiry: "604800",
    viewDuration: "120",
    maxViews: "5",
  },
] as const;

type DisappearPresetId = (typeof DISAPPEAR_PRESETS)[number]["id"] | "custom";

function matchDisappearPreset(
  linkExpiry: string,
  viewDuration: string,
  maxViews: string,
): DisappearPresetId {
  const found = DISAPPEAR_PRESETS.find(
    (p) =>
      p.linkExpiry === linkExpiry &&
      p.viewDuration === viewDuration &&
      p.maxViews === maxViews,
  );
  return found?.id ?? "custom";
}

const LINK_EXPIRY_LABELS: Record<string, string> = {
  "300": "5 minutes",
  "3600": "1 hour",
  "86400": "24 hours",
  "259200": "3 days",
  "604800": "7 days",
};

const VIEW_DURATION_LABELS: Record<string, string> = {
  "10": "10 seconds",
  "30": "30 seconds",
  "60": "1 minute",
  "120": "2 minutes",
  "300": "5 minutes",
};

function describeDisappearRules(linkExpiry: string, viewDuration: string, maxViews: string) {
  const opens = maxViews === "1" ? "Opens 1 time" : `Opens ${maxViews} times`;
  const look = VIEW_DURATION_LABELS[viewDuration] ?? `${viewDuration}s`;
  const dies = LINK_EXPIRY_LABELS[linkExpiry] ?? linkExpiry;
  return `${opens} · looks for ${look} · link dies in ${dies}`;
}

export default function Send() {
  const { isLoggedIn } = useLoaderData<typeof loader>();
  const [tab, setTab] = useState<Tab>("text");
  const [message, setMessage] = useState("");
  const [viewDuration, setViewDuration] = useState("30");
  const [linkExpiry, setLinkExpiry] = useState("86400");
  const [maxViews, setMaxViews] = useState("1");
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activePreset = matchDisappearPreset(linkExpiry, viewDuration, maxViews);
  const activeSummary = describeDisappearRules(linkExpiry, viewDuration, maxViews);

  const applyPreset = (preset: (typeof DISAPPEAR_PRESETS)[number]) => {
    setLinkExpiry(preset.linkExpiry);
    setViewDuration(preset.viewDuration);
    setMaxViews(preset.maxViews);
    setCustomizeOpen(false);
  };

  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  const reset = () => {
    setLink(null);
    setError(null);
    setMessage("");
    setSelectedFile(null);
    setShowCamera(false);
  };

  const handleSendText = async () => {
    if (!message.trim()) {
      setError("Secret cannot be empty");
      return;
    }
    setSending(true);
    setError(null);

    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    const result = await encryptAndUpload(data, "text", "text/plain", Number(linkExpiry), Number(viewDuration), Number(maxViews));

    if ("error" in result) {
      setError(result.error);
    } else {
      setLink(result.link);
    }
    setSending(false);
  };

  const handleSendFile = async () => {
    if (!selectedFile) {
      setError("Please select a file");
      return;
    }
    if (selectedFile.size > 50 * 1024 * 1024) {
      setError("File too large (max 50MB)");
      return;
    }
    setSending(true);
    setError(null);

    const arrayBuffer = await selectedFile.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    const contentType = selectedFile.type.startsWith("image/")
      ? "image" as const
      : selectedFile.type.startsWith("video/")
        ? "video" as const
        : "file" as const;

    const result = await encryptAndUpload(data, contentType, selectedFile.type, Number(linkExpiry), Number(viewDuration), Number(maxViews));

    if ("error" in result) {
      setError(result.error);
    } else {
      setLink(result.link);
    }
    setSending(false);
  };

  const handleCameraCapture = async (blob: Blob, mimeType: string) => {
    setShowCamera(false);
    setSending(true);
    setError(null);

    try {
      const arrayBuffer = await blob.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);
      const contentType = mimeType.startsWith("video/") ? "video" as const : "image" as const;

      const result = await encryptAndUpload(data, contentType, mimeType, Number(linkExpiry), Number(viewDuration), Number(maxViews));

      if ("error" in result) {
        setError(result.error);
      } else {
        setLink(result.link);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to encrypt capture");
    }
    setSending(false);
  };

  const handleCopy = async () => {
    if (link) {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = async () => {
    if (!link || !navigator.share) return;
    try {
      await navigator.share({
        title: "You have a secret",
        text: "Someone sent you a self-destructing secret on Secretlink.",
        url: link,
      });
    } catch {
      /* user cancelled or share failed */
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <SiteChrome isLoggedIn={isLoggedIn} currentPath="/send">
      <div className="relative overflow-hidden">
        <div className="absolute -top-24 right-[-20%] w-[70vw] h-[70vw] max-w-[560px] max-h-[560px] rounded-full bg-accent/10 blur-[120px] pointer-events-none" />

        <div className="relative mx-auto max-w-xl px-4 sm:px-6 pt-28 sm:pt-32 pb-20">
          {link ? (
            <div className="space-y-8">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.28em] uppercase text-accent mb-4">
                  Ready to share
                </p>
                <h1 className="font-extrabold tracking-[-0.04em] text-4xl sm:text-6xl leading-[0.95] mb-4">
                  Secret <span className="font-display font-bold text-accent">created</span>
                </h1>
                <p className="text-text-muted leading-relaxed">
                  End-to-end encrypted. The key lives in the link — we never see it.
                </p>
              </div>

              <div className="border border-border bg-surface-raised p-6 sm:p-8">
                <p className={fieldLabel}>Your encrypted secret link</p>
                <p className="font-mono text-xs sm:text-sm break-all text-accent bg-accent/10 border border-accent/20 px-4 py-3">
                  {link}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <button type="button" onClick={handleCopy} className={primaryBtn}>
                  {copied ? "Copied" : "Copy link"}
                </button>
                {canShare && (
                  <button type="button" onClick={handleShare} className={secondaryBtn}>
                    Share link
                  </button>
                )}
              </div>

              <div className="border-t border-border pt-8 space-y-4">
                <Link
                  to="/signup"
                  className="inline-flex items-center justify-center min-h-12 w-full rounded-full border border-accent/40 bg-accent/10 px-6 text-sm font-extrabold text-accent hover:bg-accent/20 transition-colors"
                >
                  Get your @handle and share your inbox
                </Link>
                <button
                  type="button"
                  onClick={reset}
                  className="block w-full text-center text-sm font-medium text-text-muted hover:text-accent transition-colors"
                >
                  Send another secret →
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-10">
                <p className="text-[11px] font-semibold tracking-[0.28em] uppercase text-accent mb-4">
                  Encrypted · one read · then gone
                </p>
                <h1 className="font-extrabold tracking-[-0.04em] text-4xl sm:text-6xl leading-[0.95] mb-4">
                  Send a <span className="font-display font-bold text-accent">secret</span>
                </h1>
                <p className="text-text-muted leading-relaxed">
                  Encrypted on your device. Share the link — it self-destructs after reading.
                </p>
              </div>

              <div className="flex gap-1 p-1 mb-8 border border-border bg-surface-raised">
                {([
                  { id: "text" as const, label: "Text" },
                  { id: "file" as const, label: "File" },
                  { id: "camera" as const, label: "Camera" },
                ]).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => { setTab(t.id); setError(null); setShowCamera(false); }}
                    className={`flex-1 min-h-11 px-3 font-mono text-[10px] tracking-[0.18em] uppercase transition-colors ${
                      tab === t.id
                        ? "bg-accent text-black font-bold"
                        : "text-text-muted hover:text-text hover:bg-surface"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="space-y-6">
                {tab === "text" && (
                  <div>
                    <div className="flex items-end justify-between gap-3 mb-2">
                      <label htmlFor="message" className="font-mono text-[10px] tracking-[0.18em] uppercase text-text-muted">
                        Your secret
                      </label>
                      <span className="font-mono text-[10px] tracking-[0.14em] uppercase text-text-muted tabular-nums">
                        {message.length}/10,000
                      </span>
                    </div>
                    <textarea
                      id="message"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      rows={6}
                      maxLength={10000}
                      placeholder="What's on your mind?"
                      className={`${fieldControl} resize-none`}
                    />
                  </div>
                )}

                {tab === "file" && (
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,video/*,.pdf,.doc,.docx,.txt,.zip"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                      className="hidden"
                    />
                    <p className={fieldLabel}>Your file</p>
                    {selectedFile ? (
                      <div className="border border-border bg-surface-raised p-4 sm:p-5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-border bg-surface font-mono text-[10px] tracking-[0.14em] uppercase text-accent">
                            {selectedFile.type.startsWith("image/")
                              ? "IMG"
                              : selectedFile.type.startsWith("video/")
                                ? "VID"
                                : "FILE"}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate">{selectedFile.name}</p>
                            <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-text-muted mt-0.5">
                              {formatFileSize(selectedFile.size)}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSelectedFile(null)}
                            className="min-h-11 min-w-11 text-text-muted hover:text-text transition-colors"
                            aria-label="Remove file"
                          >
                            ✕
                          </button>
                        </div>
                        {selectedFile.type.startsWith("image/") && (
                          <img
                            src={URL.createObjectURL(selectedFile)}
                            alt="Preview"
                            className="mt-4 max-h-48 w-full object-cover border border-border"
                          />
                        )}
                        {selectedFile.type.startsWith("video/") && (
                          <video
                            src={URL.createObjectURL(selectedFile)}
                            controls
                            className="mt-4 max-h-48 w-full border border-border"
                          />
                        )}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full border border-dashed border-border hover:border-accent/50 bg-surface-raised px-6 py-10 text-center transition-colors"
                      >
                        <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-accent block mb-3">
                          Attach
                        </span>
                        <span className="text-sm font-extrabold tracking-tight block">Choose a file</span>
                        <span className="text-xs text-text-muted block mt-2">
                          Photos, videos, documents up to 50MB
                        </span>
                      </button>
                    )}
                  </div>
                )}

                {tab === "camera" && (
                  <div>
                    <p className={fieldLabel}>Capture</p>
                    {sending ? (
                      <div className="border border-border bg-surface-raised px-6 py-10 text-center">
                        <span className="animate-spin inline-block w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full mb-4" />
                        <p className="text-sm font-extrabold tracking-tight">Encrypting & uploading…</p>
                        <p className="text-xs text-text-muted mt-2">This may take a moment</p>
                      </div>
                    ) : showCamera ? (
                      <CameraCapture
                        onCapture={handleCameraCapture}
                        onCancel={() => setShowCamera(false)}
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowCamera(true)}
                        className="w-full border border-dashed border-border hover:border-accent/50 bg-surface-raised px-6 py-10 text-center transition-colors"
                      >
                        <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-accent block mb-3">
                          Live
                        </span>
                        <span className="text-sm font-extrabold tracking-tight block">Open camera</span>
                        <span className="text-xs text-text-muted block mt-2">
                          Capture a photo or record a video
                        </span>
                      </button>
                    )}
                  </div>
                )}

                <div className="border border-border bg-surface-raised">
                  <div className="px-4 sm:px-5 py-4 border-b border-border">
                    <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-accent mb-1">
                      How it disappears
                    </p>
                    <p className="text-sm text-text-muted leading-snug">{activeSummary}</p>
                  </div>

                  <div className="flex flex-wrap gap-2 p-4 sm:p-5">
                    {DISAPPEAR_PRESETS.map((preset) => {
                      const selected = !customizeOpen && activePreset === preset.id;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => applyPreset(preset)}
                          className={`min-h-10 px-4 rounded-full text-sm font-semibold transition-colors ${
                            selected
                              ? "bg-accent text-black"
                              : "border border-border text-text-muted hover:text-text hover:border-accent/50"
                          }`}
                        >
                          {preset.name}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => setCustomizeOpen(true)}
                      className={`min-h-10 px-4 rounded-full text-sm font-semibold transition-colors ${
                        customizeOpen || activePreset === "custom"
                          ? "bg-accent text-black"
                          : "border border-border text-text-muted hover:text-text hover:border-accent/50"
                      }`}
                    >
                      Custom
                    </button>
                  </div>

                  {customizeOpen || activePreset === "custom" ? (
                    <div className="grid sm:grid-cols-3 gap-px bg-border border-t border-border">
                      <div className="bg-surface-raised p-4">
                        <label htmlFor="linkExpiry" className={fieldLabel}>
                          Link dies after
                        </label>
                        <select
                          id="linkExpiry"
                          value={linkExpiry}
                          onChange={(e) => {
                            setLinkExpiry(e.target.value);
                            setCustomizeOpen(true);
                          }}
                          className={settingControl}
                        >
                          {Object.entries(LINK_EXPIRY_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="bg-surface-raised p-4">
                        <label htmlFor="viewDuration" className={fieldLabel}>
                          They can look for
                        </label>
                        <select
                          id="viewDuration"
                          value={viewDuration}
                          onChange={(e) => {
                            setViewDuration(e.target.value);
                            setCustomizeOpen(true);
                          }}
                          className={settingControl}
                        >
                          {Object.entries(VIEW_DURATION_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="bg-surface-raised p-4">
                        <label htmlFor="maxViews" className={fieldLabel}>
                          How many opens
                        </label>
                        <select
                          id="maxViews"
                          value={maxViews}
                          onChange={(e) => {
                            setMaxViews(e.target.value);
                            setCustomizeOpen(true);
                          }}
                          className={settingControl}
                        >
                          <option value="1">1 time</option>
                          <option value="3">3 times</option>
                          <option value="5">5 times</option>
                          <option value="10">10 times</option>
                          <option value="25">25 times</option>
                          <option value="50">50 times</option>
                        </select>
                      </div>
                    </div>
                  ) : null}
                </div>

                {tab === "text" && (
                  <button
                    type="button"
                    onClick={handleSendText}
                    disabled={sending || !message.trim()}
                    className={primaryBtn}
                  >
                    {sending ? "Encrypting…" : "Create secret link"}
                  </button>
                )}
                {tab === "file" && (
                  <button
                    type="button"
                    onClick={handleSendFile}
                    disabled={sending || !selectedFile}
                    className={primaryBtn}
                  >
                    {sending ? "Encrypting & uploading…" : "Encrypt & create link"}
                  </button>
                )}

                {error && (
                  <p className="text-red-400 text-sm text-center">{error}</p>
                )}

                <p className="font-mono text-[10px] tracking-[0.16em] uppercase text-text-muted text-center leading-relaxed">
                  Key stays in the link · never on our servers
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </SiteChrome>
  );
}
