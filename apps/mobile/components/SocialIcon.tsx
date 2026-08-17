import Svg, { G, Path, Rect } from "react-native-svg";
import { getSocialIconData } from "@secretlink/core/socials";

interface SocialIconProps {
  platform: string;
  size?: number;
}

export function SocialIcon({ platform, size = 20 }: SocialIconProps) {
  const key = platform.toLowerCase();
  const { path, color } = getSocialIconData(key);

  if (key === "snapchat") {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Rect width="24" height="24" rx="6" fill="#FFFC00" />
        <G transform="translate(2.4 1.8) scale(0.8)">
          <Path d={path} fill="#111111" />
        </G>
      </Svg>
    );
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d={path} />
    </Svg>
  );
}
