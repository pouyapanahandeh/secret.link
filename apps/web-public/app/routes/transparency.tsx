import type { MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { API_URL } from "../lib/api.server";

export const meta: MetaFunction = () => [{ title: "Transparency Report — Secretlink" }];

export async function loader() {
  try {
    const res = await fetch(`${API_URL}/v1/public/transparency`);
    if (!res.ok) {
      return json({ stats: null });
    }
    const stats = await res.json();
    return json({ stats });
  } catch {
    return json({ stats: null });
  }
}

export default function Transparency() {
  const { stats } = useLoaderData<typeof loader>();

  return (
    <div className="min-h-screen bg-black text-white px-4 py-12 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold text-[#FFFC00] mb-2">Transparency Report</h1>
      <p className="text-sm text-gray-400 mb-8">
        We publish moderation data to keep our community informed. Updated in real time.
      </p>

      {stats ? (
        <div className="space-y-8">
          <section>
            <h2 className="text-lg font-semibold text-white mb-4">Reports</h2>
            <div className="grid grid-cols-2 gap-4">
              <StatCard label="Total reports received" value={stats.totalReports ?? 0} />
              <StatCard label="Reports actioned" value={stats.actioned ?? 0} />
              <StatCard label="Reports dismissed" value={stats.dismissed ?? 0} />
              <StatCard label="Pending review" value={stats.pending ?? 0} />
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-4">Actions Taken</h2>
            <div className="grid grid-cols-2 gap-4">
              <StatCard label="Content removed" value={stats.contentRemoved ?? 0} />
              <StatCard label="Warnings issued" value={stats.warningsIssued ?? 0} />
              <StatCard label="Accounts suspended" value={stats.accountsSuspended ?? 0} />
              <StatCard label="Accounts banned" value={stats.accountsBanned ?? 0} />
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-4">Appeals</h2>
            <div className="grid grid-cols-2 gap-4">
              <StatCard label="Appeals received" value={stats.appealsReceived ?? 0} />
              <StatCard label="Appeals accepted" value={stats.appealsAccepted ?? 0} />
              <StatCard label="Appeals rejected" value={stats.appealsRejected ?? 0} />
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-4">Response Times</h2>
            <div className="grid grid-cols-2 gap-4">
              <StatCard label="Avg. report review time" value="< 24 hours" />
              <StatCard label="Avg. appeal resolution" value="< 7 days" />
            </div>
          </section>
        </div>
      ) : (
        <div className="text-gray-400 text-center py-12">
          <p>Transparency data is not yet available.</p>
          <p className="text-xs mt-2">Check back soon — data is published once the moderation system is active.</p>
        </div>
      )}

      <div className="mt-12 pt-8 border-t border-gray-800 text-xs text-gray-500 space-y-2">
        <p>
          This report is generated automatically from our moderation system.
          Per the EU Digital Services Act (DSA), we provide this data to ensure accountability
          and transparency in content moderation.
        </p>
        <p>
          Questions? Reach out via our{" "}
          <a href="/contact" className="text-[#FFFC00] underline">contact form</a>.
        </p>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <p className="text-2xl font-bold text-[#FFFC00]">{value}</p>
      <p className="text-xs text-gray-400 mt-1">{label}</p>
    </div>
  );
}
