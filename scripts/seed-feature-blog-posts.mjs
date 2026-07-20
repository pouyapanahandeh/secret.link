import Database from "better-sqlite3";
import { nanoid } from "nanoid";

const dbPath = process.argv[2] ?? "apps/api-gateway/data/secretlink.db";
const db = new Database(dbPath);

const author =
  db.prepare("SELECT id, handle FROM users WHERE role = 'admin' LIMIT 1").get() ??
  db.prepare("SELECT id, handle FROM users LIMIT 1").get();

const cover = "https://secretlink.life/secretlink.png";
const insert = db.prepare(
  "INSERT INTO blog_posts (id, slug, title, excerpt, body, cover_image_url, keywords, status, author_id, published_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, NULL, ?, ?)",
);
const exists = db.prepare("SELECT 1 FROM blog_posts WHERE slug = ?");

const posts = [
  {
    slug: "send-a-secret-link",
    title: "Send a Secret Link",
    excerpt:
      "Create a one-time link for text, photos, or files. Share it anywhere — then watch it burn after it is opened.",
    keywords: "secret link, anonymous messaging, self-destructing link, one-time link",
    body: `## One link. One read. Gone.

**Send a secret** is the core of Secretlink. You write a message or attach a file, pick how long it lives, and get a unique URL.

Send that link by text, DM, email — whatever you want. When someone opens it, the secret **self-destructs**. No archive. No replay.

## No account needed

You can send anonymously. No signup required to drop a secret link.

[Try it now →](https://secretlink.life/send)`,
  },
  {
    slug: "whisper-text-that-burns",
    title: "Whisper: Text That Burns",
    excerpt:
      "Whisper mode is for words you do not want saved — confessions, drafts, or anything too real for a permanent chat.",
    keywords: "whisper, disappearing text, ephemeral messages, burn after reading",
    body: `## 💬 Whisper

Some things are better said once. **Whisper** is Secretlink's text mode: type your message, set a timer, share the link.

After it is read, the text is deleted from our servers. Encrypted on your device before it ever leaves.

## Good for

- Honest feedback you do not want on the record
- Apologies, confessions, or late-night thoughts
- Anything you would never paste into a normal chat app

[Send a Whisper →](https://secretlink.life/send)`,
  },
  {
    slug: "glimpse-disappearing-photos",
    title: "Glimpse: Disappearing Photos",
    excerpt:
      "Share a photo that vanishes after viewing. Glimpse keeps pics off feeds, camera rolls, and permanent timelines.",
    keywords: "disappearing photos, ephemeral images, glimpse, private photos",
    body: `## 📸 Glimpse

**Glimpse** lets you send photos that disappear after they are viewed — not stored on a profile, not posted to a feed.

Images are encrypted before upload. The link burns when your recipient closes the reveal.

## Why use it

- Share a moment without leaving a trail
- Send something personal to one person only
- Skip the screenshot anxiety of regular DMs

Pair with our capture-resistant viewer for extra peace of mind.

[Send a Glimpse →](https://secretlink.life/send)`,
  },
  {
    slug: "vault-passwords-and-files",
    title: "Vault: Passwords and Files",
    excerpt:
      "Send passwords, documents, or sensitive files through an encrypted link that deletes itself after access.",
    keywords: "secure file sharing, password sharing, encrypted vault, temporary file link",
    body: `## 🔐 Vault

Need to share a password, PDF, or zip file without leaving it in email forever? **Vault** mode wraps your file in end-to-end encryption and a self-destruct timer.

The recipient gets one chance to download or view. Then the blob is gone.

## Safer than email

- No permanent attachment sitting in an inbox
- You control how long the link stays alive
- We cannot read the file contents

[Share via Vault →](https://secretlink.life/send)`,
  },
  {
    slug: "echo-timed-broadcast",
    title: "Echo: Timed Broadcast",
    excerpt:
      "Echo broadcasts a secret to multiple viewers until the timer runs out — then everything disappears together.",
    keywords: "timed broadcast, echo, ephemeral broadcast, group secret",
    body: `## 👻 Echo

**Echo** is for secrets meant for more than one person — but still not forever. Set a time window, share the link, and let multiple people view before it all burns.

Perfect for limited drops, teasers, or "you had to be there" moments.

## How it differs

- Whisper and Glimpse = one read, one person
- Echo = timed window, can reach several viewers before expiry

When the clock hits zero, the secret is deleted.

[Create an Echo →](https://secretlink.life/send)`,
  },
  {
    slug: "claim-your-handle",
    title: "Claim Your @Handle",
    excerpt:
      "Your @handle is your address on Secretlink. Share one link and let anyone send you encrypted, self-destructing secrets.",
    keywords: "Secretlink handle, profile, anonymous inbox, @username",
    body: `## Your name on Secretlink

Claim a **@handle** like \`@you\` and get a public profile at \`secretlink.life/you\`.

Anyone can send you a secret through your page — no need to exchange phone numbers first.

## Your profile includes

- A short bio and avatar
- Social links (optional)
- A direct "send me a secret" button

Free forever. Passkey login — no password to forget.

[Claim your handle →](https://secretlink.life/signup)`,
  },
  {
    slug: "map-stories-near-you",
    title: "Map Stories Near You",
    excerpt:
      "Drop geo-tagged secrets on the map or browse stories people shared nearby. Tap, reveal, gone.",
    keywords: "map stories, location secrets, geo stories, secret map",
    body: `## 🗺️ Stories on the map

The **map** is a live feed of ephemeral stories tied to places. See what people dropped near you, or tap the map to leave your own.

Each story has a timer. Hold to reveal. When it expires, it disappears from the map.

## Explore or drop

- **Browse** — discover secrets around your area
- **Drop** — pin a message, photo, or emoji to a location

Nothing permanent. Nothing algorithmic. Just moments on a map.

[Open the map →](https://secretlink.life/map)`,
  },
  {
    slug: "end-to-end-encryption-explained",
    title: "End-to-End Encryption, Explained",
    excerpt:
      "Your secrets are encrypted on your device with XChaCha20-Poly1305. We store ciphertext — never your plaintext.",
    keywords: "end-to-end encryption, zero knowledge, XChaCha20, privacy",
    body: `## Math, not trust

Secretlink encrypts content **on your device** before it touches our servers. We use **XChaCha20-Poly1305** — the same family of modern encryption trusted by secure messaging apps.

## What we cannot do

- Read your messages
- Recover a secret after it burns
- Hand plaintext to anyone — including us

## Zero-knowledge by design

The decryption key travels with the link or stays on your device. When the secret self-destructs, the ciphertext is deleted too.

[Read our privacy policy →](https://secretlink.life/privacy)`,
  },
  {
    slug: "hold-to-reveal-capture-resistant",
    title: "Hold to Reveal (Capture-Resistant)",
    excerpt:
      "Recipients hold to see your secret. Screenshot blocking on mobile and watermarks on web raise the cost of leaks.",
    keywords: "hold to reveal, screenshot block, capture resistant, privacy",
    body: `## Hold. Read. Release.

Secrets are not shown all at once. Recipients **press and hold** to reveal — release, and the view is gone.

## Capture-resistant (not capture-proof)

We are honest: no app can stop a second camera. But we make casual leaks harder:

- **Mobile** — screenshot blocking where the OS allows it
- **Web** — watermarked previews

That moves leaks from "tap save" to "set up another device" — which stops most casual sharing.

## Why it matters

Ephemeral only works if viewing feels different from a normal chat.

[See it in action →](https://secretlink.life/send)`,
  },
  {
    slug: "auto-destruct-timers",
    title: "Auto-Destruct Timers",
    excerpt:
      "Choose how long a secret lives — from five minutes to thirty days. When time is up, the key is deleted forever.",
    keywords: "self-destruct timer, TTL, expiring messages, ephemeral timer",
    body: `## ⏱️ You pick the clock

Every secret has a **timer**. Choose how long it stays alive before auto-destruct:

- As short as **5 minutes** for ultra-sensitive drops
- Up to **30 days** for links you need to stay open a bit longer

## What happens at expiry

- The encrypted blob is deleted from our servers
- The link stops working — **410 Gone**
- No recovery, no "oops undo"

## Combine with view limits

Some secrets burn after **one view**. Others burn when **time runs out**. You decide per send.

[Send with a timer →](https://secretlink.life/send)`,
  },
];

const now = new Date().toISOString();
let created = 0;
let skipped = 0;

for (const post of posts) {
  if (exists.get(post.slug)) {
    skipped += 1;
    continue;
  }
  insert.run(
    nanoid(),
    post.slug,
    post.title,
    post.excerpt,
    post.body,
    cover,
    post.keywords,
    author?.id ?? null,
    now,
    now,
  );
  created += 1;
}

console.log(
  JSON.stringify({
    created,
    skipped,
    author: author?.handle ?? null,
    slugs: posts.map((p) => p.slug),
  }),
);
