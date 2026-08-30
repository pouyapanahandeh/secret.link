import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { requireBlogReaderSession, requireBlogEditorSession } from "~/lib/session.server";
import { adminApi, uploadBlogCover } from "~/lib/api.server";
import { Form, Link, useLoaderData, useNavigation, useActionData } from "@remix-run/react";
import { useEffect, useMemo, useState } from "react";
import { BlogCoverUpload } from "~/components/BlogCoverUpload";
import { MarkdownEditor } from "~/components/MarkdownEditor";
import { PageHeader } from "~/components/PageHeader";
import { renderBlogMarkdown } from "~/lib/blog-markdown";

function slugifyTitle(title: string) {
  const slug = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug.length >= 3 ? slug : "post";
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { token, role } = await requireBlogReaderSession(request);
  const id = params.id!;

  if (id === "new") {
    if (role !== "admin" && role !== "editor") {
      throw new Response("Forbidden", { status: 403 });
    }
    return { post: null, role, isNew: true };
  }

  const post = await adminApi(`/blog-posts/${id}`, token);
  return { post, role, isNew: false };
}

export async function action({ request, params }: ActionFunctionArgs) {
  const { token } = await requireBlogEditorSession(request);
  const formData = await request.formData();
  const id = params.id!;
  const intent = formData.get("intent") as string;

  if (intent === "upload-cover") {
    const coverFile = formData.get("cover") as File | null;
    if (!coverFile || coverFile.size === 0) {
      return { error: "no_file", message: "No file selected." };
    }
    try {
      const uploaded = await uploadBlogCover(token, coverFile);
      return { coverImageUrl: uploaded.url };
    } catch {
      return { error: "upload_failed", message: "Upload failed. Use a JPEG, PNG, WebP, or GIF under 5MB." };
    }
  }

  const coverImageUrl = ((formData.get("coverImageUrl") as string) || "").trim() || null;

  const payload = {
    title: String(formData.get("title") ?? "").trim(),
    slug: String(formData.get("slug") ?? "").trim().toLowerCase(),
    excerpt: String(formData.get("excerpt") ?? "").trim(),
    keywords: String(formData.get("keywords") ?? "").trim(),
    body: String(formData.get("body") ?? "").trim(),
    coverImageUrl,
    status: intent === "publish" ? "published" : "draft",
  };

  if (id === "new") {
    const created = (await adminApi("/blog-posts", token, { method: "POST", body: payload })) as { id: string };
    return redirect(`/blog/${created.id}`);
  }

  await adminApi(`/blog-posts/${id}`, token, { method: "PATCH", body: payload });
  return { ok: true, coverImageUrl };
}

function MarkdownPreview({ markdown }: { markdown: string }) {
  const html = useMemo(() => renderBlogMarkdown(markdown), [markdown]);

  return (
    <div
      className="blog-preview text-sm leading-relaxed text-text"
      dangerouslySetInnerHTML={{ __html: `<p>${html}</p>` }}
    />
  );
}

export default function BlogEditor() {
  const { post, role, isNew } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const canEdit = role === "admin" || role === "editor";

  const initial = (post ?? {}) as any;
  const [title, setTitle] = useState(initial.title ?? "");
  const [slug, setSlug] = useState(initial.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [excerpt, setExcerpt] = useState(initial.excerpt ?? "");
  const [keywords, setKeywords] = useState(initial.keywords ?? "");
  const [body, setBody] = useState(initial.body ?? "");
  const [coverUrl, setCoverUrl] = useState<string | null>(initial.coverImageUrl ?? null);

  useEffect(() => {
    if (actionData && "coverImageUrl" in actionData) {
      setCoverUrl(actionData.coverImageUrl ?? null);
    }
  }, [actionData]);

  if (!canEdit && !isNew) {
    return (
      <div>
        <PageHeader title={initial.title ?? "Blog post"} />
        <div className="card space-y-4">
          {coverUrl && (
            <img src={coverUrl} alt="" className="mx-auto w-full max-h-64 rounded-lg object-contain bg-surface" />
          )}
          <p className="text-sm text-[var(--text-muted)]">{initial.excerpt}</p>
          <pre className="whitespace-pre-wrap text-sm">{initial.body}</pre>
          <Link to="/blog" className="btn btn-outline inline-block">
            Back to list
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={isNew ? "New blog post" : "Edit blog post"}
        actions={
          <Link to="/blog" className="btn btn-outline text-sm">
            Back
          </Link>
        }
      />

      <Form method="post" encType="multipart/form-data" className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="card space-y-4">
            <div>
              <label className="label-mono mb-2 block">Title</label>
              <input
                name="title"
                required
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (!slugTouched) setSlug(slugifyTitle(e.target.value));
                }}
                className="input w-full"
              />
            </div>
            <div>
              <label className="label-mono mb-2 block">Slug</label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-[var(--text-muted)]">/blog/</span>
                <input
                  name="slug"
                  required
                  value={slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setSlug(e.target.value);
                  }}
                  className="input flex-1"
                  pattern="[a-z0-9-]{3,80}"
                />
              </div>
            </div>
            <div>
              <label className="label-mono mb-2 block">
                Short description <span className="tracking-normal">({excerpt.length}/160)</span>
              </label>
              <textarea
                name="excerpt"
                required
                rows={3}
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                className="input w-full resize-y"
              />
            </div>
            <div>
              <label className="label-mono mb-2 block">Keywords</label>
              <input name="keywords" value={keywords} onChange={(e) => setKeywords(e.target.value)} className="input w-full" />
            </div>
            <div>
              <label className="label-mono mb-2 block">Cover photo</label>
              <input type="hidden" name="coverImageUrl" value={coverUrl ?? ""} />
              <BlogCoverUpload
                coverUrl={coverUrl}
                onCoverUrlChange={setCoverUrl}
                disabled={isSubmitting}
              />
            </div>
            <div>
              <label className="label-mono mb-2 block">Body (Markdown)</label>
              <MarkdownEditor name="body" required value={body} onChange={setBody} disabled={isSubmitting} />
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="submit" name="intent" value="draft" disabled={isSubmitting} className="btn btn-outline">
                Save draft
              </button>
              <button type="submit" name="intent" value="publish" disabled={isSubmitting} className="btn btn-primary">
                {isSubmitting ? "Saving..." : "Publish"}
              </button>
            </div>
          </div>

          <div className="card">
            <h2 className="label-mono mb-4">Preview</h2>
            {coverUrl && (
              <div className="mb-4 overflow-hidden rounded-lg border border-border bg-surface">
                <img src={coverUrl} alt="" className="mx-auto max-h-64 w-full object-contain" />
              </div>
            )}
            <h1 className="mb-2 text-2xl font-bold text-[var(--text)]">{title || "Post title"}</h1>
            <p className="mb-4 text-sm text-[var(--text-muted)]">{excerpt || "Short description preview"}</p>
            {keywords && (
              <p className="mb-4 text-xs text-[var(--accent)]">{keywords}</p>
            )}
            <MarkdownPreview markdown={body || "Write your post content in Markdown..."} />
          </div>
        </div>
      </Form>
    </div>
  );
}
