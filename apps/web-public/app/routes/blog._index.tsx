import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { BlogLayout } from "../components/BlogLayout";
import { formatBlogDate } from "../lib/blog-markdown";
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
    { property: "og:image", content: "https://secretlink.life/secretlink.png" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: "https://secretlink.life/secretlink.png" },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const res = await fetch(`${API_URL}/v1/public/blog?limit=50`);
  if (!res.ok) {
    throw new Response("Failed to load blog posts", { status: 502 });
  }
  const data = (await res.json()) as { posts: BlogPostCard[] };
  const origin = process.env["PUBLIC_ORIGIN"] ?? new URL(request.url).origin;
  return json({ posts: data.posts, origin });
}

type BlogPostCard = {
  slug: string;
  title: string;
  excerpt: string;
  coverImageUrl: string | null;
  publishedAt: string | null;
};

export default function BlogIndex() {
  const { posts } = useLoaderData<typeof loader>();

  return (
    <BlogLayout>
      <header className="mb-10 text-center">
        <p className="text-sm uppercase tracking-[0.2em] text-accent mb-3">Secretlink.life</p>
        <h1 className="font-display text-4xl sm:text-5xl mb-4">Blog</h1>
        <p className="text-text-muted max-w-2xl mx-auto leading-relaxed">
          Stories about privacy, ephemeral messaging, and building a safer way to say what you really mean.
        </p>
      </header>

      {posts.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface-raised p-10 text-center text-text-muted">
          New posts are coming soon.
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2">
          {posts.map((post) => (
            <article
              key={post.slug}
              className="group overflow-hidden rounded-2xl border border-border bg-surface-raised hover:border-accent/40 transition-colors"
            >
              <Link to={`/blog/${post.slug}`} className="block">
                {post.coverImageUrl ? (
                  <div className="flex h-44 w-full items-center justify-center bg-surface overflow-hidden">
                    <img
                      src={post.coverImageUrl}
                      alt=""
                      className="h-full w-full object-contain p-4 group-hover:scale-[1.02] transition-transform duration-300"
                    />
                  </div>
                ) : (
                  <div className="h-44 w-full bg-accent/10 flex items-center justify-center">
                    <img src="/secretlink.png" alt="" className="w-16 h-16 opacity-60" />
                  </div>
                )}
                <div className="p-5">
                  <time className="text-xs text-text-muted">{formatBlogDate(post.publishedAt)}</time>
                  <h2 className="mt-2 text-xl font-bold text-text group-hover:text-accent transition-colors">
                    {post.title}
                  </h2>
                  <p className="mt-2 text-sm text-text-muted line-clamp-3">{post.excerpt}</p>
                  <span className="mt-4 inline-block text-sm font-semibold text-accent">Read more →</span>
                </div>
              </Link>
            </article>
          ))}
        </div>
      )}
    </BlogLayout>
  );
}
