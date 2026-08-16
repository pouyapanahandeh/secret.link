export function createEmojiMarkerIcon(L: any, emoji: string, hasMedia = false) {
  const badge = hasMedia
    ? `<span style="position:absolute;right:-4px;bottom:-2px;width:16px;height:16px;border-radius:9999px;background:#facc15;border:1.5px solid #fff;display:flex;align-items:center;justify-content:center;font-size:9px;line-height:1;box-shadow:0 1px 3px rgba(0,0,0,0.4)">📷</span>`
    : "";
  return L.divIcon({
    className: "secret-marker",
    html: `<div style="position:relative;font-size:24px;cursor:pointer;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5));line-height:1">${emoji}${badge}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
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
