import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Link, useRouteError, isRouteErrorResponse, type ClientLoaderFunctionArgs } from "@remix-run/react";
import { requireToken } from "../lib/session.server";
import { API_URL } from "../lib/api.server";
import { DashboardSkeleton, readDashboardTabFromHash } from "../components/DashboardSkeleton";
import { DashboardPage } from "../features/dashboard/DashboardPage";

export const meta: MetaFunction = () => [
  { title: "Dashboard - Secretlink.life" },
];

export async function action({ request }: ActionFunctionArgs) {
  const token = await requireToken(request);
  const form = await request.formData();
  const intent = form.get("intent");

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  switch (intent) {
    case "search": {
      const q = String(form.get("q") ?? "");
      const res = await fetch(`${API_URL}/v1/users/search?q=${encodeURIComponent(q)}`, { headers });
      return json(await res.json());
    }
    case "follow": {
      const targetId = String(form.get("targetId") ?? "");
      const res = await fetch(`${API_URL}/v1/users/follow/${targetId}`, { method: "POST", headers });
      return json(await res.json());
    }
    case "unfollow": {
      const targetId = String(form.get("targetId") ?? "");
      const res = await fetch(`${API_URL}/v1/users/follow/${targetId}`, { method: "DELETE", headers });
      return json(await res.json());
    }
    case "follow-status": {
      const targetId = String(form.get("targetId") ?? "");
      const res = await fetch(`${API_URL}/v1/users/follow/${targetId}`, { headers });
      return json(await res.json());
    }
    case "save-profile": {
      const bio = String(form.get("bio") ?? "");
      const socials = JSON.parse(String(form.get("socials") ?? "[]"));
      const avatarUrlRaw = form.get("avatarUrl");
      const avatarUrl =
        avatarUrlRaw === null || avatarUrlRaw === undefined
          ? undefined
          : String(avatarUrlRaw);
      const res = await fetch(`${API_URL}/v1/users/me/profile`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          bio,
          socials,
          ...(avatarUrl !== undefined ? { avatarUrl: avatarUrl || null } : {}),
        }),
      });
      return json(await res.json());
    }
    case "passkey-register-options": {
      const res = await fetch(`${API_URL}/v1/users/me/passkey/register-options`, { method: "POST", headers });
      return json(await res.json());
    }
    case "passkey-register-verify": {
      const credential = String(form.get("credential") ?? "");
      const res = await fetch(`${API_URL}/v1/users/me/passkey/register-verify`, {
        method: "POST",
        headers,
        body: credential,
      });
      return json(await res.json());
    }
    case "stream-ticket": {
      const conversationId = String(form.get("conversationId") ?? "");
      const res = await fetch(`${API_URL}/v1/dms/stream-ticket`, {
        method: "POST",
        headers,
        body: JSON.stringify({ conversationId }),
      });
      return json(await res.json());
    }
    case "get-api-token": {
      const res = await fetch(`${API_URL}/v1/users/auth/session-token`, { method: "POST", headers });
      if (!res.ok) return json({ error: "token_exchange_failed" }, { status: 502 });
      return json(await res.json());
    }
    default:
      return json({ error: "unknown_intent" }, { status: 400 });
  }
}

export async function loader({ request }: LoaderFunctionArgs) {
  const token = await requireToken(request);

  const profileRes = await fetch(`${API_URL}/v1/users/me/profile`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!profileRes.ok) {
    return redirect("/login");
  }

  const user = await profileRes.json();

  const inboxRes = await fetch(`${API_URL}/v1/secrets/inbox/${user.handle}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const inbox = inboxRes.ok ? await inboxRes.json() : [];

  const sentRes = await fetch(`${API_URL}/v1/secrets/sent/${user.id}?limit=10&offset=0`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  let sent: unknown[] = [];
  let sentHasMore = false;
  let sentNextOffset = 0;
  if (sentRes.ok) {
    const sentBody = await sentRes.json();
    if (Array.isArray(sentBody)) {
      sent = sentBody;
    } else {
      sent = Array.isArray(sentBody.items) ? sentBody.items : [];
      sentHasMore = !!sentBody.hasMore;
      sentNextOffset = Number(sentBody.nextOffset ?? sent.length);
    }
  }

  const followingRes = await fetch(`${API_URL}/v1/users/me/following`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const following = followingRes.ok ? await followingRes.json() : [];

  const chatsRes = await fetch(`${API_URL}/v1/chats/mine`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const activeChats = chatsRes.ok
    ? ((await chatsRes.json()) as { items?: unknown[] }).items ?? []
    : [];

  const mapRes = await fetch(`${API_URL}/v1/secrets/map`);
  const mapSecrets = mapRes.ok ? await mapRes.json() : [];
  const storyHandles: string[] = Array.from(
    new Set(
      (mapSecrets as Array<{ handle?: string }>)
        .map((m) => (m.handle ?? "").replace(/^@/, "").toLowerCase())
        .filter(Boolean),
    ),
  );
  const storyIdsByHandle: Record<string, string[]> = {};
  for (const m of mapSecrets as Array<{ id?: string; handle?: string }>) {
    const h = (m.handle ?? "").replace(/^@/, "").toLowerCase();
    if (!h || !m.id) continue;
    (storyIdsByHandle[h] ??= []).push(String(m.id));
  }

  return json({ user, inbox, sent, sentHasMore, sentNextOffset, activeChats, token, following, storyHandles, storyIdsByHandle, mapSecrets });
}

export async function clientLoader({ serverLoader }: ClientLoaderFunctionArgs) {
  return serverLoader<typeof loader>();
}
clientLoader.hydrate = true;

export function HydrateFallback() {
  return <DashboardSkeleton tab={readDashboardTabFromHash()} />;
}

export default DashboardPage;

export function ErrorBoundary() {
  const error = useRouteError();
  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-surface">
      <div className="text-center max-w-md">
        <h1 className="text-2xl font-bold mb-2">
          {isRouteErrorResponse(error) ? `${error.status} - ${error.statusText}` : "Dashboard Error"}
        </h1>
        <p className="text-text-muted mb-6">
          {isRouteErrorResponse(error) ? error.data : "Something went wrong loading your dashboard."}
        </p>
        <Link to="/login" className="rounded-full bg-accent px-6 py-2.5 text-sm font-bold text-black">
          Back to login
        </Link>
      </div>
    </main>
  );
}
