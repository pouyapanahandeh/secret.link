import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { BlogLayout } from "../components/BlogLayout";
import { formatBlogDate, renderBlogMarkdown } from "../lib/blog-markdown";
import { getToken } from "../lib/session.server";
import { API_URL } from "../lib/api.server";

type BlogPost = {
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  coverImageUrl: string | null;
  keywords: string | null;
  publishedAt: string | null;
  updatedAt: string;
};

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data?.post) {
    return [{ title: "Post not found — Secretlink.life" }];
  }

  const { post, origin } = data;
  const title = `${post.title} — Secretlink.life Blog`;
  const url = `${origin}/blog/${post.slug}`;
  const image = post.coverImageUrl || `${origin}/og.png`;
  const usingSiteOg = !post.coverImageUrl;

  const tags = [
    { title },
    { name: "description", content: post.excerpt },
    ...(post.keywords ? [{ name: "keywords", content: post.keywords }] : []),
    { tagName: "link", rel: "canonical", href: url },
    { property: "og:type", content: "article" },
    { property: "og:site_name", content: "Secretlink.life" },
    { property: "og:title", content: title },
    { property: "og:description", content: post.excerpt },
    { property: "og:url", content: url },
    { property: "og:image", content: image },
    ...(usingSiteOg
      ? [
          { property: "og:image:width", content: "1200" },
          { property: "og:image:height", content: "630" },
          { property: "og:image:type", content: "image/png" },
          { property: "og:image:alt", content: "Secretlink.life" },
        ]
      : []),
    ...(post.publishedAt ? [{ property: "article:published_time", content: post.publishedAt }] : []),
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: post.excerpt },
    { name: "twitter:image", content: image },
    { name: "twitter:image:alt", content: "Secretlink.life" },
  ];

  return tags;
};

export async function loader({ params, request }: LoaderFunctionArgs) {
  const slug = params.slug!;
  const origin = process.env["PUBLIC_ORIGIN"] ?? new URL(request.url).origin;
  const isLoggedIn = Boolean(await getToken(request));

  let res: Response;
  try {
    res = await fetch(`${API_URL}/v1/public/blog/${encodeURIComponent(slug)}`);
  } catch {
    throw new Response("Not found", { status: 404 });
  }
  if (res.status === 404) {
    throw new Response("Not found", { status: 404 });
  }
  if (!res.ok) {
    throw new Response("Failed to load blog post", { status: 502 });
  }

  const post = (await res.json()) as BlogPost;
  const bodyHtml = renderBlogMarkdown(post.body);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt,
    image: post.coverImageUrl || `${origin}/og.png`,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    author: { "@type": "Organization", name: "Secretlink.life" },
    publisher: {
      "@type": "Organization",
      name: "Secretlink.life",
      logo: { "@type": "ImageObject", url: `${origin}/secretlink.png` },
    },
    ...(post.keywords ? { keywords: post.keywords } : {}),
    mainEntityOfPage: { "@type": "WebPage", "@id": `${origin}/blog/${post.slug}` },
  };

  return json({ post, origin, bodyHtml, jsonLd, isLoggedIn });
}

export default function BlogPostPage() {
  const { post, bodyHtml, jsonLd, isLoggedIn } = useLoaderData<typeof loader>();

  return (
    <BlogLayout isLoggedIn={isLoggedIn}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Link to="/blog" className="inline-flex items-center font-mono text-[11px] tracking-[0.16em] uppercase text-text-muted hover:text-accent transition-colors mb-8">
        ← Back to blog
      </Link>

      <article className="max-w-3xl mx-auto">
        {post.coverImageUrl && (
          <div className="mb-8 overflow-hidden border border-border bg-surface-raised">
            <img
              src={post.coverImageUrl}
              alt=""
              className="mx-auto w-full max-h-[420px] object-contain"
            />
          </div>
        )}

        <header className="mb-10">
          <time className="font-mono text-[11px] tracking-[0.16em] uppercase text-text-muted">
            {formatBlogDate(post.publishedAt)}
          </time>
          <h1 className="font-extrabold tracking-[-0.04em] text-4xl sm:text-5xl leading-[0.95] mt-3 mb-4">{post.title}</h1>
          <p className="text-lg text-text-muted leading-relaxed">{post.excerpt}</p>
          {post.keywords && (
            <p className="mt-4 font-mono text-[11px] tracking-[0.16em] uppercase text-accent">{post.keywords}</p>
          )}
        </header>

        <div
          className="blog-content"
          dangerouslySetInnerHTML={{ __html: `<p class="text-text leading-relaxed mb-4">${bodyHtml}</p>` }}
        />
      </article>
    </BlogLayout>
  );
}
