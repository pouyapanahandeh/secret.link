import { Form, Link } from "@remix-run/react";

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  coverImageUrl: string | null;
  status: string;
  authorHandle: string | null;
  updatedAt: string;
  publishedAt: string | null;
}

function formatDate(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const ghostBtn =
  "inline-flex h-10 items-center rounded-full border border-border px-4 font-mono text-[10px] uppercase tracking-[0.16em] text-text-muted hover:border-text-muted hover:text-text disabled:opacity-50";

const dangerBtn =
  "inline-flex h-10 items-center rounded-full border border-danger/40 px-4 font-mono text-[10px] uppercase tracking-[0.16em] text-danger hover:border-danger hover:bg-danger/10 disabled:opacity-50";

export function BlogPostCard({
  post,
  canEdit,
  isAdmin,
  isActioning,
}: {
  post: BlogPost;
  canEdit: boolean;
  isAdmin: boolean;
  isActioning: boolean;
}) {
  const updated = formatDate(post.updatedAt);
  const published = formatDate(post.publishedAt);

  return (
    <article className="group overflow-hidden rounded-[1.25rem] border border-border bg-surface-raised transition-colors hover:border-white/15">
      <div className="flex flex-col lg:flex-row">
        <div className="relative h-56 w-full shrink-0 overflow-hidden bg-surface sm:h-64 lg:h-auto lg:min-h-[17rem] lg:w-80 lg:self-stretch xl:w-96">
          {post.coverImageUrl ? (
            <>
              <img
                src={post.coverImageUrl}
                alt=""
                aria-hidden
                className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-2xl"
              />
              <img
                src={post.coverImageUrl}
                alt=""
                className="relative z-10 h-full w-full object-contain p-5 transition-transform duration-500 group-hover:scale-[1.03] sm:p-6"
              />
            </>
          ) : (
            <div className="flex h-full min-h-[14rem] w-full items-center justify-center bg-gradient-to-br from-surface via-surface-hover to-surface">
              <img src="/secretlink.png" alt="" className="h-16 w-16 opacity-40" />
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col border-t border-border p-6 sm:p-7 lg:border-t-0 lg:border-l lg:p-8">
          <header className="flex flex-wrap items-center gap-2">
            <span className={`badge badge-${post.status}`}>{post.status}</span>
            {post.authorHandle && (
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-muted">
                @{post.authorHandle}
              </span>
            )}
          </header>

          <h2 className="mt-3 text-xl font-extrabold tracking-tight text-text sm:text-2xl">
            <Link to={`/blog/${post.id}`} className="transition-colors hover:text-accent">
              {post.title}
            </Link>
          </h2>

          {post.excerpt && (
            <p className="mt-2 line-clamp-3 text-[15px] leading-relaxed text-text-muted sm:text-base">
              {post.excerpt}
            </p>
          )}

          <dl className="mt-5 grid gap-x-6 gap-y-2 sm:grid-cols-3">
            <div className="min-w-0">
              <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-muted">Slug</dt>
              <dd className="mt-0.5 truncate font-mono text-xs text-text" title={`/blog/${post.slug}`}>
                /blog/{post.slug}
              </dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-muted">Updated</dt>
              <dd className="mt-0.5 text-sm text-text">{updated ?? "—"}</dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-muted">Published</dt>
              <dd className="mt-0.5 text-sm text-text">{published ?? "Not live"}</dd>
            </div>
          </dl>

          <footer className="mt-auto flex flex-wrap items-center gap-2 pt-6">
            <Link
              to={`/blog/${post.id}`}
              className="inline-flex h-10 items-center rounded-full bg-accent px-5 text-xs font-extrabold text-black hover:bg-accent-soft"
            >
              {canEdit ? "Edit" : "View"}
            </Link>
            {post.status === "published" && (
              <a
                href={`https://secretlink.life/blog/${post.slug}`}
                target="_blank"
                rel="noreferrer"
                className={ghostBtn}
              >
                Open live
              </a>
            )}
            {canEdit && post.status !== "published" && (
              <Form method="post">
                <input type="hidden" name="postId" value={post.id} />
                <input type="hidden" name="intent" value="publish" />
                <button type="submit" disabled={isActioning} className={ghostBtn}>
                  Publish
                </button>
              </Form>
            )}
            {canEdit && post.status === "published" && (
              <Form method="post">
                <input type="hidden" name="postId" value={post.id} />
                <input type="hidden" name="intent" value="unpublish" />
                <button type="submit" disabled={isActioning} className={ghostBtn}>
                  Unpublish
                </button>
              </Form>
            )}
            {canEdit && post.status !== "archived" && (
              <Form method="post">
                <input type="hidden" name="postId" value={post.id} />
                <input type="hidden" name="intent" value="archive" />
                <button type="submit" disabled={isActioning} className={ghostBtn}>
                  Archive
                </button>
              </Form>
            )}
            {isAdmin && (
              <Form method="post">
                <input type="hidden" name="postId" value={post.id} />
                <input type="hidden" name="intent" value="delete" />
                <button type="submit" disabled={isActioning} className={dangerBtn}>
                  Delete
                </button>
              </Form>
            )}
          </footer>
        </div>
      </div>
    </article>
  );
}
