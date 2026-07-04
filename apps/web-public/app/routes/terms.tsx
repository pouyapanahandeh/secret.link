import type { MetaFunction } from "@remix-run/node";

export const meta: MetaFunction = () => [{ title: "Terms of Service — Secretlink" }];

export default function Terms() {
  return (
    <div className="min-h-screen bg-black text-white px-4 py-12 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold text-[#FFFC00] mb-2">Terms of Service</h1>
      <p className="text-sm text-gray-400 mb-8">Last updated: June 2026</p>

      <div className="space-y-8 text-gray-300 text-sm leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-white mb-2">1. Acceptance</h2>
          <p>
            By creating an account or using Secretlink, you agree to these Terms. If you do not agree,
            do not use the service.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-2">2. The Service</h2>
          <p>
            Secretlink allows users to share ephemeral, location-based secrets on a map and send
            end-to-end encrypted messages. Secrets automatically expire based on their time-to-live (TTL)
            setting. We do not guarantee permanent storage of any content.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-2">3. Account</h2>
          <ul className="list-disc list-inside space-y-1">
            <li>You must be at least 16 years old to use Secretlink</li>
            <li>Your handle must not impersonate another person or entity</li>
            <li>You are responsible for securing your passkey/device</li>
            <li>One person, one account (no duplicate accounts for ban evasion)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-2">4. Acceptable Use</h2>
          <p>You agree NOT to use Secretlink to:</p>
          <ul className="list-disc list-inside space-y-1 mt-2">
            <li>Post illegal content (child exploitation, terrorism, incitement to violence)</li>
            <li>Harass, bully, or threaten other users</li>
            <li>Share non-consensual intimate images</li>
            <li>Spam, scam, or phish</li>
            <li>Distribute malware or exploit the service</li>
            <li>Circumvent rate limits, bans, or security measures</li>
            <li>Share content that violates intellectual property rights</li>
          </ul>
          <p className="mt-2">
            Full details are in our <a href="/community-guidelines" className="text-[#FFFC00] underline">Community Guidelines</a>.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-2">5. Content & Moderation</h2>
          <ul className="list-disc list-inside space-y-1">
            <li>You retain ownership of content you post</li>
            <li>By posting, you grant us a license to display and distribute it on the platform</li>
            <li>We may remove content that violates these terms or our community guidelines</li>
            <li>We notify you when content is removed and provide a reason</li>
            <li>You may appeal moderation decisions through our appeals process</li>
            <li>Repeated violations may result in temporary suspension or permanent ban</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-2">6. Enforcement Ladder</h2>
          <table className="w-full text-xs border border-gray-700 rounded-lg overflow-hidden">
            <thead className="bg-gray-900">
              <tr>
                <th className="text-left p-2 border-b border-gray-700">Level</th>
                <th className="text-left p-2 border-b border-gray-700">Action</th>
                <th className="text-left p-2 border-b border-gray-700">Duration</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-800">
                <td className="p-2">1st violation</td>
                <td className="p-2">Content removed + warning</td>
                <td className="p-2">—</td>
              </tr>
              <tr className="border-b border-gray-800">
                <td className="p-2">2nd violation</td>
                <td className="p-2">Temporary suspension</td>
                <td className="p-2">7 days</td>
              </tr>
              <tr className="border-b border-gray-800">
                <td className="p-2">3rd violation</td>
                <td className="p-2">Temporary suspension</td>
                <td className="p-2">30 days</td>
              </tr>
              <tr>
                <td className="p-2">Severe / repeat</td>
                <td className="p-2">Permanent ban</td>
                <td className="p-2">Indefinite</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-2">7. Encryption & Privacy</h2>
          <p>
            Direct messages are end-to-end encrypted. We cannot read their contents.
            See our <a href="/privacy" className="text-[#FFFC00] underline">Privacy Policy</a> for
            full details on data handling.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-2">8. Limitation of Liability</h2>
          <p>
            Secretlink is provided "as-is". We are not liable for content posted by users, data loss
            due to secret expiration (by design), or service interruptions. Our total liability is limited
            to the amount you paid us (if any) in the preceding 12 months.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-2">9. Termination</h2>
          <p>
            You may delete your account at any time (Settings → Delete account).
            We may suspend or terminate accounts that violate these terms.
            Upon termination, your data will be deleted per our retention policy.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-2">10. Governing Law</h2>
          <p>
            These terms are governed by the laws of the European Union. Disputes will be resolved
            in the courts of the Netherlands, or through the EU Online Dispute Resolution platform.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-2">11. Changes</h2>
          <p>
            We may update these terms. Material changes will be communicated 30 days in advance.
            Continued use after changes take effect constitutes acceptance.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-2">12. Contact</h2>
          <p>
            Questions about these terms? Reach out via our{" "}
            <a href="/contact" className="text-[#FFFC00] underline">contact form</a>.
          </p>
        </section>
      </div>
    </div>
  );
}
