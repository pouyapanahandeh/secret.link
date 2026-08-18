import type { MetaFunction } from "@remix-run/node";

export const meta: MetaFunction = () => [
  { title: "Pricing - Secret.link for Teams" },
  { name: "description", content: "Free for up to 15 seats. Team plan from $4/user/mo. Business from $8/user/mo." },
];

export default function Pricing() {
  return (
    <main className="min-h-screen bg-porcelain">
      <nav className="flex items-center justify-between px-6 py-4 bg-white/80 backdrop-blur-sm border-b border-ink/5">
        <a href="/" className="text-xl font-semibold text-ink">
          Secret.link <span className="text-trust-blue">for Teams</span>
        </a>
        <a href="/signup" className="rounded-md bg-trust-blue px-4 py-2 text-sm font-semibold text-white hover:bg-trust-blue/90 transition-colors">
          Get started free
        </a>
      </nav>

      <section className="max-w-5xl mx-auto px-4 py-16">
        <h1 className="text-3xl font-bold text-ink text-center mb-4">Simple, honest pricing</h1>
        <p className="text-ink/60 text-center mb-12">No hidden fees. Cancel anytime.</p>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Free */}
          <div className="rounded-xl bg-white p-8 shadow-sm border border-ink/5">
            <h3 className="text-lg font-semibold text-ink mb-1">Free</h3>
            <p className="text-3xl font-bold text-ink mb-4">$0</p>
            <ul className="space-y-2 text-sm text-ink/60 mb-6">
              <li>✓ Up to 15 seats</li>
              <li>✓ 2 team games</li>
              <li>✓ 1 feedback channel</li>
              <li>✓ Basic pulse surveys</li>
              <li>✓ Community support</li>
            </ul>
            <a href="/signup" className="block w-full text-center rounded-md border border-trust-blue text-trust-blue px-4 py-2 text-sm font-semibold hover:bg-trust-blue/5 transition-colors">
              Get started
            </a>
          </div>

          {/* Team */}
          <div className="rounded-xl bg-white p-8 shadow-sm border-2 border-trust-blue relative">
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-trust-blue text-white text-xs px-3 py-1 rounded-full">
              Most popular
            </span>
            <h3 className="text-lg font-semibold text-ink mb-1">Team</h3>
            <p className="text-3xl font-bold text-ink mb-4">$4<span className="text-sm font-normal text-ink/40">/user/mo</span></p>
            <ul className="space-y-2 text-sm text-ink/60 mb-6">
              <li>✓ Unlimited seats</li>
              <li>✓ All 6 games</li>
              <li>✓ Unlimited feedback channels</li>
              <li>✓ Two-way anonymous replies</li>
              <li>✓ Pulse surveys + 360s</li>
              <li>✓ AI insights</li>
              <li>✓ Slack integration</li>
            </ul>
            <a href="/signup" className="block w-full text-center rounded-md bg-trust-blue text-white px-4 py-2 text-sm font-semibold hover:bg-trust-blue/90 transition-colors">
              Start free trial
            </a>
          </div>

          {/* Business */}
          <div className="rounded-xl bg-white p-8 shadow-sm border border-ink/5">
            <h3 className="text-lg font-semibold text-ink mb-1">Business</h3>
            <p className="text-3xl font-bold text-ink mb-4">$8<span className="text-sm font-normal text-ink/40">/user/mo</span></p>
            <ul className="space-y-2 text-sm text-ink/60 mb-6">
              <li>✓ Everything in Team</li>
              <li>✓ SSO (Google, Okta, Entra)</li>
              <li>✓ SCIM provisioning</li>
              <li>✓ Data residency (EU/US)</li>
              <li>✓ Audit log</li>
              <li>✓ Custom subdomain</li>
              <li>✓ Priority support</li>
            </ul>
            <a href="/signup" className="block w-full text-center rounded-md border border-trust-blue text-trust-blue px-4 py-2 text-sm font-semibold hover:bg-trust-blue/5 transition-colors">
              Contact sales
            </a>
          </div>

          {/* Enterprise */}
          <div className="rounded-xl bg-white p-8 shadow-sm border border-ink/5">
            <h3 className="text-lg font-semibold text-ink mb-1">Enterprise</h3>
            <p className="text-3xl font-bold text-ink mb-4">Custom</p>
            <ul className="space-y-2 text-sm text-ink/60 mb-6">
              <li>✓ Everything in Business</li>
              <li>✓ Dedicated instance</li>
              <li>✓ Custom compliance</li>
              <li>✓ SLA 99.99%</li>
              <li>✓ Legal hold</li>
              <li>✓ Game marketplace access</li>
              <li>✓ Dedicated CSM</li>
            </ul>
            <a href="/signup" className="block w-full text-center rounded-md border border-ink/10 text-ink px-4 py-2 text-sm font-semibold hover:bg-ink/5 transition-colors">
              Talk to us
            </a>
          </div>
        </div>

        <div className="mt-16 text-center">
          <h2 className="text-xl font-semibold text-ink mb-4">Frequently asked</h2>
          <div className="max-w-2xl mx-auto text-left space-y-4">
            {[
              { q: "Can I try before I buy?", a: "Yes - the Free plan has no time limit. Upgrade when you're ready." },
              { q: "Do you require a credit card?", a: "No. The Free plan needs no payment info. Paid plans are billed via Paddle (Merchant of Record)." },
              { q: "Where is my data stored?", a: "You choose US or EU at workspace creation. Data never leaves your chosen region." },
              { q: "Is feedback truly anonymous?", a: "Yes. We use k-anonymity guards (k=5 default) and zero-knowledge handles. Even we can't re-identify respondents." },
            ].map((item, i) => (
              <div key={i} className="rounded-lg bg-white p-4 border border-ink/5">
                <p className="font-medium text-ink text-sm mb-1">{item.q}</p>
                <p className="text-sm text-ink/60">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
