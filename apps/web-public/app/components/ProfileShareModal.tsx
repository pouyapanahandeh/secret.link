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
  downloadBlob,
} from "../lib/profile-story-image";

interface ProfileShareModalProps {
  handle: string;
  onClose: () => void;
}

export function ProfileShareModal({ handle, onClose }: ProfileShareModalProps) {
  const [copied, setCopied] = useState(false);
  const [storyPreviewUrl, setStoryPreviewUrl] = useState<string | null>(null);
  const storyBlobRef = useRef<Blob | null>(null);
  const [generatingStory, setGeneratingStory] = useState(false);
  const [sharingPlatform, setSharingPlatform] = useState<StorySharePlatformId | null>(null);
  const [storyHint, setStoryHint] = useState<string | null>(null);

  const origin = typeof window !== "undefined" ? window.location.origin : "https://secretlink.life";
  const profileUrl = getProfileUrl(handle, origin);
  const qrUrl = getProfileQrUrl(handle, origin);
  const shareText = getProfileShareText(handle, profileUrl);

  async function ensureStoryImage() {
    if (storyBlobRef.current) return storyBlobRef.current;
    setGeneratingStory(true);
    try {
      const blob = await generateProfileStoryImage({ handle, profileUrl, qrUrl });
      storyBlobRef.current = blob;
      setStoryPreviewUrl(URL.createObjectURL(blob));
      return blob;
    } finally {
      setGeneratingStory(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setGeneratingStory(true);
      try {
        const blob = await generateProfileStoryImage({ handle, profileUrl, qrUrl });
        if (!cancelled) {
          storyBlobRef.current = blob;
          setStoryPreviewUrl(URL.createObjectURL(blob));
        }
      } finally {
        if (!cancelled) setGeneratingStory(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [handle, profileUrl, qrUrl]);

  useEffect(() => {
    return () => {
      if (storyPreviewUrl) URL.revokeObjectURL(storyPreviewUrl);
    };
  }, [storyPreviewUrl]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
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
    if (!navigator.share) return;
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

  async function downloadStoryImage() {
    const blob = await ensureStoryImage();
    downloadBlob(blob, `secretlink-${handle}-story.png`);
    setStoryHint("Story image saved — open Instagram or Facebook and add it to your story.");
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
          setStoryHint(
            `Story image downloaded. Open ${label}, create a story, and pick the image from your photos.`,
          );
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
    <>
      <div className="fixed inset-0 z-50 bg-black/40" aria-hidden="true" onClick={onClose} />
      <div
        role="dialog"
        aria-label="Share profile"
        className="fixed z-50 left-1/2 -translate-x-1/2 top-8 sm:top-1/2 sm:-translate-y-1/2 w-[calc(100vw-1.5rem)] sm:w-[28rem] max-h-[calc(100vh-2rem)] overflow-y-auto bg-surface border border-border/50 rounded-2xl shadow-xl"
      >
        <div className="p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-text">Share profile</h2>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg border border-border text-text-muted hover:text-text flex items-center justify-center text-sm"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          <div className="bg-white rounded-xl p-4 flex justify-center mb-3">
            <QRCodeSVG value={qrUrl} size={140} level="M" includeMargin />
          </div>

          <p className="text-xs text-text-muted text-center mb-3">
            Scan to open <span className="text-text font-medium">@{handle}</span>
          </p>

          <div className="flex items-center gap-2 rounded-xl bg-surface-raised border border-border px-3 py-2 mb-5">
            <code className="text-xs text-text truncate flex-1">{profileUrl.replace(/^https?:\/\//, "")}</code>
            <button
              type="button"
              onClick={copyLink}
              className="shrink-0 text-xs font-semibold text-accent hover:text-accent/80"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>

          <div className="border-t border-border/50 pt-5 mb-4">
            <h3 className="text-xs font-semibold text-text mb-1">Share as story</h3>
            <p className="text-xs text-text-muted mb-3">
              Post your QR code and profile link to Instagram, Facebook, WhatsApp, and more.
            </p>

            <div className="rounded-xl overflow-hidden border border-border bg-[#0f0f12] mb-3 aspect-[9/16] max-h-48 flex items-center justify-center">
              {storyPreviewUrl ? (
                <img
                  src={storyPreviewUrl}
                  alt="Story preview"
                  className="h-full w-full object-contain"
                />
              ) : (
                <span className="text-xs text-text-muted">
                  {generatingStory ? "Creating story image…" : "Loading preview…"}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={downloadStoryImage}
              disabled={generatingStory}
              className="w-full mb-3 rounded-xl bg-surface-raised border border-border px-4 py-2.5 text-sm font-semibold text-text hover:border-accent/50 transition-colors disabled:opacity-50"
            >
              {generatingStory ? "Preparing…" : "Download story image"}
            </button>

            <div className="grid grid-cols-2 gap-2">
              {STORY_SHARE_PLATFORMS.map((platform) => (
                <button
                  key={platform.id}
                  type="button"
                  onClick={() => shareToPlatform(platform.id)}
                  disabled={generatingStory || sharingPlatform === platform.id}
                  className="flex items-center gap-2 rounded-xl bg-surface-raised border border-border px-3 py-2.5 text-left text-xs font-semibold text-text hover:border-accent/50 transition-colors disabled:opacity-50"
                >
                  <SocialIcon platform={platform.id} size={18} />
                  <span className="truncate">
                    {sharingPlatform === platform.id ? "Sharing…" : platform.label}
                  </span>
                </button>
              ))}
            </div>

            {storyHint && (
              <p className="text-xs text-accent mt-3 leading-relaxed">{storyHint}</p>
            )}
          </div>

          <div className="flex gap-2">
            {typeof navigator !== "undefined" && "share" in navigator && (
              <button
                type="button"
                onClick={nativeShareLink}
                className="flex-1 rounded-xl bg-surface-raised border border-border px-4 py-2.5 text-sm font-semibold text-text hover:border-accent/50 transition-colors"
              >
                Share link…
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-black hover:scale-[1.01] transition-all"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
