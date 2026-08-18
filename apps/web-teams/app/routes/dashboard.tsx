import type { MetaFunction, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";

export const meta: MetaFunction = () => [
  { title: "Dashboard - Secret.link for Teams" },
  { name: "description", content: "Your team workspace dashboard." },
];

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const workspace = url.searchParams.get("workspace") ?? "my-team";

  return json({
    workspace,
    stats: {
      totalFeedback: 47,
      activeChannels: 3,
      gamesPlayed: 12,
      avgSafetyScore: 7.2,
    },
    recentFeedback: [
      { id: "1", channel: "eng-leadership", preview: "I feel like our sprint planning...", time: "2h ago", sentiment: "constructive" },
      { id: "2", channel: "general", preview: "The new onboarding buddy system is...", time: "5h ago", sentiment: "positive" },
      { id: "3", channel: "eng-leadership", preview: "Standups are too long...", time: "1d ago", sentiment: "constructive" },
    ],
  });
}

export default function Dashboard() {
  const { workspace, stats, recentFeedback } = useLoaderData<typeof loader>();

  return (
    <main className="min-h-screen bg-porcelain">
      <nav className="flex items-center justify-between px-6 py-4 bg-white border-b border-ink/5">
        <div className="flex items-center gap-4">
          <span className="text-lg font-semibold text-ink">
            Secret.link <span className="text-trust-blue">for Teams</span>
          </span>
          <span className="text-sm text-ink/40">/ {workspace}</span>
        </div>
        <div className="flex items-center gap-4">
          <a href="/dashboard/games" className="text-sm text-ink/60 hover:text-ink">Games</a>
          <a href="/dashboard/surveys" className="text-sm text-ink/60 hover:text-ink">Surveys</a>
          <a href="/dashboard/settings" className="text-sm text-ink/60 hover:text-ink">Settings</a>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-ink mb-8">Dashboard</h1>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-ink/5">
            <p className="text-sm text-ink/40 mb-1">Total feedback</p>
            <p className="text-3xl font-bold text-ink">{stats.totalFeedback}</p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-ink/5">
            <p className="text-sm text-ink/40 mb-1">Active channels</p>
            <p className="text-3xl font-bold text-ink">{stats.activeChannels}</p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-ink/5">
            <p className="text-sm text-ink/40 mb-1">Games played</p>
            <p className="text-3xl font-bold text-ink">{stats.gamesPlayed}</p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-ink/5">
            <p className="text-sm text-ink/40 mb-1">Safety score</p>
            <p className="text-3xl font-bold text-trust-blue">{stats.avgSafetyScore}/10</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Recent feedback */}
          <div>
            <h2 className="text-lg font-semibold text-ink mb-4">Recent feedback</h2>
            <div className="bg-white rounded-xl shadow-sm border border-ink/5 divide-y divide-ink/5">
              {recentFeedback.map((item) => (
                <div key={item.id} className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-ink/40">{item.time}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-trust-blue/10 text-trust-blue">#{item.channel}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-warm-accent/10 text-warm-accent">{item.sentiment}</span>
                  </div>
                  <p className="text-sm text-ink/70">{item.preview}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Quick actions */}
          <div>
            <h2 className="text-lg font-semibold text-ink mb-4">Quick actions</h2>
            <div className="space-y-3">
              <a href="/dashboard/channels/new" className="block bg-white rounded-xl p-4 shadow-sm border border-ink/5 hover:border-trust-blue/30 transition-colors">
                <p className="font-medium text-ink mb-1">📨 Create feedback channel</p>
                <p className="text-sm text-ink/60">Set up an always-on anonymous inbox for your team</p>
              </a>
              <a href="/dashboard/surveys/new" className="block bg-white rounded-xl p-4 shadow-sm border border-ink/5 hover:border-trust-blue/30 transition-colors">
                <p className="font-medium text-ink mb-1">📊 Launch pulse survey</p>
                <p className="text-sm text-ink/60">Send a quick eNPS or safety check to your team</p>
              </a>
              <a href="/dashboard/games/new" className="block bg-white rounded-xl p-4 shadow-sm border border-ink/5 hover:border-trust-blue/30 transition-colors">
                <p className="font-medium text-ink mb-1">🎮 Start a team game</p>
                <p className="text-sm text-ink/60">Drop a game link in Slack - the team plays async</p>
              </a>
              <a href="/dashboard/invite" className="block bg-white rounded-xl p-4 shadow-sm border border-ink/5 hover:border-trust-blue/30 transition-colors">
                <p className="font-medium text-ink mb-1">👥 Invite team members</p>
                <p className="text-sm text-ink/60">Share a link or invite by email</p>
              </a>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
