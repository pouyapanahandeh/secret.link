import type { MetaFunction, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { useState } from "react";
import { ThemeToggle } from "../components/ThemeToggle";
import { ProtectedViewer } from "../components/ProtectedViewer";

export const meta: MetaFunction = () => [
  { title: "Reveal Secret — Secretlink.life" },
  { name: "description", content: "You have a secret waiting. Tap to reveal." },
];

export async function loader({ params }: LoaderFunctionArgs) {
  const secretId = params["id"];
  return json({ secretId });
}

const API_URL = typeof window !== "undefined"
  ? (window.location.port === "3000" ? window.location.origin.replace(":3000", ":4000") : window.location.origin)
  : "http://localhost:4000";

type RevealedContent =
  | { type: "text"; text: string }
  | { type: "image"; objectUrl: string }
  | { type: "video"; objectUrl: string; mimeType: string }
  | { type: "file"; objectUrl: string; mimeType: string };

export default function RevealSecret() {
  const { secretId } = useLoaderData<typeof loader>();
  const [revealed, setRevealed] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [content, setContent] = useState<RevealedContent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [viewDurationSeconds, setViewDurationSeconds] = useState(30);

  const handleReveal = async () => {
    setRevealing(true);

    try {
      // Get the encryption key from URL fragment
      const fragment = window.location.hash;
      const keyParam = fragment.match(/k=([A-Za-z0-9_-]+)/)?.[1];

      // Fetch secret metadata from API
      const res = await fetch(`${API_URL}/v1/secrets/${secretId}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const errorKind = body?.error ?? "unknown";
        if (errorKind === "not_found") {
          setError("This secret doesn't exist.");
        } else if (errorKind === "burned" || errorKind === "max_views_reached") {
          setError("This secret has already been viewed and is now destroyed.");
        } else if (errorKind === "expired") {
          setError("This secret has expired.");
        } else {
          setError("Something went wrong. The secret may no longer exist.");
        }
        return;
      }

      const data = await res.json();
      const contentType: string = data.contentType ?? "text";
      const nonce: string | undefined = data.nonce;

      // Store sender-configured view duration
      if (data.viewDurationSeconds) {
        setViewDurationSeconds(data.viewDurationSeconds);
      }

      // If no key in URL, show raw (legacy secrets without encryption)
      if (!keyParam || !nonce) {
        if (contentType === "text") {
          setContent({ type: "text", text: data.ciphertext });
        } else {
          setError("Cannot decrypt: missing encryption key in URL.");
          return;
        }
        setRevealed(true);
        return;
      }

      // Import crypto and decrypt
      const { decryptBlob, keyFromBase64 } = await import("../lib/crypto");
      const key = await keyFromBase64(keyParam);

      if (contentType === "text") {
        // Decode base64 ciphertext back to Uint8Array
        const binaryStr = atob(data.ciphertext);
        const ciphertextBytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          ciphertextBytes[i] = binaryStr.charCodeAt(i);
        }
        const decrypted = await decryptBlob(ciphertextBytes, nonce, key);
        const text = new TextDecoder().decode(decrypted);
        setContent({ type: "text", text });
      } else {
        // Fetch encrypted blob
        const blobRes = await fetch(`${API_URL}/v1/secrets/blob/${data.blobPath}`);
        if (!blobRes.ok) {
          setError("Failed to download encrypted file.");
          return;
        }
        const encryptedBlob = new Uint8Array(await blobRes.arrayBuffer());
        const decrypted = await decryptBlob(encryptedBlob, nonce, key);

        const mimeType = data.mimeType ?? "application/octet-stream";
        const blob = new Blob([decrypted], { type: mimeType });
        const objectUrl = URL.createObjectURL(blob);

        if (contentType === "image") {
          setContent({ type: "image", objectUrl });
        } else if (contentType === "video") {
          setContent({ type: "video", objectUrl, mimeType });
        } else {
          setContent({ type: "file", objectUrl, mimeType });
        }
      }

      setRevealed(true);
    } catch (e) {
      console.error("Reveal error:", e);
      setError("Failed to decrypt. The link may be corrupted.");
    } finally {
      setRevealing(false);
    }
  };

  const Nav = () => (
    <nav className="fixed top-0 left-0 right-0 flex items-center justify-between px-6 py-4 bg-surface/90 backdrop-blur-md z-10 border-b border-border/50">
      <a href="/" className="flex items-center gap-2">
        <img src="/secretlink.png" alt="Secretlink.life" className="w-8 h-8" />
        <span className="text-xl font-bold tracking-tight">
          secretlink<span className="text-accent">.</span>life
        </span>
      </a>
      <ThemeToggle />
    </nav>
  );

  if (error) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-4">
        <Nav />
        <div className="max-w-md w-full text-center">
          <h1 className="text-3xl font-bold mb-4 text-text/60">Gone.</h1>
          <p className="text-text-muted">{error}</p>
          <a href="/" className="inline-block mt-8 text-sm text-accent hover:text-accent/80 transition-colors">
            ← Back to Secretlink.life
          </a>
        </div>
      </main>
    );
  }

  if (expired) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-4">
        <Nav />
        <div className="max-w-md w-full text-center">
          <span className="text-4xl block mb-4">💨</span>
          <h1 className="text-2xl font-bold mb-3">Content destroyed</h1>
          <p className="text-text-muted text-sm">
            The timer expired. This secret no longer exists anywhere — not on the server, not in your browser.
          </p>
          <a href="/send" className="inline-block mt-8 text-sm text-accent hover:text-accent/80 transition-colors">
            Send your own secret →
          </a>
        </div>
      </main>
    );
  }

  if (revealed && content) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-4 pt-20 pb-10">
        <Nav />
        <div className="max-w-lg w-full">
          <p className="text-xs text-text-muted mb-4 text-center">
            This secret has been revealed and is now destroyed
          </p>

          <ProtectedViewer
            autoHideSeconds={viewDurationSeconds}
            onExpired={() => {
              setExpired(true);
              // Revoke object URLs to free memory
              if (content.type !== "text" && "objectUrl" in content) {
                URL.revokeObjectURL(content.objectUrl);
              }
              setContent(null);
            }}
          >
            <div className="rounded-2xl border border-border bg-surface-raised p-6">
              {content.type === "text" && (
                <p className="text-lg text-text leading-relaxed whitespace-pre-wrap">{content.text}</p>
              )}
              {content.type === "image" && (
                <img
                  src={content.objectUrl}
                  alt="Secret"
                  className="w-full rounded-xl"
                  draggable={false}
                />
              )}
              {content.type === "video" && (
                <video
                  src={content.objectUrl}
                  controls
                  controlsList="nodownload noplaybackrate"
                  disablePictureInPicture
                  className="w-full rounded-xl"
                  onContextMenu={(e) => e.preventDefault()}
                />
              )}
              {content.type === "file" && (
                <div className="text-center py-4">
                  <span className="text-4xl block mb-3">📄</span>
                  <p className="text-sm text-text-muted mb-4">
                    Encrypted file ({content.mimeType})
                  </p>
                  <a
                    href={content.objectUrl}
                    download="secret-file"
                    className="inline-block rounded-full bg-accent px-6 py-2.5 text-sm font-bold text-black hover:scale-[1.03] transition-all"
                  >
                    Download file 📥
                  </a>
                </div>
              )}
            </div>
          </ProtectedViewer>

          <p className="mt-6 text-xs text-text-muted text-center">
            👁 Capture-resistant, not capture-proof
          </p>
          <div className="mt-4 text-center">
            <a href="/send" className="text-sm text-accent hover:text-accent/80 transition-colors">
              Send your own secret →
            </a>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      <Nav />
      <div className="max-w-md w-full text-center">
        <h1 className="text-4xl font-bold mb-2">You have a secret</h1>
        <p className="text-text-muted mb-8">Tap the button to reveal. Once seen, it's gone.</p>

        <button
          onClick={handleReveal}
          disabled={revealing}
          className="relative rounded-full bg-accent px-12 py-4 text-lg font-bold text-black hover:scale-[1.03] transition-all duration-200 disabled:opacity-70 shadow-lg shadow-accent/25"
        >
          {revealing ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin inline-block w-4 h-4 border-2 border-black/30 border-t-black rounded-full" />
              Decrypting...
            </span>
          ) : (
            "Reveal secret 👁"
          )}
        </button>
      </div>
    </main>
  );
}
