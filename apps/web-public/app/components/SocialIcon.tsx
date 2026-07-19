import { getSocialIconData } from "@secretlink/core/socials";

interface SocialIconProps {
  platform: string;
  size?: number;
  className?: string;
}

export function SocialIcon({ platform, size = 20, className }: SocialIconProps) {
  const { path, color } = getSocialIconData(platform);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      aria-hidden="true"
      className={className}
    >
      <path d={path} />
    </svg>
  );
}
