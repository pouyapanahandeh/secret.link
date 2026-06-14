import type { MetaFunction } from "@remix-run/node";

export const meta: MetaFunction = () => [
  { title: "Privacy Policy — Secretlink.life" },
  {
    name: "description",
    content: "Privacy Policy for Secretlink.life — how we handle your data, encryption, age restrictions, and user responsibilities.",
  },
];

export default function Privacy() {
  return (
    <main className="flex min-h-screen flex-col items-center py-16 px-4">
      <article className="max-w-2xl w-full prose-invert">
        <img src="/secretlink.png" alt="Secretlink.life" className="w-12 h-12 mb-4" />
        <h1 className="font-display text-4xl mb-2">Privacy Policy</h1>
        <p className="text-candle/50 text-sm mb-8">Last updated: June 13, 2026</p>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-blush mb-3">1. Introduction</h2>
          <p className="text-candle/80 leading-relaxed">
            Secretlink.life ("we", "us", "the Platform") is an end-to-end encrypted, ephemeral messaging
            and secret-sharing platform. This Privacy Policy explains what data we collect, how we use it,
            and your rights as a user.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-blush mb-3">2. Age Restriction</h2>
          <p className="text-candle/80 leading-relaxed mb-3">
            <strong className="text-blush">You must be at least 18 years old to use Secretlink.life.</strong>
          </p>
          <p className="text-candle/80 leading-relaxed mb-3">
            By accessing or using this Platform, you confirm that you are at least 18 years of age.
            If you are under 18, you are strictly prohibited from using this service. We do not
            knowingly collect or process data from anyone under 18. If we become aware that a user
            is under 18, we will terminate their account and delete all associated data immediately.
          </p>
          <p className="text-candle/80 leading-relaxed">
            Parents and guardians are responsible for monitoring their children's internet usage.
            We encourage use of parental control tools to restrict access to age-inappropriate platforms.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-blush mb-3">3. Data We Collect</h2>
          <p className="text-candle/80 leading-relaxed mb-3">We collect minimal data by design:</p>
          <ul className="list-disc list-inside space-y-2 text-candle/80">
            <li><strong>Account data:</strong> Email address (for magic link authentication), chosen handle/username</li>
            <li><strong>Encrypted content:</strong> Messages and files are encrypted on your device before reaching our servers. We cannot read, access, or decrypt your content.</li>
            <li><strong>Metadata:</strong> Timestamps, approximate geolocation (for map secrets, if you choose to drop one), message expiry timers</li>
            <li><strong>Cryptographic keys:</strong> Public keys are stored on our server. Private keys never leave your device.</li>
            <li><strong>Technical data:</strong> IP address (for rate limiting and abuse prevention only, not stored long-term), browser type, device type</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-blush mb-3">4. What We Do NOT Collect</h2>
          <ul className="list-disc list-inside space-y-2 text-candle/80">
            <li>We do not read or store plaintext message content</li>
            <li>We do not use tracking cookies or third-party analytics</li>
            <li>We do not sell, rent, or share your data with advertisers</li>
            <li>We do not build behavioral profiles or run targeted advertising</li>
            <li>We do not store messages after they have been viewed and expired</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-blush mb-3">5. End-to-End Encryption</h2>
          <p className="text-candle/80 leading-relaxed mb-3">
            All direct messages are encrypted using X25519 ECDH key exchange and AES-GCM encryption.
            Encryption and decryption happen entirely on your device. Our servers relay ciphertext only —
            we have zero ability to read your messages.
          </p>
          <p className="text-candle/80 leading-relaxed">
            Anonymous secrets (one-time links) are encrypted with XChaCha20-Poly1305 on your device.
            The decryption key is embedded in the URL fragment, which is never sent to our servers.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-blush mb-3">6. Data Retention & Self-Destruction</h2>
          <ul className="list-disc list-inside space-y-2 text-candle/80">
            <li>Secrets with one-time links are permanently deleted after being viewed (or after their TTL expires, whichever comes first)</li>
            <li>Map secrets expire and are automatically deleted after their configured timer</li>
            <li>Direct messages expire based on the TTL set by the sender</li>
            <li>We routinely purge expired encrypted blobs from our storage</li>
            <li>Account deletion removes all associated data permanently</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-blush mb-3">7. User-Generated Content & Responsibility</h2>
          <p className="text-candle/80 leading-relaxed mb-3">
            <strong className="text-blush">Secretlink.life is a neutral transmission platform.</strong> Because all content
            is end-to-end encrypted, we cannot monitor, moderate, filter, or screen user-generated content
            before or during transmission.
          </p>
          <p className="text-candle/80 leading-relaxed mb-3">
            Users are solely and entirely responsible for the content they create, send, share, or
            distribute through this Platform. This includes but is not limited to:
          </p>
          <ul className="list-disc list-inside space-y-2 text-candle/80 mb-3">
            <li>Text messages, images, videos, and files of any nature</li>
            <li>Content that may be sexually explicit, adult-oriented, or otherwise intended for mature audiences</li>
            <li>Content shared via direct messages, secret links, or map drops</li>
          </ul>
          <p className="text-candle/80 leading-relaxed mb-3">
            <strong>By using this Platform, you acknowledge and agree that:</strong>
          </p>
          <ul className="list-disc list-inside space-y-2 text-candle/80">
            <li>You are at least 18 years old</li>
            <li>You bear full legal responsibility for any content you send or share</li>
            <li>You will not use the Platform to distribute illegal content including, but not limited to: child sexual abuse material (CSAM), non-consensual intimate imagery, content that violates any applicable law</li>
            <li>You consent to receiving content from other users that may be explicit or adult in nature</li>
            <li>Secretlink.life bears no responsibility for content transmitted between users</li>
            <li>You will not send unsolicited explicit content to individuals who have not consented to receive it</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-blush mb-3">8. Prohibited Content</h2>
          <p className="text-candle/80 leading-relaxed mb-3">
            While we cannot proactively monitor encrypted content, the following is strictly prohibited
            and may result in account termination and referral to law enforcement:
          </p>
          <ul className="list-disc list-inside space-y-2 text-candle/80">
            <li>Child sexual abuse material (CSAM) or any exploitation of minors</li>
            <li>Non-consensual intimate or sexual imagery ("revenge porn")</li>
            <li>Content that facilitates terrorism, violence, or human trafficking</li>
            <li>Distribution of malware or tools designed for unauthorized access</li>
            <li>Content that violates applicable local, national, or international laws</li>
          </ul>
          <p className="text-candle/80 leading-relaxed mt-3">
            We cooperate with law enforcement agencies when required by valid legal process.
            Users can report content or accounts via our reporting mechanism.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-blush mb-3">9. Limitation of Liability</h2>
          <p className="text-candle/80 leading-relaxed mb-3">
            To the fullest extent permitted by law, Secretlink.life, its operators, developers,
            and affiliates shall not be held liable for:
          </p>
          <ul className="list-disc list-inside space-y-2 text-candle/80">
            <li>Any content created, sent, or received by users through the Platform</li>
            <li>Any emotional, psychological, or material damage resulting from content received via the Platform</li>
            <li>Any illegal use of the Platform by its users</li>
            <li>The actions or conduct of any user on or off the Platform</li>
            <li>Any data loss resulting from the ephemeral nature of the service (secrets are designed to disappear)</li>
          </ul>
          <p className="text-candle/80 leading-relaxed mt-3">
            The Platform is provided "as is" without warranties of any kind.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-blush mb-3">10. Cookies & Local Storage</h2>
          <p className="text-candle/80 leading-relaxed">
            We use a single authentication cookie (<code className="text-blush/80">sl_token</code>) to maintain
            your login session. We use IndexedDB (browser local storage) to store your cryptographic
            private keys — these never leave your device. We do not use third-party cookies,
            tracking pixels, or advertising identifiers.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-blush mb-3">11. Third-Party Services</h2>
          <ul className="list-disc list-inside space-y-2 text-candle/80">
            <li><strong>AWS SES:</strong> Used to send transactional emails (magic link login). Your email address is processed by Amazon Web Services for delivery purposes only.</li>
            <li><strong>Hosting:</strong> Our servers are hosted on AWS EC2 (EU region). Encrypted data at rest resides within the EU.</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-blush mb-3">12. Your Rights</h2>
          <p className="text-candle/80 leading-relaxed mb-3">You have the right to:</p>
          <ul className="list-disc list-inside space-y-2 text-candle/80">
            <li><strong>Access:</strong> Request a copy of the personal data we hold about you (limited to email and handle)</li>
            <li><strong>Deletion:</strong> Request complete deletion of your account and all associated data</li>
            <li><strong>Portability:</strong> Due to the ephemeral, encrypted nature of our service, data portability is inherently limited</li>
            <li><strong>Withdraw consent:</strong> You may stop using the service and delete your account at any time</li>
          </ul>
          <p className="text-candle/80 leading-relaxed mt-3">
            To exercise these rights, contact us at <a href="mailto:privacy@secretlink.life" className="text-blush hover:underline">privacy@secretlink.life</a>.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-blush mb-3">13. Changes to This Policy</h2>
          <p className="text-candle/80 leading-relaxed">
            We may update this Privacy Policy from time to time. Significant changes will be communicated
            via the Platform. Continued use of the service after changes constitutes acceptance of the
            updated policy.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-blush mb-3">14. Contact</h2>
          <p className="text-candle/80 leading-relaxed">
            For privacy-related inquiries, contact us at{" "}
            <a href="mailto:privacy@secretlink.life" className="text-blush hover:underline">privacy@secretlink.life</a>.
          </p>
        </section>

        <footer className="border-t border-candle/10 pt-6 text-center">
          <a href="/" className="text-candle/40 text-sm hover:text-candle/60 transition-colors">
            ← Back to Secretlink.life
          </a>
        </footer>
      </article>
    </main>
  );
}
