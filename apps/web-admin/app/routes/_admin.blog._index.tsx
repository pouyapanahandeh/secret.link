import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { requireBlogReaderSession, requireBlogEditorSession } from "~/lib/session.server";
import { adminApi } from "~/lib/api.server";
import { Link, useLoaderData, useSearchParams, useNavigation, useActionData } from "@remix-run/react";
import { useEffect } from "react";
import { BlogPostCard, type BlogPost } from "~/components/BlogPostCard";
import { EmptyState } from "~/components/EmptyState";
import { FilterTabs } from "~/components/FilterTabs";
import { NavIcon } from "~/components/NavIcon";
import { PageHeader } from "~/components/PageHeader";
import { Toast, useFlashToast } from "~/components/Toast";

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

  return { ok: true, intent };
}

export default function BlogAdmin() {
  const { posts, total, currentStatus, role } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [, setSearchParams] = useSearchParams();
  const navigation = useNavigation();
  const { message: toastMessage, show: showToast } = useFlashToast();
  const isActioning = navigation.state === "submitting";
  const canEdit = role === "admin" || role === "editor";
  const list = (posts ?? []) as BlogPost[];

  useEffect(() => {
    if (actionData && "intent" in actionData && actionData.intent === "publish") {
      showToast("Blog has been published");
    }
  }, [actionData, showToast]);

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

      {list.length === 0 ? (
        <EmptyState
          icon={<NavIcon name="blog" className="h-8 w-8" />}
          title={`No ${currentStatus} posts`}
          description={canEdit ? "Write a post to publish on secretlink.life." : "Nothing in this tab yet."}
        />
      ) : (
        <div className="space-y-5">
          {list.map((post) => (
            <BlogPostCard
              key={post.id}
              post={post}
              canEdit={canEdit}
              isAdmin={role === "admin"}
              isActioning={isActioning}
            />
          ))}
        </div>
      )}
      <Toast message={toastMessage} />
    </div>
  );
}
