import type { MetaFunction } from "@remix-run/node";

export const meta: MetaFunction = () => [{ title: "Community Guidelines — Secretlink" }];

export default function CommunityGuidelines() {
  return (
    <div className="min-h-screen bg-black text-white px-4 py-12 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold text-[#FFFC00] mb-2">Community Guidelines</h1>
      <p className="text-sm text-gray-400 mb-8">Last updated: June 2026</p>

      <div className="space-y-8 text-gray-300 text-sm leading-relaxed">
        <section>
          <p>
            Secretlink is built on ephemeral, location-based sharing. These guidelines ensure
            a safe experience for everyone. Violations are handled through our{" "}
            <a href="/terms" className="text-[#FFFC00] underline">enforcement ladder</a>.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-2">✅ Allowed</h2>
          <ul className="list-disc list-inside space-y-1">
            <li>Creative, fun, and harmless secrets</li>
            <li>Anonymous confessions and thoughts</li>
            <li>Location-based events and announcements</li>
            <li>Jokes, compliments, and positive vibes</li>
            <li>Encrypted DMs for private conversations</li>
            <li>Sharing art, poetry, and creative writing</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-2">🚫 Not Allowed</h2>

          <h3 className="text-sm font-semibold text-white mt-4 mb-1">Violence & Threats</h3>
          <ul className="list-disc list-inside space-y-1 text-gray-400">
            <li>Threats of physical violence or harm</li>
            <li>Incitement to violence against individuals or groups</li>
            <li>Glorification of terrorism or violent extremism</li>
          </ul>

          <h3 className="text-sm font-semibold text-white mt-4 mb-1">Harassment & Bullying</h3>
          <ul className="list-disc list-inside space-y-1 text-gray-400">
            <li>Targeted harassment of individuals</li>
            <li>Doxxing (sharing private information without consent)</li>
            <li>Coordinated attacks or pile-ons</li>
            <li>Stalking or unwanted persistent contact</li>
          </ul>

          <h3 className="text-sm font-semibold text-white mt-4 mb-1">Hate Speech</h3>
          <ul className="list-disc list-inside space-y-1 text-gray-400">
            <li>Content promoting hatred based on race, ethnicity, religion, gender, sexual orientation, disability, or nationality</li>
            <li>Dehumanizing language or slurs</li>
            <li>Holocaust denial or genocide denial</li>
          </ul>

          <h3 className="text-sm font-semibold text-white mt-4 mb-1">Sexual Content</h3>
          <ul className="list-disc list-inside space-y-1 text-gray-400">
            <li>Non-consensual intimate imagery (NCII)</li>
            <li>Child sexual abuse material (CSAM) — reported to authorities immediately</li>
            <li>Sexual solicitation of minors</li>
            <li>Unsolicited sexual content directed at other users</li>
          </ul>

          <h3 className="text-sm font-semibold text-white mt-4 mb-1">Illegal Content</h3>
          <ul className="list-disc list-inside space-y-1 text-gray-400">
            <li>Drug trafficking or sale</li>
            <li>Fraud, scams, or phishing</li>
            <li>Sale of stolen goods or data</li>
            <li>Content that violates applicable laws</li>
          </ul>

          <h3 className="text-sm font-semibold text-white mt-4 mb-1">Spam & Manipulation</h3>
          <ul className="list-disc list-inside space-y-1 text-gray-400">
            <li>Bulk posting of identical or near-identical content</li>
            <li>Bot accounts</li>
            <li>Misleading or deceptive content</li>
            <li>Impersonation of other users or public figures</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-2">🚩 Reporting</h2>
          <p>
            If you see content that violates these guidelines:
          </p>
          <ol className="list-decimal list-inside space-y-1 mt-2">
            <li>Tap on the secret to reveal it</li>
            <li>Tap "Report" and select a reason</li>
            <li>Optionally provide additional details</li>
            <li>Our moderation team will review within 24 hours</li>
          </ol>
          <p className="mt-2">
            You will be notified when your report is reviewed. False reports made in bad faith
            may result in action against the reporter.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-2">⚖️ Appeals</h2>
          <p>
            If your content was removed or your account was suspended, you can appeal:
          </p>
          <ul className="list-disc list-inside space-y-1 mt-2">
            <li>You will be notified with the reason for the action</li>
            <li>Click "Appeal" in the notification</li>
            <li>Explain why you believe the decision was incorrect</li>
            <li>Our team will review and respond within 7 days</li>
            <li>If reversed, your content/account will be restored</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-2">📈 Transparency</h2>
          <p>
            We publish regular transparency reports showing moderation statistics, including reports
            received, actions taken, and appeal outcomes. See our{" "}
            <a href="/transparency" className="text-[#FFFC00] underline">Transparency Report</a>.
          </p>
        </section>
      </div>
    </div>
  );
}
