import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { requireBlogReaderSession, requireBlogEditorSession } from "~/lib/session.server";
import { adminApi } from "~/lib/api.server";
import { Link, useLoaderData, useSearchParams, Form, useNavigation } from "@remix-run/react";
import { EmptyState } from "~/components/EmptyState";
import { FilterTabs } from "~/components/FilterTabs";
import { NavIcon } from "~/components/NavIcon";
import { PageHeader } from "~/components/PageHeader";

export async function loader({ request }: LoaderFunctionArgs) {
  const { token, role } = await requireBlogReaderSession(request);
  const url = new URL(request.url);
  const status = url.searchParams.get("status") ?? "draft";
  const data = await adminApi(`/blog-posts?status=${status}`, token);
  return { ...(data as any), currentStatus: status, role };
}

export async function action({ request }: ActionFunctionArgs) {
  const { token, role } = await requireBlogEditorSession(request);
  const formData = await request.formData();
  const postId = formData.get("postId") as string;
  const intent = formData.get("intent") as string;

  if (intent === "delete") {
    if (role !== "admin") {
      return { error: "Only admins can delete posts" };
    }
    await adminApi(`/blog-posts/${postId}`, token, { method: "DELETE" });
    return { ok: true };
  }

  const statusMap: Record<string, string> = {
    publish: "published",
    unpublish: "draft",
    archive: "archived",
  };
  const status = statusMap[intent];
  if (status) {
    await adminApi(`/blog-posts/${postId}`, token, {
      method: "PATCH",
      body: { status },
    });
  }

  return { ok: true };
}

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function BlogAdmin() {
  const { posts, total, currentStatus, role } = useLoaderData<typeof loader>();
  const [, setSearchParams] = useSearchParams();
  const navigation = useNavigation();
  const isActioning = navigation.state === "submitting";
  const canEdit = role === "admin" || role === "editor";

  const statuses = ["draft", "published", "archived"];

  return (
    <div>
      <PageHeader
        title="Blog"
        count={total}
        actions={
          canEdit ? (
            <Link to="/blog/new" className="btn btn-primary text-center">
              New post
            </Link>
          ) : undefined
        }
      />

      <FilterTabs
        tabs={statuses.map((s) => ({
          id: s,
          label: s.charAt(0).toUpperCase() + s.slice(1),
        }))}
        activeId={currentStatus}
        onChange={(id) => setSearchParams({ status: id })}
      />

      <div className="mt-6 space-y-4">
        {(posts as any[]).length === 0 && (
          <EmptyState
            icon={<NavIcon name="blog" className="h-8 w-8" />}
            title={`No ${currentStatus} posts`}
            description={canEdit ? "Write a post to publish on secretlink.life." : "Nothing in this tab yet."}
          />
        )}
        {(posts as any[]).map((post: any) => (
          <div key={post.id} className="card">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
              {post.coverImageUrl && (
                <img
                  src={post.coverImageUrl}
                  alt=""
                  className="h-28 w-full rounded-lg object-contain bg-surface lg:h-24 lg:w-36 shrink-0"
                />
              )}
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className={`badge badge-${post.status}`}>{post.status}</span>
                  {post.authorHandle && (
                    <span className="badge" style={{ background: "var(--border)", color: "var(--text-muted)" }}>
                      @{post.authorHandle}
                    </span>
                  )}
                </div>
                <h2 className="text-lg font-semibold text-[var(--text)]">{post.title}</h2>
                <p className="mt-1 text-sm text-[var(--text-muted)] line-clamp-2">{post.excerpt}</p>
                <p className="mt-2 text-xs text-[var(--text-muted)]">
                  /blog/{post.slug} · Updated {formatDate(post.updatedAt)}
                  {post.publishedAt ? ` · Published ${formatDate(post.publishedAt)}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <Link to={`/blog/${post.id}`} className="btn btn-outline text-xs py-1 px-3">
                  {canEdit ? "Edit" : "View"}
                </Link>
                {canEdit && post.status !== "published" && (
                  <Form method="post" className="inline">
                    <input type="hidden" name="postId" value={post.id} />
                    <input type="hidden" name="intent" value="publish" />
                    <button type="submit" disabled={isActioning} className="btn btn-success text-xs py-1 px-3">
                      Publish
                    </button>
                  </Form>
                )}
                {canEdit && post.status === "published" && (
                  <Form method="post" className="inline">
                    <input type="hidden" name="postId" value={post.id} />
                    <input type="hidden" name="intent" value="unpublish" />
                    <button type="submit" disabled={isActioning} className="btn btn-outline text-xs py-1 px-3">
                      Unpublish
                    </button>
                  </Form>
                )}
                {canEdit && post.status !== "archived" && (
                  <Form method="post" className="inline">
                    <input type="hidden" name="postId" value={post.id} />
                    <input type="hidden" name="intent" value="archive" />
                    <button type="submit" disabled={isActioning} className="btn btn-outline text-xs py-1 px-3">
                      Archive
                    </button>
                  </Form>
                )}
                {role === "admin" && (
                  <Form method="post" className="inline">
                    <input type="hidden" name="postId" value={post.id} />
                    <input type="hidden" name="intent" value="delete" />
                    <button
                      type="submit"
                      disabled={isActioning}
                      className="btn btn-outline text-xs py-1 px-3"
                      style={{ borderColor: "var(--danger)", color: "var(--danger)" }}
                    >
                      Delete
                    </button>
                  </Form>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
