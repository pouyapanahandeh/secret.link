export interface SocialMeta {
  icon: string;
  label: string;
}

export const SOCIAL_META: Record<string, SocialMeta> = {
  instagram: { icon: "📷", label: "Instagram" },
  twitter: { icon: "𝕏", label: "Twitter/X" },
  tiktok: { icon: "🎵", label: "TikTok" },
  youtube: { icon: "▶️", label: "YouTube" },
  github: { icon: "🐙", label: "GitHub" },
  linkedin: { icon: "💼", label: "LinkedIn" },
  snapchat: { icon: "👻", label: "Snapchat" },
  telegram: { icon: "✈️", label: "Telegram" },
  facebook: { icon: "📘", label: "Facebook" },
  twitch: { icon: "🎮", label: "Twitch" },
  discord: { icon: "💬", label: "Discord" },
  website: { icon: "🌐", label: "Website" },
};

/** Ordered list of platforms for manual selection dropdowns. */
export const SOCIAL_PLATFORMS = Object.keys(SOCIAL_META);

export function getSocialMeta(platform: string): SocialMeta {
  return SOCIAL_META[platform.toLowerCase()] ?? { icon: "🔗", label: platform || "Link" };
}

/**
 * Infer the social platform from a URL's hostname.
 * Falls back to "website" for unrecognized but valid URLs, and "" for empty/invalid input.
 */
export function detectPlatform(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "";

  let host: string;
  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    host = new URL(withProtocol).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "website";
  }

  const map: Record<string, string> = {
    "instagram.com": "instagram",
    "instagr.am": "instagram",
    "twitter.com": "twitter",
    "x.com": "twitter",
    "tiktok.com": "tiktok",
    "youtube.com": "youtube",
    "youtu.be": "youtube",
    "github.com": "github",
    "linkedin.com": "linkedin",
    "snapchat.com": "snapchat",
    "t.me": "telegram",
    "telegram.me": "telegram",
    "telegram.org": "telegram",
    "facebook.com": "facebook",
    "fb.com": "facebook",
    "twitch.tv": "twitch",
    "discord.com": "discord",
    "discord.gg": "discord",
  };

  if (map[host]) return map[host]!;

  // Match subdomains (e.g. user.github.io stays website, but gaming.youtube.com → youtube)
  for (const domain of Object.keys(map)) {
    if (host === domain || host.endsWith(`.${domain}`)) return map[domain]!;
  }

  return "website";
}
