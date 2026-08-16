import type { MetaFunction, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useSearchParams, Link } from "@remix-run/react";
import { ThemeToggle } from "../components/ThemeToggle";
import { MessagingPanel } from "../components/MessagingPanel";
import { requireToken } from "../lib/session.server";
import { UI_FEATURES } from "../lib/feature-flags";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireToken(request);
  if (!UI_FEATURES.messages) {
    return redirect("/dashboard");
  }
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
        <nav className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-border z-20">
          <Link to="/" className="flex items-center gap-2">
            <img src="/secretlink.png" alt="" className="w-8 h-8" />
            <span className="text-sm font-extrabold tracking-tight">
              secretlink<span className="text-accent">.</span>life
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="rounded-full bg-accent px-4 py-2 text-sm font-extrabold text-black hover:bg-accent-soft transition-colors">Dashboard</Link>
            <ThemeToggle />
          </div>
        </nav>
      )}

      <MessagingPanel token={token} toHandle={toHandle} />
    </main>
  );
}
