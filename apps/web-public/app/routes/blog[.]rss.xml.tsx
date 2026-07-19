import type { LoaderFunctionArgs } from "@remix-run/node";
import { API_URL } from "../lib/api.server";

type BlogPostSummary = {
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: string | null;
};

export async function loader({ request }: LoaderFunctionArgs) {
  const origin = process.env["PUBLIC_ORIGIN"] ?? new URL(request.url).origin;

  let posts: BlogPostSummary[] = [];
  try {
    const res = await fetch(`${API_URL}/v1/public/blog?limit=50`);
    if (res.ok) {
      const data = (await res.json()) as { posts?: BlogPostSummary[] };
      posts = Array.isArray(data.posts) ? data.posts : [];
    }
  } catch {
    // Empty feed if API unavailable.
  }

  const items = posts
    .map((post) => {
      const pubDate = post.publishedAt ? new Date(post.publishedAt).toUTCString() : new Date().toUTCString();
      return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${origin}/blog/${encodeURIComponent(post.slug)}</link>
      <guid isPermaLink="true">${origin}/blog/${encodeURIComponent(post.slug)}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeXml(post.excerpt)}</description>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Secretlink.life Blog</title>
    <link>${origin}/blog</link>
    <description>Privacy, security, and ephemeral messaging insights from Secretlink.life.</description>
    <language>en-us</language>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
