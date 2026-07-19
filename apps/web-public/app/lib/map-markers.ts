import type { PlaceGroup } from "@secretlink/core";
import type { MapSecret } from "./map-types";

export function createEmojiMarkerIcon(L: any, emoji: string) {
  return L.divIcon({
    className: "secret-marker",
    html: `<div style="font-size:24px;cursor:pointer;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5))">${emoji}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

export function createClusterMarkerIcon(L: any, group: PlaceGroup) {
  return L.divIcon({
    className: "secret-cluster-marker",
    html: `<div style="position:relative;width:40px;height:40px;cursor:pointer">
      <div style="width:40px;height:40px;border-radius:50%;background:rgba(250,204,21,0.9);border:2px solid #fff;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:#000;box-shadow:0 2px 8px rgba(0,0,0,0.4)">${group.count}</div>
    </div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
}

export function createPinMarkerIcon(L: any) {
  return L.divIcon({
    html: '<div style="font-size:28px;text-align:center;line-height:34px;">📍</div>',
    className: "",
    iconSize: [34, 34],
    iconAnchor: [17, 34],
  });
}

export type MapMarkerTarget =
  | { type: "secret"; secret: MapSecret }
  | { type: "group"; group: PlaceGroup };
