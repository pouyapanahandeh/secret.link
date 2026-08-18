import type { MetaFunction, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { useRef, useState } from "react";
import { ProtectedViewer } from "../components/ProtectedViewer";
import { AppNav } from "../components/AppNav";
import { getApiBase } from "../lib/api.client";

export const meta: MetaFunction = () => [
  { title: "Reveal Secret - Secretlink.life" },
  { name: "description", content: "You have a secret waiting. Tap to reveal." },
];

export async function loader({ params }: LoaderFunctionArgs) {
  const secretId = params["id"];
  return json({ secretId });
}

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
  const [remainingViews, setRemainingViews] = useState<number | null>(null);
  const [maxViews, setMaxViews] = useState(1);
  // Sync guard - React state alone can miss a double-tap before re-render.
  const revealInFlight = useRef(false);
  const unlockedRef = useRef(false);

  const handleReveal = async () => {
    if (revealInFlight.current || unlockedRef.current || expired) return;
    revealInFlight.current = true;
    setRevealing(true);
    setError(null);

    try {
      const apiBase = getApiBase();
      // Get the encryption key from URL fragment
      const fragment = window.location.hash;
      const keyParam = fragment.match(/k=([A-Za-z0-9_-]+)/)?.[1];

      // Prefer status check (no burn) so a missing #k= key never destroys the secret.
      if (!keyParam) {
        const statusRes = await fetch(`${apiBase}/v1/secrets/${secretId}`);
        if (!statusRes.ok) {
          const body = await statusRes.json().catch(() => null);
          const errorKind = body?.error ?? "unknown";
          if (errorKind === "not_found") setError("This secret doesn't exist.");
          else if (errorKind === "burned" || errorKind === "max_views_reached") {
            setError("This secret has already been viewed and is now destroyed.");
          } else if (errorKind === "expired") setError("This secret has expired.");
          else setError("Something went wrong. The secret may no longer exist.");
          return;
        }
        const status = await statusRes.json();
        if (!status.hasWraps) {
          setError(
            "This shared link is missing its decryption key. Copy the full URL, including the #k=… part at the end.",
          );
          return;
        }
        const { loadExistingKeyPair } = await import("../lib/dm-crypto");
        const kp = await loadExistingKeyPair();
        if (!kp) {
          setError(
            "This secret was sent to your account, but secure keys aren't set up in this browser. Open your dashboard once, then try again.",
          );
          return;
        }
      }

      // Burn + ciphertext. Only called once we know we can attempt decrypt.
      const res = await fetch(`${apiBase}/v1/secrets/${secretId}/reveal`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const errorKind = body?.error ?? "unknown";
        // If a racing request already unlocked content, keep showing it.
        if (unlockedRef.current) return;
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
      if (data.remainingViews !== undefined) {
        setRemainingViews(data.remainingViews);
      }
      if (data.maxViews) {
        setMaxViews(data.maxViews);
      }

      // If no key in URL, show raw (legacy secrets without encryption)
      if (!keyParam || !nonce) {
        // Profile-addressed secret: the AES key was wrapped to our X25519 key
        // and delivered via the API (no key in the URL). Try to unwrap it.
        const { loadExistingKeyPair, coalesceWraps, unwrapInboxKey } = await import(
          "../lib/dm-crypto"
        );
        const wraps = coalesceWraps(data);
        if (nonce && wraps.length > 0) {
          const kp = await loadExistingKeyPair();
          if (!kp) {
            setError("This secret was sent to your account, but secure keys aren't set up in this browser. Open your dashboard on the device where you first signed in.");
            return;
          }
          const rawKey = await unwrapInboxKey(wraps);
          if (!rawKey) {
            setError("Couldn't unlock this secret with your keys. Open your dashboard once on each device you use, then ask the sender for a new secret.");
            return;
          }
          const { decryptBlob: decryptBlobW, keyFromRawBytes } = await import("../lib/crypto");
          const wrappedAesKey = await keyFromRawBytes(rawKey);

          if (contentType === "text") {
            const binaryStr = atob(data.ciphertext);
            const ciphertextBytes = new Uint8Array(binaryStr.length);
            for (let i = 0; i < binaryStr.length; i++) {
              ciphertextBytes[i] = binaryStr.charCodeAt(i);
            }
            const decrypted = await decryptBlobW(ciphertextBytes, nonce, wrappedAesKey);
            setContent({ type: "text", text: new TextDecoder().decode(decrypted) });
          } else {
            const blobRes = await fetch(`${apiBase}/v1/secrets/blob/${data.blobPath}`);
            if (!blobRes.ok) {
              setError("Failed to download encrypted file.");
              return;
            }
            const encryptedBlob = new Uint8Array(await blobRes.arrayBuffer());
            const decrypted = await decryptBlobW(encryptedBlob, nonce, wrappedAesKey);
            const mimeType = data.mimeType ?? "application/octet-stream";
            const objectUrl = URL.createObjectURL(new Blob([decrypted as BlobPart], { type: mimeType }));
            if (contentType === "image") setContent({ type: "image", objectUrl });
            else if (contentType === "video") setContent({ type: "video", objectUrl, mimeType });
            else setContent({ type: "file", objectUrl, mimeType });
          }
          setRevealed(true);
          unlockedRef.current = true;
          setError(null);
          return;
        }

        if (contentType === "text") {
          setError(
            "This shared link is missing its decryption key. Copy the full URL, including the #k=… part at the end.",
          );
          return;
        }
        setError("Cannot decrypt: missing encryption key in URL.");
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
        const blobRes = await fetch(`${apiBase}/v1/secrets/blob/${data.blobPath}`);
        if (!blobRes.ok) {
          setError("Failed to download encrypted file.");
          return;
        }
        const encryptedBlob = new Uint8Array(await blobRes.arrayBuffer());
        const decrypted = await decryptBlob(encryptedBlob, nonce, key);

        const mimeType = data.mimeType ?? "application/octet-stream";
        const blob = new Blob([decrypted as BlobPart], { type: mimeType });
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
      unlockedRef.current = true;
      setError(null);
    } catch (e) {
      console.error("Reveal error:", e);
      if (!unlockedRef.current) {
        setError("Failed to decrypt. The link may be corrupted - make sure the full URL including #k=… was copied.");
      }
    } finally {
      setRevealing(false);
      // Allow retry only when unlock failed (e.g. missing local keys before fetch).
      if (!unlockedRef.current) {
        revealInFlight.current = false;
      }
    }
  };

  // Prefer unlocked content over a late/racing error (e.g. double-tap burn).
  if (error && !unlockedRef.current && !content) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-4">
        <AppNav />
        <div className="max-w-md w-full text-center">
          <h1 className="text-3xl font-bold mb-4 text-text/60">Gone.</h1>
          <p className="text-text-muted">{error}</p>
          <Link to="/" className="inline-block mt-8 text-sm text-accent hover:text-accent/80 transition-colors">
            ← Back to Secretlink.life
          </Link>
        </div>
      </main>
    );
  }

  if (expired) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-4">
        <AppNav />
        <div className="max-w-md w-full text-center">
          <span className="text-4xl block mb-4">💨</span>
          <h1 className="text-2xl font-bold mb-3">Content destroyed</h1>
          <p className="text-text-muted text-sm">
            The timer expired. This secret no longer exists anywhere - not on the server, not in your browser.
          </p>
          <div className="mt-8 flex flex-col items-center gap-2">
            <Link
              to="/signup"
              className="inline-block rounded-full bg-accent px-6 py-2.5 text-sm font-bold text-black hover:scale-[1.03] transition-all"
            >
              Get your @handle
            </Link>
            <Link to="/send" className="text-sm text-text-muted hover:text-accent transition-colors">
              Send a secret →
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (revealed && content) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-4 pt-20 pb-10">
        <AppNav />
        <div className="max-w-lg w-full">
          <p className="text-xs text-text-muted mb-4 text-center">
            {maxViews === 1
              ? "You're viewing it now - it won't open again after this"
              : `${remainingViews ?? 0} view${(remainingViews ?? 0) === 1 ? "" : "s"} remaining after this`
            }
          </p>

          <ProtectedViewer
            autoHideSeconds={viewDurationSeconds}
            onExpired={() => {
              if (remainingViews !== null && remainingViews > 0) {
                // Multi-view: hide content but allow re-open
                setRevealed(false);
                setRevealing(false);
                setContent(null);
              } else {
                // Single view or last view: mark as destroyed
                setExpired(true);
                if (content.type !== "text" && "objectUrl" in content) {
                  URL.revokeObjectURL(content.objectUrl);
                }
                setContent(null);
              }
            }}
          >
            <div className="rounded-2xl border border-border bg-surface-raised p-6">
              {content.type === "text" && (
                <p className="text-lg text-text leading-relaxed whitespace-pre-wrap">{content.text}</p>
              )}
              {content.type === "image" && (
                <img src={content.objectUrl} alt="Secret" className="w-full rounded-xl" draggable={false} />
              )}
              {content.type === "video" && (
                <video src={content.objectUrl} controls controlsList="nodownload noplaybackrate" disablePictureInPicture className="w-full rounded-xl" onContextMenu={(e) => e.preventDefault()} />
              )}
              {content.type === "file" && (
                <div className="text-center py-4">
                  <span className="text-4xl block mb-3">📄</span>
                  <p className="text-sm text-text-muted mb-4">Encrypted file ({content.mimeType})</p>
                  <a href={content.objectUrl} download="secret-file" className="inline-block rounded-full bg-accent px-6 py-2.5 text-sm font-bold text-black hover:scale-[1.03] transition-all">Download file 📥</a>
                </div>
              )}
            </div>
          </ProtectedViewer>

          <p className="mt-6 text-xs text-text-muted text-center">
            👁 Capture-resistant, not capture-proof
          </p>
          <div className="mt-4 flex flex-col items-center gap-2">
            <Link
              to="/signup"
              className="inline-block rounded-full bg-accent px-6 py-2.5 text-sm font-bold text-black hover:scale-[1.03] transition-all"
            >
              Get your @handle
            </Link>
            <Link to="/send" className="text-sm text-text-muted hover:text-accent transition-colors">
              Send a secret →
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      <AppNav />
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
