import { useState } from "react";
import type { FetcherWithComponents } from "@remix-run/react";

interface ProfileSecretFormProps {
  recipientPublicKey?: string | null;
  recipientPublicKeys?: string[] | null;
  fetcher: FetcherWithComponents<{ error?: string | null; sent?: boolean }>;
}

export function ProfileSecretForm({
  recipientPublicKey,
  recipientPublicKeys,
  fetcher,
}: ProfileSecretFormProps) {
  const [charCount, setCharCount] = useState(0);
  const [encrypting, setEncrypting] = useState(false);
  const [encryptError, setEncryptError] = useState<string | null>(null);

  const formError = fetcher.data?.error || encryptError;
  const isSubmitting = encrypting || fetcher.state === "submitting";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setEncryptError(null);
    setEncrypting(true);

    try {
      const formEl = e.currentTarget;
      const formData = new FormData(formEl);
      const message = String(formData.get("message") ?? "").trim();

      if (!message) {
        setEncryptError("Secret cannot be empty");
        return;
      }
      if (message.length > 10000) {
        setEncryptError("Secret too long (max 10,000 characters)");
        return;
      }

      const keys =
        recipientPublicKeys && recipientPublicKeys.length > 0
          ? recipientPublicKeys
          : recipientPublicKey
            ? [recipientPublicKey]
            : [];

      if (keys.length === 0) {
        setEncryptError(
          "This user hasn't set up secure delivery yet. Ask them to open their dashboard once, then try again.",
        );
        return;
      }

      const { encryptBlob, generateKeyBase64 } = await import("../lib/crypto");
      const { key, keyBase64, rawKey } = await generateKeyBase64();
      const data = new TextEncoder().encode(message);
      const { ciphertext, nonce } = await encryptBlob(data, key);

      const { wrapKeyForRecipients } = await import("../lib/dm-crypto");
      const wraps = await wrapKeyForRecipients(rawKey, keys);
      const first = wraps[0]!;

      let binary = "";
      for (let i = 0; i < ciphertext.length; i++) {
        binary += String.fromCharCode(ciphertext[i]!);
      }
      const ciphertextB64 = btoa(binary);

      const submitData = new FormData();
      submitData.append("ciphertext", ciphertextB64);
      submitData.append("nonce", nonce);
      submitData.append("keyBase64", keyBase64);
      submitData.append("wrappedKey", first.wrappedKey);
      submitData.append("wrapNonce", first.wrapNonce);
      submitData.append("wrapEpk", first.wrapEpk);
      submitData.append("wraps", JSON.stringify(wraps));
      submitData.append("linkExpiry", String(formData.get("linkExpiry") ?? "86400"));
      submitData.append("viewDuration", String(formData.get("viewDuration") ?? "30"));

      fetcher.submit(submitData, { method: "post" });
    } catch (err) {
      if (err instanceof Error && err.message === "invalid_recipient_key") {
        setEncryptError(
          "This user hasn't set up secure delivery yet. Ask them to open their dashboard once, then try again.",
        );
      } else {
        setEncryptError("Encryption failed. Please try again.");
      }
    } finally {
      setEncrypting(false);
    }
  }

  return (
    <div className="bg-surface-raised border border-border p-6">
      <div className="flex items-center gap-2 mb-4">
        <p className="font-mono text-[11px] tracking-[0.2em] uppercase text-accent">Send a secret</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <textarea
            name="message"
            rows={4}
            required
            maxLength={10000}
            placeholder="Type your secret message..."
            onChange={(e) => setCharCount(e.target.value.length)}
            className="w-full bg-surface border border-border px-4 py-3 text-text placeholder:text-text-muted/40 focus:outline-none focus:border-accent resize-none"
          />
          {charCount > 0 && (
            <span className="absolute bottom-3 right-3 text-xs text-text-muted">
              {charCount}/10000
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-mono text-[10px] tracking-[0.16em] uppercase text-text-muted mb-1">Link expires in</label>
            <select
              name="linkExpiry"
              defaultValue="86400"
              className="w-full bg-surface border border-border px-3 py-2 text-sm text-text"
            >
              <option value="300">5 minutes</option>
              <option value="3600">1 hour</option>
              <option value="86400">24 hours</option>
              <option value="604800">7 days</option>
            </select>
          </div>
          <div>
            <label className="block font-mono text-[10px] tracking-[0.16em] uppercase text-text-muted mb-1">View time</label>
            <select
              name="viewDuration"
              defaultValue="30"
              className="w-full bg-surface border border-border px-3 py-2 text-sm text-text"
            >
              <option value="10">10 seconds</option>
              <option value="30">30 seconds</option>
              <option value="60">1 minute</option>
              <option value="120">2 minutes</option>
            </select>
          </div>
        </div>

        {formError && <p className="text-red-400 text-sm">{formError}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-full bg-accent px-6 py-3 text-sm font-extrabold text-black hover:bg-accent-soft transition-colors disabled:opacity-50"
        >
          {isSubmitting ? "Encrypting..." : "Send anonymously 🤫"}
        </button>
      </form>

      <p className="text-xs text-text-muted text-center mt-4">
        🔒 End-to-end encrypted · Burns after one read · Completely anonymous
      </p>
    </div>
  );
}
