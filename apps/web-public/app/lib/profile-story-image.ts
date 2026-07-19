function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/** Branded 9:16 story card with QR code + profile link (for Instagram/Facebook/etc.). */
export async function generateProfileStoryImage({
  handle,
  profileUrl,
  qrUrl,
}: {
  handle: string;
  profileUrl: string;
  qrUrl: string;
}): Promise<Blob> {
  const W = 1080;
  const H = 1920;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");

  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "#0f0f12");
  grad.addColorStop(1, "#17171f");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "rgba(200, 255, 0, 0.07)";
  ctx.beginPath();
  ctx.arc(W / 2, H * 0.38, 300, 0, Math.PI * 2);
  ctx.fill();

  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 52px system-ui, -apple-system, sans-serif";
  ctx.fillText("secretlink.life", W / 2, 180);

  ctx.fillStyle = "#ffffff";
  ctx.font = "800 80px system-ui, -apple-system, sans-serif";
  ctx.fillText(`@${handle}`, W / 2, 310);

  ctx.fillStyle = "#a8a8b3";
  ctx.font = "500 34px system-ui, -apple-system, sans-serif";
  ctx.fillText("Scan to send me a secret 🔒", W / 2, 390);

  const QRCode = await import("qrcode");
  const qrDataUrl = await QRCode.toDataURL(qrUrl, {
    width: 520,
    margin: 1,
    color: { dark: "#000000", light: "#ffffff" },
  });
  const qrImg = await loadImage(qrDataUrl);
  const qrSize = 520;
  const qrX = (W - qrSize) / 2;
  const qrY = 460;

  ctx.fillStyle = "#ffffff";
  roundRect(ctx, qrX - 28, qrY - 28, qrSize + 56, qrSize + 56, 36);
  ctx.fill();
  ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

  const shortUrl = profileUrl.replace(/^https?:\/\//, "");
  ctx.fillStyle = "#c8ff00";
  ctx.font = "600 38px system-ui, -apple-system, sans-serif";
  ctx.fillText(shortUrl, W / 2, H - 220);

  ctx.fillStyle = "#888894";
  ctx.font = "500 28px system-ui, -apple-system, sans-serif";
  ctx.fillText("End-to-end encrypted · Burns after one read", W / 2, H - 150);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Failed to export story image"));
    }, "image/png");
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function shareStoryImageBlob(blob: Blob, handle: string, profileUrl: string): Promise<"shared" | "downloaded"> {
  const file = new File([blob], `secretlink-${handle}-story.png`, { type: "image/png" });
  const shareText = `Send me a secret — @${handle}`;

  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `@${handle} on Secretlink.life`,
          text: `${shareText}\n${profileUrl}`,
        });
        return "shared";
      }
      await navigator.share({
        title: `@${handle} on Secretlink.life`,
        text: `${shareText}\n${profileUrl}`,
        url: profileUrl,
      });
      return "shared";
    } catch {
      /* user cancelled or unsupported */
    }
  }

  downloadBlob(blob, file.name);
  return "downloaded";
}
