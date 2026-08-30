import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useFetcher, useLoaderData, useSearchParams } from "@remix-run/react";
import { useEffect, useMemo, useState } from "react";
import { EmptyState } from "~/components/EmptyState";
import { NavIcon } from "~/components/NavIcon";
import { PageHeader } from "~/components/PageHeader";
import { adminApi } from "~/lib/api.server";
import { requireAdminSession } from "~/lib/session.server";

type Audience =
  | { mode: "handle"; handle: string; includeSuspended?: boolean }
  | { mode: "all"; includeSuspended?: boolean }
  | {
      mode: "filter";
      includeSuspended?: boolean;
      roles?: string[];
      signedUpWithinDays?: number;
      lastSeenWithinDays?: number;
      hasPushSubscription?: boolean;
    };

interface Campaign {
  id: string;
  actor_handle: string;
  title: string;
  body: string;
  audience_summary: string;
  recipient_count: number;
  created_at: string;
}

interface PreviewResult {
  count: number;
  sampleHandles: string[];
}

interface ActionResult {
  error?: string;
  message?: string;
  preview?: PreviewResult;
  ok?: boolean;
  sent?: number;
  count?: number;
}

const ROLES = ["user", "moderator", "editor", "admin"] as const;

function optionalInt(value: FormDataEntryValue | null): number | undefined {
  const raw = String(value ?? "").trim();
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined;
}

function audienceFromForm(form: FormData, role: string): Audience {
  const includeSuspended = form.get("includeSuspended") === "on";
  const requestedMode = String(form.get("mode") ?? "handle");
  const mode = role === "admin" ? requestedMode : "handle";

  if (mode === "all") {
    return { mode: "all", includeSuspended };
  }
  if (mode === "filter") {
    const roles = form.getAll("role").map(String).filter((value) => ROLES.includes(value as (typeof ROLES)[number]));
    return {
      mode: "filter",
      includeSuspended,
      roles: roles.length ? roles : undefined,
      signedUpWithinDays: optionalInt(form.get("signedUpWithinDays")),
      lastSeenWithinDays: optionalInt(form.get("lastSeenWithinDays")),
      hasPushSubscription: form.get("hasPushSubscription") === "on" ? true : undefined,
    };
  }

  return {
    mode: "handle",
    handle: String(form.get("handle") ?? "").trim().replace(/^@+/, ""),
    includeSuspended,
  };
}

async function readAdminError(err: unknown): Promise<ActionResult> {
  if (err instanceof Response) {
    const data = (await err.json().catch(() => ({}))) as ActionResult & { error?: string; message?: string };
    return {
      error: data.error ?? "failed",
      message: data.message ?? "Request failed.",
      count: data.count,
      preview: data.count !== undefined ? { count: Number(data.count), sampleHandles: [] } : undefined,
    };
  }
  throw err;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const { token, role } = await requireAdminSession(request);
  const data = await adminApi<{ campaigns: Campaign[]; total: number }>("/notifications", token);
  return { ...data, role };
}

export async function action({ request }: ActionFunctionArgs) {
  const { token, role } = await requireAdminSession(request);
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");
  const audience = audienceFromForm(form, role);

  try {
    if (intent === "preview") {
      const preview = await adminApi<PreviewResult>("/notifications/preview", token, {
        method: "POST",
        body: { audience },
      });
      return { preview } satisfies ActionResult;
    }

    if (intent === "send") {
      const title = String(form.get("title") ?? "").trim();
      const body = String(form.get("body") ?? "").trim();
      const confirmCount = Number(form.get("confirmCount") ?? 0);
      const result = await adminApi<{ ok: boolean; sent: number }>("/notifications", token, {
        method: "POST",
        body: { audience, title, body, confirmCount },
      });
      return { ok: true, sent: result.sent } satisfies ActionResult;
    }
  } catch (err) {
    return readAdminError(err);
  }

  return { error: "invalid_intent", message: "Unknown action." } satisfies ActionResult;
}

