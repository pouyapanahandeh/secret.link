import { useEffect, useState, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { getProfileUrl, getProfileQrUrl } from "@secretlink/core/profile-url";
import {
  STORY_SHARE_PLATFORMS,
  getProfileShareText,
  getStoryShareFallbackUrl,
  type StorySharePlatformId,
} from "@secretlink/core/profile-share";
import { SocialIcon } from "./SocialIcon";
import {
  generateProfileStoryImage,
  shareStoryImageBlob,
} from "../lib/profile-story-image";

interface ProfileShareModalProps {
  handle: string;
  onClose: () => void;
}

export function ProfileShareModal({ handle, onClose }: ProfileShareModalProps) {
  const [copied, setCopied] = useState(false);
  const storyBlobRef = useRef<Blob | null>(null);
  const [generatingStory, setGeneratingStory] = useState(false);
  const [sharingPlatform, setSharingPlatform] = useState<StorySharePlatformId | null>(null);
  const [storyHint, setStoryHint] = useState<string | null>(null);

  const origin = typeof window !== "undefined" ? window.location.origin : "https://secretlink.life";
  const profileUrl = getProfileUrl(handle, origin);
  const qrUrl = getProfileQrUrl(handle, origin);
  const shareText = getProfileShareText(handle, profileUrl);
  const shortUrl = profileUrl.replace(/^https?:\/\//, "");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const blob = await generateProfileStoryImage({ handle, profileUrl, qrUrl });
        if (!cancelled) storyBlobRef.current = blob;
      } catch {
        /* preview optional */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [handle, profileUrl, qrUrl]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(profileUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }

  async function nativeShareLink() {
    if (!navigator.share) {
      await copyLink();
      return;
    }
    try {
      await navigator.share({
        title: `@${handle} on Secretlink.life`,
        text: shareText,
        url: profileUrl,
      });
    } catch {
      /* user cancelled */
    }
  }

  async function ensureStoryImage() {
    if (storyBlobRef.current) return storyBlobRef.current;
    setGeneratingStory(true);
    try {
      const blob = await generateProfileStoryImage({ handle, profileUrl, qrUrl });
      storyBlobRef.current = blob;
      return blob;
    } finally {
      setGeneratingStory(false);
    }
  }

  async function shareToPlatform(platformId: StorySharePlatformId) {
    setSharingPlatform(platformId);
    setStoryHint(null);
    try {
      const platform = STORY_SHARE_PLATFORMS.find((p) => p.id === platformId);
      if (!platform) return;

      if (platform.preferImageShare) {
        const blob = await ensureStoryImage();
        const result = await shareStoryImageBlob(blob, handle, profileUrl);
        if (result === "downloaded") {
          const label = platform.label.replace(" Story", "").replace(" Status", "");
          setStoryHint(`Image saved - open ${label} and add it to your story.`);
        }
        return;
      }

      const fallbackUrl = getStoryShareFallbackUrl(platformId, handle, profileUrl);
      if (fallbackUrl) {
        window.open(fallbackUrl, "_blank", "noopener,noreferrer");
      }
    } finally {
      setSharingPlatform(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/50" aria-hidden="true" onClick={onClose} />

      <div
        role="dialog"
        aria-label="Share profile"
        className="relative z-10 w-full sm:max-w-sm max-h-[92vh] sm:max-h-[88vh] bg-surface border border-border/40 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-[slideUp_0.28s_cubic-bezier(0.32,0.72,0,1)] sm:animate-none"
      >
        <div className="sm:hidden flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-border/80" />
        </div>

        <div className="px-6 pt-2 sm:pt-5 pb-4 shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-text tracking-tight">Share profile</h2>
              <p className="text-sm text-text-muted mt-0.5">@{handle}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-surface-raised border border-border text-text-muted hover:text-text flex items-center justify-center text-lg leading-none shrink-0"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>

        <div className="px-6 pb-6 overflow-y-auto flex-1 space-y-5">
          {/* Link */}
          <section>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted/70 mb-2">
              Your link
            </p>
            <button
              type="button"
              onClick={copyLink}
              className={`w-full flex items-center gap-3 rounded-2xl bg-surface-raised border px-4 py-3.5 text-left transition-colors ${
                copied ? "border-accent" : "border-border/60 hover:border-accent/40"
              }`}
            >
              <code className="text-sm font-semibold text-text truncate flex-1">{shortUrl}</code>
              <span
                className={`shrink-0 text-xs font-bold px-3 py-1 rounded-full ${
                  copied ? "bg-accent text-black" : "bg-surface border border-border text-text"
                }`}
              >
                {copied ? "Copied!" : "Copy"}
              </span>
            </button>
          </section>

          <button
            type="button"
            onClick={nativeShareLink}
            className="w-full rounded-2xl bg-accent px-4 py-3.5 text-sm font-bold text-black hover:scale-[1.01] transition-all"
          >
            Share link
          </button>

          {/* QR */}
          <section className="flex items-center gap-4 rounded-2xl bg-surface-raised/80 border border-border/40 p-4">
            <div className="shrink-0 bg-white rounded-xl p-2">
              <QRCodeSVG value={qrUrl} size={72} level="M" includeMargin />
            </div>
            <div>
              <p className="text-sm font-semibold text-text">QR code</p>
              <p className="text-xs text-text-muted mt-1 leading-relaxed">
                Let someone scan this to open your profile instantly.
              </p>
            </div>
          </section>

          {/* Story platforms */}
          <section>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted/70 mb-3">
              Share to stories
            </p>
            <div className="flex flex-wrap gap-2.5">
              {STORY_SHARE_PLATFORMS.map((platform) => {
                const busy = generatingStory && sharingPlatform === platform.id;
                return (
                  <button
                    key={platform.id}
                    type="button"
                    onClick={() => shareToPlatform(platform.id)}
                    disabled={generatingStory}
                    title={platform.label}
                    aria-label={platform.label}
                    className="w-[52px] h-[52px] rounded-2xl bg-surface-raised border border-border/60 flex items-center justify-center hover:border-accent/50 transition-colors disabled:opacity-50"
                  >
                    {busy ? (
                      <span className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                    ) : (
                      <SocialIcon platform={platform.id} size={22} />
                    )}
                  </button>
                );
              })}
            </div>
            {storyHint && (
              <p className="text-xs text-accent mt-3 leading-relaxed">{storyHint}</p>
            )}
            <p className="text-xs text-text-muted mt-3 leading-relaxed">
              Story buttons share a branded image with your QR code and link.
            </p>
          </section>
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0.6; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
