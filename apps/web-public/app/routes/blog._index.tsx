import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { BlogLayout } from "../components/BlogLayout";
import { formatBlogDate } from "../lib/blog-markdown";
import { getToken } from "../lib/session.server";
import { API_URL } from "../lib/api.server";

export const meta: MetaFunction = () => {
  const title = "Blog — Secretlink.life";
  const description =
    "Privacy, security, and ephemeral messaging insights from the Secretlink.life team. Learn how to communicate without a trace.";
  const url = "https://secretlink.life/blog";
  return [
    { title },
    { name: "description", content: description },
    { tagName: "link", rel: "canonical", href: url },
    { property: "og:type", content: "website" },
    { property: "og:site_name", content: "Secretlink.life" },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:url", content: url },
    { property: "og:image", content: "https://secretlink.life/og.png" },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { property: "og:image:type", content: "image/png" },
    { property: "og:image:alt", content: "Secretlink.life" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: "https://secretlink.life/og.png" },
    { name: "twitter:image:alt", content: "Secretlink.life" },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const res = await fetch(`${API_URL}/v1/public/blog?limit=50`);
  if (!res.ok) {
    throw new Response("Failed to load blog posts", { status: 502 });
  }
  const data = (await res.json()) as { posts: BlogPostCard[] };
  const origin = process.env["PUBLIC_ORIGIN"] ?? new URL(request.url).origin;
  const token = await getToken(request);
  return json({ posts: data.posts, origin, isLoggedIn: Boolean(token) });
}

type BlogPostCard = {
  slug: string;
  title: string;
  excerpt: string;
  coverImageUrl: string | null;
  publishedAt: string | null;
};

export default function BlogIndex() {
  const { posts, isLoggedIn } = useLoaderData<typeof loader>();

  return (
    <BlogLayout isLoggedIn={isLoggedIn}>
      <header className="mb-12">
        <p className="text-[11px] font-semibold tracking-[0.28em] uppercase text-accent mb-4">Notes</p>
        <h1 className="font-extrabold tracking-[-0.04em] text-4xl sm:text-6xl leading-[0.95] mb-4">
          The <span className="font-display font-bold text-accent">blog</span>
        </h1>
        <p className="text-text-muted max-w-xl leading-relaxed">
          Stories about privacy, ephemeral messaging, and building a safer way to say what you really mean.
        </p>
      </header>

      {posts.length === 0 ? (
        <div className="border border-border bg-surface-raised p-10 text-center text-text-muted">
          New posts are coming soon.
        </div>
      ) : (
        <div className="grid gap-px sm:grid-cols-2 bg-border border border-border">
          {posts.map((post) => (
            <article key={post.slug} className="group bg-surface hover:bg-accent transition-colors">
              <Link to={`/blog/${post.slug}`} className="block">
                {post.coverImageUrl ? (
                  <div className="flex h-44 w-full items-center justify-center bg-surface-raised overflow-hidden">
                    <img
                      src={post.coverImageUrl}
                      alt=""
                      className="h-full w-full object-contain p-4"
                    />
                  </div>
                ) : (
                  <div className="h-44 w-full bg-surface-raised flex items-center justify-center">
                    <img src="/secretlink.png" alt="" className="w-14 h-14 opacity-60" />
                  </div>
                )}
                <div className="p-6 sm:p-8">
                  <time className="font-mono text-[10px] tracking-[0.16em] uppercase text-text-muted group-hover:text-black/60">
                    {formatBlogDate(post.publishedAt)}
                  </time>
                  <h2 className="mt-2 text-xl font-extrabold tracking-tight text-text group-hover:text-black">
                    {post.title}
                  </h2>
                  <p className="mt-2 text-sm text-text-muted line-clamp-3 group-hover:text-black/70">{post.excerpt}</p>
                  <span className="mt-4 inline-block text-sm font-semibold text-accent group-hover:text-black">Read more →</span>
                </div>
              </Link>
            </article>
          ))}
        </div>
      )}
    </BlogLayout>
  );
}
