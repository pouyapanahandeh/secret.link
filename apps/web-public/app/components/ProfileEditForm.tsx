import { useRef, useState } from "react";
import { getSocialMeta, detectPlatform, SOCIAL_META, SOCIAL_PLATFORMS } from "../lib/socials";
import { SocialIcon } from "./SocialIcon";
import { getApiBase } from "../lib/api.client";

export interface SocialLink {
  platform: string;
  url: string;
}

interface ProfileEditFormProps {
  bio: string;
  socials: SocialLink[];
  avatarUrl: string | null;
  onBioChange: (bio: string) => void;
  onSocialsChange: (socials: SocialLink[]) => void;
  onAvatarUrlChange: (url: string | null) => void;
  onSave: () => void;
  onCancel: () => void;
  saving?: boolean;
  handle?: string;
}

export function ProfileEditForm({
  bio,
  socials,
  avatarUrl,
  onBioChange,
  onSocialsChange,
  onAvatarUrlChange,
  onSave,
  onCancel,
  saving = false,
  handle = "?",
}: ProfileEditFormProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  function updateSocial(index: number, field: "platform" | "url", value: string) {
    const updated = socials.map((s, i) => {
      if (i !== index) return s;
      if (field === "url") {
        const platform = value.trim() ? detectPlatform(value) : s.platform;
        return { platform, url: value };
      }
      return { ...s, [field]: value };
    });
    onSocialsChange(updated);
  }

  function addSocial() {
    if (socials.length >= 10) return;
    onSocialsChange([...socials, { platform: "instagram", url: "" }]);
  }

  function removeSocial(index: number) {
    onSocialsChange(socials.filter((_, i) => i !== index));
  }

  async function handleAvatarFile(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setUploadError("Please choose an image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("Image must be under 5MB.");
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      const res = await fetch(`${getApiBase()}/v1/secrets/blob`, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      onAvatarUrlChange(`${getApiBase()}/v1/secrets/blob/${data.blobPath}`);
    } catch {
      setUploadError("Couldn't upload avatar. Try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="bg-surface-raised border border-border p-4 sm:p-6 space-y-5">
      <div>
        <label className="block font-mono text-[10px] tracking-[0.2em] uppercase text-accent mb-1.5">Avatar</label>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-accent/20 border-2 border-accent flex items-center justify-center overflow-hidden shrink-0">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-2xl font-bold text-accent">
                {handle[0]?.toUpperCase() ?? "?"}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(e) => handleAvatarFile(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              disabled={uploading || saving}
              onClick={() => fileRef.current?.click()}
              className="rounded-full bg-accent px-4 py-1.5 text-xs font-extrabold text-black hover:bg-accent-soft transition-colors disabled:opacity-50"
            >
              {uploading ? "Uploading…" : "Upload photo"}
            </button>
            {avatarUrl && (
              <button
                type="button"
                disabled={uploading || saving}
                onClick={() => onAvatarUrlChange(null)}
                className="text-xs text-text-muted hover:text-red-400 text-left"
              >
                Remove
              </button>
            )}
            {uploadError && <p className="text-xs text-red-400">{uploadError}</p>}
          </div>
        </div>
      </div>

      <div>
        <label className="block font-mono text-[10px] tracking-[0.2em] uppercase text-accent mb-1.5">Bio</label>
        <textarea
          value={bio}
          onChange={(e) => onBioChange(e.target.value)}
          maxLength={300}
          rows={3}
          placeholder="Tell people about yourself..."
          className="w-full bg-surface border border-border px-3 py-2.5 text-sm text-text placeholder:text-text-muted/40 focus:outline-none focus:border-accent resize-none"
        />
        <p className="text-xs text-text-muted mt-1">{bio.length}/300</p>
      </div>

      <div>
        <label className="block font-mono text-[10px] tracking-[0.2em] uppercase text-accent mb-1.5">Social links</label>
        <p className="text-xs text-text-muted/70 mb-2">Paste a link — we&apos;ll detect the platform automatically.</p>
        <div className="space-y-2">
          {socials.map((s, i) => {
            const meta = getSocialMeta(s.platform);
            return (
              <div key={`${s.platform}-${i}`} className="space-y-1">
                <div className="flex gap-2 items-center">
                  <div
                    className="w-9 h-9 shrink-0 rounded-lg bg-surface border border-border flex items-center justify-center"
                    title={meta.label}
                  >
                    <SocialIcon platform={s.url ? s.platform : "link"} size={18} className="block shrink-0" />
                  </div>
                  <input
                    type="url"
                    value={s.url}
                    onChange={(e) => updateSocial(i, "url", e.target.value)}
                    placeholder="https://instagram.com/yourname"
                    className="flex-1 min-w-0 h-9 rounded-lg bg-surface border border-border px-2.5 text-xs sm:text-sm text-text placeholder:text-text-muted/40 focus:outline-none focus:ring-2 focus:ring-accent/50"
                  />
                  <button
                    type="button"
                    onClick={() => removeSocial(i)}
                    className="w-9 h-9 shrink-0 rounded-lg border border-border text-text-muted hover:text-red-400 hover:border-red-400/50 transition-colors flex items-center justify-center text-sm"
                  >
                    ×
                  </button>
                </div>
                {s.url && (
                  <div className="flex items-center gap-1.5 pl-11">
                    <span className="text-xs text-text-muted">{meta.label}</span>
                    <select
                      value={s.platform}
                      onChange={(e) => updateSocial(i, "platform", e.target.value)}
                      className="text-xs bg-transparent text-text-muted/60 border-none focus:outline-none cursor-pointer hover:text-accent"
                      title="Change platform"
                    >
                      {SOCIAL_PLATFORMS.map((p) => (
                        <option key={p} value={p}>
                          {SOCIAL_META[p]!.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            );
          })}
          {socials.length < 10 && (
            <button type="button" onClick={addSocial} className="text-xs text-accent">
              + Add link
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving || uploading}
          className="flex-1 border border-border bg-surface px-4 py-3 text-sm font-extrabold text-text hover:border-accent/50 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving || uploading}
          className="flex-1 rounded-full bg-accent px-4 py-3 text-sm font-extrabold text-black hover:bg-accent-soft transition-colors disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save profile"}
        </button>
      </div>
    </div>
  );
}
