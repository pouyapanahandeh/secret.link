import type { MetaFunction, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useSearchParams } from "@remix-run/react";
import { ThemeToggle } from "../components/ThemeToggle";
import { MessagingPanel } from "../components/MessagingPanel";
import { requireToken } from "../lib/session.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const token = await requireToken(request);
  return json({ token });
}

export const meta: MetaFunction = () => [
  { title: "Messages — Secretlink.life" },
];

export default function MessagesPage() {
  const { token } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const isEmbed = searchParams.get("embed") === "1";
  const toHandle = searchParams.get("to") ?? undefined;

  return (
    <main className="h-screen flex flex-col bg-surface">
      {/* Nav — hidden when embedded */}
      {!isEmbed && (
        <nav className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-border/50 z-20">
          <a href="/" className="flex items-center gap-2">
            <img src="/secretlink.png" alt="" className="w-7 h-7" />
            <span className="text-lg font-bold tracking-tight">
              secretlink<span className="text-accent">.</span>life
            </span>
          </a>
          <div className="flex items-center gap-3">
            <a href="/dashboard" className="text-sm text-text-muted hover:text-text">Dashboard</a>
            <ThemeToggle />
          </div>
        </nav>
      )}

      <MessagingPanel token={token} toHandle={toHandle} />
    </main>
  );
}
