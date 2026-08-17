import { getSocialIconData } from "@secretlink/core/socials";

interface SocialIconProps {
  platform: string;
  size?: number;
  className?: string;
}

export function SocialIcon({ platform, size = 20, className }: SocialIconProps) {
  const key = platform.toLowerCase();
  const { path, color } = getSocialIconData(key);

  if (key === "snapchat") {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        aria-hidden="true"
        className={className}
      >
        <rect width="24" height="24" rx="6" fill="#FFFC00" />
        <g transform="translate(2.4 1.8) scale(0.8)">
          <path d={path} fill="#111111" />
        </g>
      </svg>
    );
  }

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
