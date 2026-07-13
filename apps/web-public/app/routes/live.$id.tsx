import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { useState, useEffect } from "react";
import { API_URL } from "../lib/api.server";
import { UI_FEATURES } from "../lib/feature-flags";

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  const title = data?.stream?.title
    ? `${data.stream.title} — @${data.stream.handle} Live`
    : "Live Stream — Secretlink";
  return [{ title }, { name: "description", content: "Watch a live stream on Secretlink" }];
};

export async function loader({ params }: LoaderFunctionArgs) {
  if (!UI_FEATURES.live) {
    return redirect("/dashboard");
  }
  const id = params["id"];
  const res = await fetch(`${API_URL}/v1/streams/${id}`);
  if (!res.ok) return json({ stream: null }, { status: 404 });
  const stream = await res.json();
  return json({ stream });
}

export default function LiveStreamPage() {
  const { stream } = useLoaderData<typeof loader>();
  const [nsfwAccepted, setNsfwAccepted] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [full, setFull] = useState(false);

  // Prevent hydration mismatch: only render the player on the client
  useEffect(() => { setMounted(true); }, []);

  // Check if stream is full (max_viewers reached)
  useEffect(() => {
    if (!stream || stream.status !== "live") return;
    if (stream.maxViewers > 0 && stream.viewerCount >= stream.maxViewers) {
      setFull(true);
    }
  }, [stream]);

  if (!stream) {
    return (
      <main className="min-h-screen bg-surface flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Stream not found</h1>
          <p className="text-text-muted">This stream may have ended or doesn't exist.</p>
        </div>
      </main>
    );
  }

  if (stream.status === "ended") {
    return (
      <main className="min-h-screen bg-surface flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Stream ended</h1>
          <p className="text-text-muted">@{stream.handle}'s live stream has ended.</p>
        </div>
      </main>
    );
  }

  // NSFW gate
  if (stream.nsfw && !nsfwAccepted) {
    return (
      <main className="min-h-screen bg-surface flex items-center justify-center px-4">
        <div className="max-w-sm w-full text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center">
            <span className="text-2xl">🔞</span>
          </div>
          <h1 className="text-xl font-bold">Adult Content</h1>
          <p className="text-sm text-text-muted">
            @{stream.handle} marked this stream as 18+ content.
          </p>
          <button
            onClick={() => setNsfwAccepted(true)}
            className="w-full rounded-xl bg-accent px-5 py-3 text-sm font-bold text-black"
          >
            I'm 18+ — Continue
          </button>
        </div>
      </main>
    );
  }

  // Stream full
  if (full) {
    return (
      <main className="min-h-screen bg-surface flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-xl font-bold mb-2">Stream is full</h1>
          <p className="text-text-muted text-sm">
            This stream is limited to {stream.maxViewers} viewer{stream.maxViewers === 1 ? "" : "s"}.
          </p>
        </div>
      </main>
    );
  }

  // Waiting for client mount to avoid hydration mismatch
  if (!mounted) {
    return (
      <main className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-accent" />
      </main>
    );
  }

  // Playing state — show stream (client-only to avoid hydration issues with IVS player)
  return <ClientStreamPlayer stream={stream} />;
}

/** Client-only stream player wrapper — avoids SSR hydration issues with IVS SDK */
function ClientStreamPlayer({ stream }: { stream: any }) {
  const [Player, setPlayer] = useState<any>(null);

  useEffect(() => {
    import("../components/StreamPlayer").then((mod) => {
      setPlayer(() => mod.StreamPlayer);
    });
  }, []);

  if (!Player) {
    return (
      <main className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-accent" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black relative">
      <Player
        playbackUrl={stream.playbackUrl}
        title={stream.title}
        handle={stream.handle}
        viewerCount={stream.viewerCount}
        streamId={stream.id}
        inline={false}
      />
    </main>
  );
}