export default function Notify() {
  const { campaigns, role } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const fetcher = useFetcher<ActionResult>();
  const isAdmin = role === "admin";
  const [mode, setMode] = useState<"handle" | "all" | "filter">(isAdmin ? "handle" : "handle");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [broadcastOk, setBroadcastOk] = useState(false);

  const preview = fetcher.data?.preview;
  const sent = fetcher.data?.ok ? fetcher.data.sent : undefined;
  const errorMessage = fetcher.data?.error ? fetcher.data.message ?? fetcher.data.error : null;
  const busy = fetcher.state !== "idle";

  const defaultHandle = searchParams.get("handle") ?? "";

  useEffect(() => {
    setBroadcastOk(false);
  }, [mode, title, body, preview?.count]);

  const recipientLabel = useMemo(() => {
    if (!preview) return null;
    const samples = preview.sampleHandles.map((handle) => `@${handle}`).join(", ");
    const extra = preview.count > preview.sampleHandles.length ? "…" : "";
    return `${preview.count} recipient${preview.count === 1 ? "" : "s"}${samples ? ` · ${samples}${extra}` : ""}`;
  }, [preview]);

  return (
    <div>
      <PageHeader title="Notify" subtitle="In-app inbox and web push. No email." />

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <fetcher.Form method="post" className="card space-y-4">
          <div>
            <label className="label-mono mb-2 block">Title ({title.length}/80)</label>
            <input
              name="title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={80}
              className="input w-full"
              placeholder="Short headline"
            />
          </div>
          <div>
            <label className="label-mono mb-2 block">Message ({body.length}/280)</label>
            <textarea
              name="body"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              maxLength={280}
              rows={5}
              className="input w-full resize-y"
              placeholder="What should they know?"
            />
          </div>

          {isAdmin ? (
            <div>
              <p className="label-mono mb-2">Audience</p>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["handle", "One handle"],
                    ["all", "Everyone"],
                    ["filter", "Filter"],
                  ] as const
                ).map(([id, label]) => (
                  <label
                    key={id}
                    className={`inline-flex cursor-pointer items-center rounded-full border px-3 py-2 text-sm font-semibold ${
                      mode === id ? "border-accent bg-accent text-black" : "border-border text-text-muted"
                    }`}
                  >
                    <input
                      type="radio"
                      name="mode"
                      value={id}
                      checked={mode === id}
                      onChange={() => setMode(id)}
                      className="sr-only"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          ) : (
            <input type="hidden" name="mode" value="handle" />
          )}

          {mode === "handle" && (
            <div>
              <label className="label-mono mb-2 block">Handle</label>
              <input
                name="handle"
                defaultValue={defaultHandle}
                required={mode === "handle"}
                className="input w-full sm:max-w-sm"
                placeholder="waac"
              />
            </div>
          )}

          {isAdmin && mode === "filter" && (
            <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
              <p className="label-mono">Roles</p>
              <div className="flex flex-wrap gap-2">
                {ROLES.map((value) => (
                  <label key={value} className="inline-flex items-center gap-2 text-sm text-text-muted">
                    <input type="checkbox" name="role" value={value} className="accent-yellow-300" />
                    {value}
                  </label>
                ))}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label-mono mb-2 block">Signed up within days</label>
                  <input name="signedUpWithinDays" type="number" min={1} max={3650} className="input" placeholder="e.g. 30" />
                </div>
                <div>
                  <label className="label-mono mb-2 block">Last seen within days</label>
                  <input name="lastSeenWithinDays" type="number" min={1} max={3650} className="input" placeholder="e.g. 7" />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-text-muted">
                <input type="checkbox" name="hasPushSubscription" className="accent-yellow-300" />
                Only users with web push enabled
              </label>
            </div>
          )}

          <label className="flex items-center gap-2 text-sm text-text-muted">
            <input type="checkbox" name="includeSuspended" className="accent-yellow-300" />
            Include suspended accounts
          </label>

          {preview && (
            <>
              <input type="hidden" name="confirmCount" value={preview.count} />
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-accent">{recipientLabel}</p>
            </>
          )}

          {preview && preview.count > 1 && (
            <label className="flex items-center gap-2 text-sm text-text">
              <input
                type="checkbox"
                checked={broadcastOk}
                onChange={(event) => setBroadcastOk(event.target.checked)}
                className="accent-yellow-300"
              />
              Send to {preview.count} people
            </label>
          )}

          {errorMessage && <p className="text-sm text-[var(--danger)]">{errorMessage}</p>}
          {sent !== undefined && (
            <p className="text-sm text-[var(--success)]">Sent to {sent} {sent === 1 ? "user" : "users"}.</p>
          )}

          <div className="flex flex-wrap gap-2">
            <button type="submit" name="intent" value="preview" disabled={busy} className="btn btn-outline">
              {busy ? "Working…" : "Preview recipients"}
            </button>
            <button
              type="submit"
              name="intent"
              value="send"
              disabled={busy || !preview || preview.count < 1 || (preview.count > 1 && !broadcastOk)}
              className="btn btn-primary"
            >
              Send
            </button>
          </div>
        </fetcher.Form>

        <div>
          <h2 className="label-mono mb-3">Recent sends</h2>
          {campaigns.length === 0 ? (
            <EmptyState
              icon={<NavIcon name="notify" className="h-8 w-8" />}
              title="No notifications yet"
              description="Preview an audience, then send. Recipients see it in the dashboard bell and as a web push if they opted in."
            />
          ) : (
            <ul className="space-y-3">
              {campaigns.map((campaign) => (
                <li key={campaign.id} className="card">
                  <p className="font-extrabold tracking-tight">{campaign.title}</p>
                  <p className="mt-1 text-sm text-text-muted">{campaign.body}</p>
                  <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted">
                    {campaign.recipient_count} · {campaign.audience_summary} · @{campaign.actor_handle} ·{" "}
                    {new Date(campaign.created_at).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
