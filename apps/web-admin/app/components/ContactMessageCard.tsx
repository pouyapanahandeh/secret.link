import { Form } from "@remix-run/react";
import { useState } from "react";

export interface ContactMessage {
  id: string;
  name: string | null;
  email: string | null;
  message: string;
  user_id: string | null;
  user_handle: string | null;
  user_role: string | null;
  user_created_at: string | null;
  user_email: string | null;
  user_avatar_url: string | null;
  status: "new" | "read" | "archived";
  created_at: string;
}

function relativeTime(iso: string) {
  const then = new Date(iso).getTime();
  const delta = Date.now() - then;
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (delta < minute) return "just now";
  if (delta < hour) return `${Math.floor(delta / minute)}m ago`;
  if (delta < day) return `${Math.floor(delta / hour)}h ago`;
  if (delta < 14 * day) return `${Math.floor(delta / day)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function exactTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function initialOf(name: string) {
  const ch = name.trim().charAt(0);
  return ch ? ch.toUpperCase() : "?";
}

const ghostBtn =
  "inline-flex h-10 items-center rounded-full border border-border px-4 font-mono text-[10px] uppercase tracking-[0.16em] text-text-muted hover:border-text-muted hover:text-text disabled:opacity-50";

export function ContactMessageCard({
  message,
  isActioning,
}: {
  message: ContactMessage;
  isActioning: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const from = message.name?.trim() || (message.user_handle ? `@${message.user_handle}` : "anonymous");
  const replyEmail = message.email || message.user_email;
  const words = message.message.trim() ? message.message.trim().split(/\s+/).length : 0;
  const account = message.user_handle
    ? `@${message.user_handle}${message.user_role && message.user_role !== "user" ? ` · ${message.user_role}` : ""}`
    : "guest";

  async function copyEmail() {
    if (!replyEmail) return;
    try {
      await navigator.clipboard.writeText(replyEmail);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      /* ignore */
    }
  }

  return (
    <article className="rounded-[1.25rem] border border-border bg-surface-raised p-5 sm:p-6">
      <header className="flex items-start gap-3">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-extrabold text-black"
          aria-hidden
        >
          {initialOf(from)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-base font-extrabold tracking-tight text-text">{from}</h3>
              <p className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted">
                {account}
                {message.user_created_at
                  ? ` · joined ${new Date(message.user_created_at).toLocaleDateString(undefined, {
                      month: "short",
                      year: "numeric",
                    })}`
                  : ""}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-accent">{message.status}</p>
              <time
                dateTime={message.created_at}
                title={exactTime(message.created_at)}
                className="mt-0.5 block font-mono text-[10px] tabular-nums text-text-muted"
              >
                {relativeTime(message.created_at)}
              </time>
            </div>
          </div>
        </div>
      </header>

      <p className="mt-4 text-[15px] font-medium leading-relaxed tracking-[-0.02em] text-text whitespace-pre-wrap sm:text-base">
        {message.message}
      </p>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-muted">Email</dt>
          <dd className="mt-0.5 truncate text-sm text-text">
            {replyEmail ? (
              <button type="button" onClick={copyEmail} className="hover:text-accent">
                {copied ? "Copied" : replyEmail}
              </button>
            ) : (
              <span className="text-text-muted">None</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-muted">Sent</dt>
          <dd className="mt-0.5 text-sm text-text">{exactTime(message.created_at)}</dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-muted">Length</dt>
          <dd className="mt-0.5 text-sm text-text">
            {words} words · {message.message.length} chars
          </dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-muted">Id</dt>
          <dd className="mt-0.5 truncate font-mono text-xs text-text-muted" title={message.id}>
            {message.id.slice(0, 10)}
          </dd>
        </div>
      </dl>

      <footer className="mt-5 flex flex-wrap items-center gap-2">
        {replyEmail && (
          <a
            href={`mailto:${replyEmail}?subject=${encodeURIComponent("Re: your message to Secretlink")}`}
            className="inline-flex h-10 items-center rounded-full bg-accent px-4 text-xs font-extrabold text-black hover:bg-accent-soft"
          >
            Reply
          </a>
        )}
        {message.status !== "read" && (
          <Form method="post">
            <input type="hidden" name="messageId" value={message.id} />
            <input type="hidden" name="status" value="read" />
            <button type="submit" disabled={isActioning} className={ghostBtn}>
              Mark read
            </button>
          </Form>
        )}
        {message.status !== "archived" && (
          <Form method="post">
            <input type="hidden" name="messageId" value={message.id} />
            <input type="hidden" name="status" value="archived" />
            <button type="submit" disabled={isActioning} className={ghostBtn}>
              Archive
            </button>
          </Form>
        )}
        {message.status === "archived" && (
          <Form method="post">
            <input type="hidden" name="messageId" value={message.id} />
            <input type="hidden" name="status" value="new" />
            <button type="submit" disabled={isActioning} className={ghostBtn}>
              Restore
            </button>
          </Form>
        )}
      </footer>
    </article>
  );
}
