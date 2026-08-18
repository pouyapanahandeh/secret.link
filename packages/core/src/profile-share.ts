/** Share copy for profile links and story cards. */
export function getProfileShareText(handle: string, profileUrl: string): string {
  return `Send me an anonymous secret on Secretlink - @${handle}\n${profileUrl}`;
}

export function getWhatsAppShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function getFacebookShareUrl(url: string): string {
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
}

export function getTwitterShareUrl(text: string, url: string): string {
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
}

export function getTelegramShareUrl(text: string, url: string): string {
  return `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
}

export type StorySharePlatformId =
  | "instagram"
  | "facebook"
  | "whatsapp"
  | "snapchat"
  | "twitter"
  | "telegram";

export interface StorySharePlatform {
  id: StorySharePlatformId;
  label: string;
  /** Share the generated story image via the device share sheet when possible. */
  preferImageShare: boolean;
}

export const STORY_SHARE_PLATFORMS: StorySharePlatform[] = [
  { id: "instagram", label: "Instagram Story", preferImageShare: true },
  { id: "facebook", label: "Facebook Story", preferImageShare: true },
  { id: "whatsapp", label: "WhatsApp Status", preferImageShare: true },
  { id: "snapchat", label: "Snapchat", preferImageShare: true },
  { id: "twitter", label: "X / Twitter", preferImageShare: false },
  { id: "telegram", label: "Telegram", preferImageShare: false },
];

export function getStoryShareFallbackUrl(
  platformId: StorySharePlatformId,
  handle: string,
  profileUrl: string,
): string | null {
  const text = getProfileShareText(handle, profileUrl);
  switch (platformId) {
    case "whatsapp":
      return getWhatsAppShareUrl(text);
    case "facebook":
      return getFacebookShareUrl(profileUrl);
    case "twitter":
      return getTwitterShareUrl(text, profileUrl);
    case "telegram":
      return getTelegramShareUrl(text, profileUrl);
    default:
      return null;
  }
}
