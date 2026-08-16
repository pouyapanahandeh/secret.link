import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { SiteChrome } from "../components/SiteChrome";
import { getToken } from "../lib/session.server";

export const meta: MetaFunction = () => [
  { title: "Privacy Policy — Secretlink.life" },
  {
    name: "description",
    content: "Privacy Policy for Secretlink.life — how we handle your data, encryption, age restrictions, and user responsibilities.",
  },
];

export async function loader({ request }: LoaderFunctionArgs) {
  const token = await getToken(request);
  return json({ isLoggedIn: Boolean(token) });
}

export default function Privacy() {
  const { isLoggedIn } = useLoaderData<typeof loader>();

  return (
    <SiteChrome isLoggedIn={isLoggedIn} currentPath="/privacy">
      <article className="mx-auto max-w-3xl px-4 sm:px-6 pt-28 sm:pt-32 pb-20">
        <p className="text-[11px] font-semibold tracking-[0.28em] uppercase text-accent mb-4">Legal</p>
        <h1 className="font-extrabold tracking-[-0.04em] text-4xl sm:text-6xl leading-[0.95] mb-3">
          Privacy <span className="font-display font-bold text-accent">Policy</span>
        </h1>
        <p className="font-mono text-[11px] tracking-wide uppercase text-text-muted mb-10">Last updated: June 13, 2026</p>

        <section className="mb-8">
          <h2 className="text-xl font-extrabold tracking-tight mb-3">1. Introduction</h2>
          <p className="text-text leading-relaxed">
            Secretlink.life ("we", "us", "the Platform") is an end-to-end encrypted, ephemeral messaging
            and secret-sharing platform. This Privacy Policy explains what data we collect, how we use it,
            and your rights as a user.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-extrabold tracking-tight mb-3">2. Age Restriction</h2>
          <p className="text-text leading-relaxed mb-3">
            <strong className="text-accent">You must be at least 18 years old to use Secretlink.life.</strong>
          </p>
          <p className="text-text leading-relaxed mb-3">
            By accessing or using this Platform, you confirm that you are at least 18 years of age.
            If you are under 18, you are strictly prohibited from using this service. We do not
            knowingly collect or process data from anyone under 18. If we become aware that a user
            is under 18, we will terminate their account and delete all associated data immediately.
          </p>
          <p className="text-text leading-relaxed">
            Parents and guardians are responsible for monitoring their children's internet usage.
            We encourage use of parental control tools to restrict access to age-inappropriate platforms.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-extrabold tracking-tight mb-3">3. Data We Collect</h2>
          <p className="text-text leading-relaxed mb-3">We collect minimal data by design:</p>
          <ul className="list-disc list-inside space-y-2 text-text">
            <li><strong>Account data:</strong> Email address (for magic link authentication), chosen handle/username</li>
            <li><strong>Encrypted content:</strong> Messages and files are encrypted on your device before reaching our servers. We cannot read, access, or decrypt your content.</li>
            <li><strong>Metadata:</strong> Timestamps, approximate geolocation (for map secrets, if you choose to drop one), message expiry timers</li>
            <li><strong>Cryptographic keys:</strong> Public keys are stored on our server. Private keys never leave your device.</li>
            <li><strong>Technical data:</strong> IP address (for rate limiting and abuse prevention only, not stored long-term), browser type, device type</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-extrabold tracking-tight mb-3">4. What We Do NOT Collect</h2>
          <ul className="list-disc list-inside space-y-2 text-text">
            <li>We do not read or store plaintext message content</li>
            <li>We do not use tracking cookies or third-party analytics</li>
            <li>We do not sell, rent, or share your data with advertisers</li>
            <li>We do not build behavioral profiles or run targeted advertising</li>
            <li>We do not store messages after they have been viewed and expired</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-extrabold tracking-tight mb-3">5. End-to-End Encryption</h2>
          <p className="text-text leading-relaxed mb-3">
            All direct messages are encrypted using X25519 ECDH key exchange and AES-GCM encryption.
            Encryption and decryption happen entirely on your device. Our servers relay ciphertext only —
            we have zero ability to read your messages.
          </p>
          <p className="text-text leading-relaxed">
            Anonymous secrets (one-time links) are encrypted with XChaCha20-Poly1305 on your device.
            The decryption key is embedded in the URL fragment, which is never sent to our servers.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-extrabold tracking-tight mb-3">6. Data Retention & Self-Destruction</h2>
          <ul className="list-disc list-inside space-y-2 text-text">
            <li>Secrets with one-time links are permanently deleted after being viewed (or after their TTL expires, whichever comes first)</li>
            <li>Map secrets expire and are automatically deleted after their configured timer</li>
            <li>Direct messages expire based on the TTL set by the sender</li>
            <li>We routinely purge expired encrypted blobs from our storage</li>
            <li>Account deletion removes all associated data permanently</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-extrabold tracking-tight mb-3">7. User-Generated Content & Responsibility</h2>
          <p className="text-text leading-relaxed mb-3">
            <strong className="text-accent">Secretlink.life is a neutral transmission platform.</strong> Because all content
            is end-to-end encrypted, we cannot monitor, moderate, filter, or screen user-generated content
            before or during transmission.
          </p>
          <p className="text-text leading-relaxed mb-3">
            Users are solely and entirely responsible for the content they create, send, share, or
            distribute through this Platform. This includes but is not limited to:
          </p>
          <ul className="list-disc list-inside space-y-2 text-text mb-3">
            <li>Text messages, images, videos, and files of any nature</li>
            <li>Content that may be sexually explicit, adult-oriented, or otherwise intended for mature audiences</li>
            <li>Content shared via direct messages, secret links, or map drops</li>
          </ul>
          <p className="text-text leading-relaxed mb-3">
            <strong>By using this Platform, you acknowledge and agree that:</strong>
          </p>
          <ul className="list-disc list-inside space-y-2 text-text">
            <li>You are at least 18 years old</li>
            <li>You bear full legal responsibility for any content you send or share</li>
            <li>You will not use the Platform to distribute illegal content including, but not limited to: child sexual abuse material (CSAM), non-consensual intimate imagery, content that violates any applicable law</li>
            <li>You consent to receiving content from other users that may be explicit or adult in nature</li>
            <li>Secretlink.life bears no responsibility for content transmitted between users</li>
            <li>You will not send unsolicited explicit content to individuals who have not consented to receive it</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-extrabold tracking-tight mb-3">8. Prohibited Content</h2>
          <p className="text-text leading-relaxed mb-3">
            While we cannot proactively monitor encrypted content, the following is strictly prohibited
            and may result in account termination and referral to law enforcement:
          </p>
          <ul className="list-disc list-inside space-y-2 text-text">
            <li>Child sexual abuse material (CSAM) or any exploitation of minors</li>
            <li>Non-consensual intimate or sexual imagery ("revenge porn")</li>
            <li>Content that facilitates terrorism, violence, or human trafficking</li>
            <li>Distribution of malware or tools designed for unauthorized access</li>
            <li>Content that violates applicable local, national, or international laws</li>
          </ul>
          <p className="text-text leading-relaxed mt-3">
            We cooperate with law enforcement agencies when required by valid legal process.
            Users can report content or accounts via our reporting mechanism.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-extrabold tracking-tight mb-3">9. Limitation of Liability</h2>
          <p className="text-text leading-relaxed mb-3">
            To the fullest extent permitted by law, Secretlink.life, its operators, developers,
            and affiliates shall not be held liable for:
          </p>
          <ul className="list-disc list-inside space-y-2 text-text">
            <li>Any content created, sent, or received by users through the Platform</li>
            <li>Any emotional, psychological, or material damage resulting from content received via the Platform</li>
            <li>Any illegal use of the Platform by its users</li>
            <li>The actions or conduct of any user on or off the Platform</li>
            <li>Any data loss resulting from the ephemeral nature of the service (secrets are designed to disappear)</li>
          </ul>
          <p className="text-text leading-relaxed mt-3">
            The Platform is provided "as is" without warranties of any kind.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-extrabold tracking-tight mb-3">10. Cookies & Local Storage</h2>
          <p className="text-text leading-relaxed">
            We use an encrypted session cookie (<code className="text-accent/80">sl_session</code>) to maintain
            your login on the web. The API may also set a separate HttpOnly JWT cookie (<code className="text-accent/80">sl_token</code>) during signup.
            Read our <Link to="/security" className="text-accent hover:underline">security overview</Link> for details.
            We use IndexedDB (browser local storage) to store your cryptographic
            private keys — these never leave your device. We do not use third-party cookies,
            tracking pixels, or advertising identifiers.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-extrabold tracking-tight mb-3">11. Third-Party Services</h2>
          <ul className="list-disc list-inside space-y-2 text-text">
            <li><strong>AWS SES:</strong> Used to send transactional emails (magic link login). Your email address is processed by Amazon Web Services for delivery purposes only.</li>
            <li><strong>Hosting:</strong> Our servers are hosted on AWS EC2 (EU region). Encrypted data at rest resides within the EU.</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-extrabold tracking-tight mb-3">12. Your Rights</h2>
          <p className="text-text leading-relaxed mb-3">You have the right to:</p>
          <ul className="list-disc list-inside space-y-2 text-text">
            <li><strong>Access:</strong> Request a copy of the personal data we hold about you (limited to email and handle)</li>
            <li><strong>Deletion:</strong> Request complete deletion of your account and all associated data</li>
            <li><strong>Portability:</strong> Due to the ephemeral, encrypted nature of our service, data portability is inherently limited</li>
            <li><strong>Withdraw consent:</strong> You may stop using the service and delete your account at any time</li>
          </ul>
          <p className="text-text leading-relaxed mt-3">
            To exercise these rights, reach out via our <Link to="/contact" className="text-accent hover:underline">contact form</Link>.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-extrabold tracking-tight mb-3">13. Changes to This Policy</h2>
          <p className="text-text leading-relaxed">
            We may update this Privacy Policy from time to time. Significant changes will be communicated
            via the Platform. Continued use of the service after changes constitutes acceptance of the
            updated policy.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-extrabold tracking-tight mb-3">14. Contact</h2>
          <p className="text-text leading-relaxed">
            For privacy-related inquiries, use our <Link to="/contact" className="text-accent hover:underline">contact form</Link>.
          </p>
        </section>

        <footer className="border-t border-border pt-8">
          <Link to="/contact" className="text-sm text-accent hover:underline">Contact us</Link>
        </footer>
      </article>
    </SiteChrome>
  );
}
