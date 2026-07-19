import type { LoaderFunctionArgs } from "@remix-run/node";

/**
 * Simple branded OG/Twitter card image (SVG) for public profile shares.
 * Used as og:image on /$handle pages.
 */
export async function loader({ params }: LoaderFunctionArgs) {
  const handle = (params["handle"] ?? "user").replace(/^@/, "").slice(0, 40);
  const initial = (handle[0] ?? "?").toUpperCase();

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0f0f12"/>
      <stop offset="100%" stop-color="#1a1a22"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <circle cx="600" cy="240" r="88" fill="#2dd4bf" fill-opacity="0.18" stroke="#2dd4bf" stroke-width="4"/>
  <text x="600" y="270" text-anchor="middle" font-family="system-ui,sans-serif" font-size="72" font-weight="700" fill="#2dd4bf">${escapeXml(initial)}</text>
  <text x="600" y="390" text-anchor="middle" font-family="system-ui,sans-serif" font-size="48" font-weight="700" fill="#f5f5f5">@${escapeXml(handle)}</text>
  <text x="600" y="450" text-anchor="middle" font-family="system-ui,sans-serif" font-size="28" fill="#a1a1aa">Send a secret · Burns after one read</text>
  <text x="600" y="560" text-anchor="middle" font-family="system-ui,sans-serif" font-size="22" fill="#71717a">secretlink.life</text>
</svg>`;

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=86400",
    },
  });
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
