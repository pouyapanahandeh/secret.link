import {
  SOCIAL_LABELS,
  SOCIAL_PLATFORMS,
  detectPlatform,
  getSocialLabel,
  getSocialIconData,
  type SocialIconData,
} from "@secretlink/core/socials";

export {
  SOCIAL_LABELS,
  SOCIAL_PLATFORMS,
  detectPlatform,
  getSocialLabel,
  getSocialIconData,
  type SocialIconData,
};

export interface SocialMeta {
  label: string;
}

export const SOCIAL_META: Record<string, SocialMeta> = Object.fromEntries(
  SOCIAL_PLATFORMS.map((key) => [key, { label: SOCIAL_LABELS[key]! }]),
);

export function getSocialMeta(platform: string): SocialMeta {
  return { label: getSocialLabel(platform) };
}
