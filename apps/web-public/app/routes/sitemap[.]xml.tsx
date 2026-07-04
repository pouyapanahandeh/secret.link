import type { LoaderFunctionArgs } from "@remix-run/node";

// Public, crawlable pages only. Authenticated app routes (dashboard, messages,
// send, auth) are intentionally excluded and disallowed in robots.txt.
const PUBLIC_PATHS = [
  { path: "/", priority: "1.0", changefreq: "daily" },
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

  const urls = PUBLIC_PATHS.map(
    ({ path, priority, changefreq }) => `  <url>
    <loc>${origin}${path}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`,
  ).join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
