/** Reserved profile handles that collide with static app routes. */
export const RESERVED_HANDLES = new Set([
  "blog",
  "blog-posts",
  "about",
  "privacy",
  "terms",
  "contact",
  "login",
  "signup",
  "dashboard",
  "messages",
  "send",
  "map",
  "onboarding",
  "auth",
  "live",
  "og",
  "s",
]);

export function slugifyTitle(title: string): string {
  const slug = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug.length >= 3 ? slug : "post";
}

export function isValidBlogSlug(slug: string): boolean {
  return /^[a-z0-9-]{3,80}$/.test(slug);
}

export function mapBlogPostRow(row: Record<string, unknown>) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    body: row.body,
    coverImageUrl: row.cover_image_url ?? null,
    keywords: row.keywords ?? null,
    status: row.status,
    authorId: row.author_id ?? null,
    authorHandle: row.author_handle ?? null,
    publishedAt: row.published_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapBlogPostPublic(row: Record<string, unknown>, includeBody = false) {
  const base = {
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    coverImageUrl: row.cover_image_url ?? null,
    keywords: row.keywords ?? null,
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
  };
  if (includeBody) {
    return { ...base, body: row.body };
  }
  return base;
}
