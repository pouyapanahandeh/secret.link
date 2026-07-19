import type { MetaFunction } from "@remix-run/node";
import { useState, useRef } from "react";
import { Link } from "@remix-run/react";
import { CameraCapture } from "../components/CameraCapture";
import { AppNav } from "../components/AppNav";
import { getApiBase } from "../lib/api.client";

export const meta: MetaFunction = () => [
  { title: "Send a Secret — Secretlink.life" },
  { name: "description", content: "Send an anonymous, encrypted, self-destructing secret. Burns after one read." },
];

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

export default function Send() {
  const [tab, setTab] = useState<Tab>("text");
  const [message, setMessage] = useState("");
  const [viewDuration, setViewDuration] = useState("30");
  const [linkExpiry, setLinkExpiry] = useState("86400");
  const [maxViews, setMaxViews] = useState("1");
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 pt-20 pb-10">
      <AppNav />

      <div className="max-w-md w-full">
        {link ? (
          /* Success state */
          <div className="space-y-6 text-center">
            <div className="text-4xl mb-2">✨</div>
            <h2 className="text-2xl font-bold">Secret created!</h2>
            <div className="rounded-2xl border border-success/30 bg-surface-raised p-6">
              <p className="text-sm text-text-muted mb-3">Your encrypted secret link:</p>
              <p className="text-success font-mono text-xs break-all bg-success/10 rounded-lg p-3">{link}</p>
            </div>

            <button
              onClick={handleCopy}
              className="rounded-full bg-accent px-8 py-3 text-sm font-bold text-black hover:scale-[1.03] transition-all duration-200"
            >
              {copied ? "✓ Copied!" : "Copy link 📋"}
            </button>

            <p className="text-xs text-text-muted">
              🔐 End-to-end encrypted. The key is in the link — we never see it.
            </p>

            <div className="flex flex-col gap-2 items-center">
              <button
                onClick={reset}
                className="inline-block text-sm text-text-muted hover:text-accent transition-colors"
              >
                Send another secret →
              </button>
              <Link
                to="/signup"
                className="inline-block text-sm text-accent font-semibold hover:underline"
              >
                Get your @handle and share your inbox →
              </Link>
            </div>
          </div>
        ) : (
          /* Send form */
          <>
            <div className="text-center mb-6">
              <div className="text-4xl mb-3">🤫</div>
              <h1 className="text-3xl font-bold mb-2">
                Send a <span className="text-accent">secret</span>
              </h1>
              <p className="text-sm text-text-muted">
                End-to-end encrypted. One read, then it's gone.
              </p>
            </div>

            {/* Tabs */}
            <div className="flex rounded-2xl bg-surface-raised border border-border p-1 mb-5">
              {(["text", "file", "camera"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => { setTab(t); setError(null); setShowCamera(false); }}
                  className={`flex-1 py-2.5 px-3 rounded-xl text-sm font-medium transition-all ${
                    tab === t
                      ? "bg-accent text-black shadow-sm"
                      : "text-text-muted hover:text-text"
                  }`}
                >
                  {t === "text" ? "💬 Text" : t === "file" ? "📎 File" : "📷 Camera"}
                </button>
              ))}
            </div>

            {/* Link expiry selector */}
            <div className="mb-4">
              <label htmlFor="linkExpiry" className="block text-sm font-medium mb-1.5">
                Link expires in 🔗
                <span className="text-text-muted font-normal ml-1">(how long the link stays valid)</span>
              </label>
              <select
                id="linkExpiry"
                value={linkExpiry}
                onChange={(e) => setLinkExpiry(e.target.value)}
                className="w-full rounded-2xl bg-surface-raised border border-border px-4 py-3.5 text-text focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent/40 transition-all"
              >
                <option value="300">5 minutes</option>
                <option value="3600">1 hour</option>
                <option value="86400">24 hours</option>
                <option value="259200">3 days</option>
                <option value="604800">7 days</option>
              </select>
            </div>

            {/* View duration */}
            <div className="mb-4">
              <label htmlFor="viewDuration" className="block text-sm font-medium mb-1.5">
                View duration ⏱️
                <span className="text-text-muted font-normal ml-1">(auto-hides after this time)</span>
              </label>
              <select
                id="viewDuration"
                value={viewDuration}
                onChange={(e) => setViewDuration(e.target.value)}
                className="w-full rounded-2xl bg-surface-raised border border-border px-4 py-3.5 text-text focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent/40 transition-all"
              >
                <option value="10">10 seconds</option>
                <option value="30">30 seconds</option>
                <option value="60">1 minute</option>
                <option value="120">2 minutes</option>
                <option value="300">5 minutes</option>
              </select>
            </div>

            {/* Max views */}
            <div className="mb-5">
              <label htmlFor="maxViews" className="block text-sm font-medium mb-1.5">
                Max views 👁️
                <span className="text-text-muted font-normal ml-1">(how many times the link can be opened)</span>
              </label>
              <select
                id="maxViews"
                value={maxViews}
                onChange={(e) => setMaxViews(e.target.value)}
                className="w-full rounded-2xl bg-surface-raised border border-border px-4 py-3.5 text-text focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent/40 transition-all"
              >
                <option value="1">1 view (burn after reading)</option>
                <option value="3">3 views</option>
                <option value="5">5 views</option>
                <option value="10">10 views</option>
                <option value="25">25 views</option>
                <option value="50">50 views</option>
              </select>
            </div>

            {/* Tab content */}
            {tab === "text" && (
              <div className="space-y-4">
                <div>
                  <label htmlFor="message" className="block text-sm font-medium mb-1.5">
                    Your secret 💭
                  </label>
                  <textarea
                    id="message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={4}
                    maxLength={10000}
                    placeholder="What's on your mind?"
                    className="w-full rounded-2xl bg-surface-raised border border-border px-4 py-3.5 text-text placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent/40 resize-none transition-all"
                  />
                  <p className="text-xs text-text-muted mt-1 text-right">
                    {message.length}/10,000
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleSendText}
                  disabled={sending || !message.trim()}
                  className="w-full rounded-full bg-accent px-6 py-4 text-sm font-bold text-black shadow-lg shadow-accent/25 hover:shadow-accent/50 hover:scale-[1.01] transition-all duration-200 disabled:opacity-50"
                >
                  {sending ? "Encrypting... 🔐" : "Create secret link 🚀"}
                </button>
              </div>
            )}

            {tab === "file" && (
              <div className="space-y-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*,.pdf,.doc,.docx,.txt,.zip"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                  className="hidden"
                />
                {selectedFile ? (
                  <div className="rounded-2xl border border-border bg-surface-raised p-4">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">
                        {selectedFile.type.startsWith("image/") ? "🖼️" :
                         selectedFile.type.startsWith("video/") ? "🎬" : "📄"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                        <p className="text-xs text-text-muted">{formatFileSize(selectedFile.size)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedFile(null)}
                        className="text-text-muted hover:text-text"
                      >
                        ✕
                      </button>
                    </div>
                    {selectedFile.type.startsWith("image/") && (
                      <img
                        src={URL.createObjectURL(selectedFile)}
                        alt="Preview"
                        className="mt-3 rounded-xl max-h-48 w-full object-cover"
                      />
                    )}
                    {selectedFile.type.startsWith("video/") && (
                      <video
                        src={URL.createObjectURL(selectedFile)}
                        controls
                        className="mt-3 rounded-xl max-h-48 w-full"
                      />
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full rounded-2xl border-2 border-dashed border-border hover:border-accent/50 p-8 text-center transition-colors"
                  >
                    <span className="text-3xl block mb-2">📎</span>
                    <span className="text-sm font-medium block">Choose a file</span>
                    <span className="text-xs text-text-muted block mt-1">
                      Photos, videos, documents up to 50MB
                    </span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleSendFile}
                  disabled={sending || !selectedFile}
                  className="w-full rounded-full bg-accent px-6 py-4 text-sm font-bold text-black shadow-lg shadow-accent/25 hover:shadow-accent/50 hover:scale-[1.01] transition-all duration-200 disabled:opacity-50"
                >
                  {sending ? "Encrypting & uploading... 🔐" : "Encrypt & create link 🚀"}
                </button>
              </div>
            )}

            {tab === "camera" && (
              <div className="space-y-4">
                {sending ? (
                  <div className="rounded-2xl border border-border bg-surface-raised p-8 text-center">
                    <span className="animate-spin inline-block w-8 h-8 border-3 border-accent/30 border-t-accent rounded-full mb-4" />
                    <p className="text-sm font-medium">Encrypting & uploading...</p>
                    <p className="text-xs text-text-muted mt-1">This may take a moment</p>
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
                    className="w-full rounded-2xl border-2 border-dashed border-border hover:border-accent/50 p-8 text-center transition-colors"
                  >
                    <span className="text-3xl block mb-2">📷</span>
                    <span className="text-sm font-medium block">Open Camera</span>
                    <span className="text-xs text-text-muted block mt-1">
                      Capture a photo or record a video
                    </span>
                  </button>
                )}
              </div>
            )}

            {error && (
              <p className="text-red-400 text-sm text-center mt-4">{error}</p>
            )}

            <p className="text-xs text-text-muted text-center mt-5">
              🔒 Encrypted on your device · Key never leaves your browser · Self-destructs after reading
            </p>
          </>
        )}
      </div>
    </main>
  );
}
