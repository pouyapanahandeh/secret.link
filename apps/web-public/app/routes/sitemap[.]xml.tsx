import type { LoaderFunctionArgs } from "@remix-run/node";
import { API_URL } from "../lib/api.server";

// Public, crawlable pages only. Authenticated app routes (dashboard, messages,
// send, auth) are intentionally excluded and disallowed in robots.txt.
const PUBLIC_PATHS = [
  { path: "/", priority: "1.0", changefreq: "daily" },
  { path: "/map", priority: "0.8", changefreq: "hourly" },
  { path: "/about", priority: "0.6", changefreq: "monthly" },
  { path: "/privacy", priority: "0.5", changefreq: "monthly" },
  { path: "/terms", priority: "0.5", changefreq: "monthly" },
  { path: "/community-guidelines", priority: "0.5", changefreq: "monthly" },
  { path: "/transparency", priority: "0.6", changefreq: "weekly" },
  { path: "/contact", priority: "0.4", changefreq: "yearly" },
  { path: "/login", priority: "0.4", changefreq: "yearly" },
  { path: "/signup", priority: "0.7", changefreq: "yearly" },
];

export async function loader({ request }: LoaderFunctionArgs) {
  const origin = process.env["PUBLIC_ORIGIN"] ?? new URL(request.url).origin;
  const today = new Date().toISOString().slice(0, 10);

  let handles: string[] = [];
  try {
    const res = await fetch(`${API_URL}/v1/users/sitemap-handles`);
    if (res.ok) {
      const data = (await res.json()) as { handles?: string[] };
      handles = Array.isArray(data.handles) ? data.handles : [];
    }
  } catch {
    // Sitemap still returns static pages if API is unreachable.
  }

  const staticUrls = PUBLIC_PATHS.map(
    ({ path, priority, changefreq }) => `  <url>
    <loc>${origin}${path}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`,
  ).join("\n");

  const profileUrls = handles
    .filter((h) => /^[a-zA-Z0-9_]{2,30}$/.test(h))
    .map(
      (h) => `  <url>
    <loc>${origin}/${encodeURIComponent(h)}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`,
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticUrls}
${profileUrls}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
