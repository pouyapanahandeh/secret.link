import { getSocialMeta, detectPlatform, SOCIAL_META, SOCIAL_PLATFORMS } from "../lib/socials";
import { SocialIcon } from "./SocialIcon";

export interface SocialLink {
  platform: string;
  url: string;
}

interface ProfileEditFormProps {
  bio: string;
  socials: SocialLink[];
  onBioChange: (bio: string) => void;
  onSocialsChange: (socials: SocialLink[]) => void;
  onSave: () => void;
  onCancel: () => void;
  saving?: boolean;
}

export function ProfileEditForm({
  bio,
  socials,
  onBioChange,
  onSocialsChange,
  onSave,
  onCancel,
  saving = false,
}: ProfileEditFormProps) {
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

  return (
    <div className="bg-surface-raised rounded-2xl border border-border p-4 sm:p-6 space-y-5">
      <div>
        <label className="block text-xs font-medium text-text-muted mb-1.5">Bio</label>
        <textarea
          value={bio}
          onChange={(e) => onBioChange(e.target.value)}
          maxLength={300}
          rows={3}
          placeholder="Tell people about yourself..."
          className="w-full rounded-xl bg-surface border border-border px-3 py-2.5 text-sm text-text placeholder:text-text-muted/40 focus:outline-none focus:ring-2 focus:ring-accent/50 resize-none"
        />
        <p className="text-xs text-text-muted mt-1">{bio.length}/300</p>
      </div>

      <div>
        <label className="block text-xs font-medium text-text-muted mb-1.5">Social links</label>
        <p className="text-xs text-text-muted/70 mb-2">Paste a link — we&apos;ll detect the platform automatically.</p>
        <div className="space-y-2">
          {socials.map((s, i) => {
            const meta = getSocialMeta(s.platform);
            return (
              <div key={i} className="space-y-1">
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
          disabled={saving}
          className="flex-1 rounded-xl bg-surface border border-border px-4 py-3 text-sm font-bold text-text hover:border-accent/50 transition-all disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="flex-1 rounded-xl bg-accent px-4 py-3 text-sm font-bold text-black hover:scale-[1.01] transition-all disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save profile"}
        </button>
      </div>
    </div>
  );
}
