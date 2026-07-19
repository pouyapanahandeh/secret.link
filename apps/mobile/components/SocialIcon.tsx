import Svg, { Path } from "react-native-svg";
import { getSocialIconData } from "@secretlink/core/socials";

interface SocialIconProps {
  platform: string;
  size?: number;
}

export function SocialIcon({ platform, size = 20 }: SocialIconProps) {
  const { path, color } = getSocialIconData(platform);

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d={path} />
    </Svg>
  );
}
