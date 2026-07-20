import Database from "better-sqlite3";
import { nanoid } from "nanoid";

const dbPath = process.argv[2] ?? "apps/api-gateway/data/secretlink.db";
const db = new Database(dbPath);

const slug = "what-is-secretlink";
const existing = db.prepare("SELECT slug FROM blog_posts WHERE slug = ?").get(slug);
if (existing) {
  console.log(`Post already exists: ${slug}`);
  process.exit(0);
}

const author =
  db.prepare("SELECT id, handle FROM users WHERE role = 'admin' LIMIT 1").get() ??
  db.prepare("SELECT id, handle FROM users LIMIT 1").get();

const now = new Date().toISOString();
const id = nanoid();

const insert = db.prepare(
  "INSERT INTO blog_posts (id, slug, title, excerpt, body, cover_image_url, keywords, status, author_id, published_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
);

insert.run(
  id,
  slug,
  "What is Secretlink?",
  "Anonymous messages that self-destruct after one read. Here is what Secretlink is — and why we built it.",
  "## Say it once, then it is gone\n\nSecretlink is a privacy-first way to send messages, links, and moments that **disappear after they are read**. No permanent feed. No screenshot-proof promises — just encryption on your device and a link that burns.\n\n## Who it is for\n\n- People who want to share something real without leaving a trail\n- Creators who drop secrets on the map for fans nearby\n- Anyone who prefers **hold-to-reveal** over broadcast-and-archive\n\n## Try it\n\n[Send a secret](https://secretlink.life/send) or [claim your @handle](https://secretlink.life/signup) — no drama, no traces.",
  "https://secretlink.life/secretlink.png",
  "ephemeral messaging, privacy, self-destructing messages, anonymous secrets, Secretlink",
  "published",
  author?.id ?? null,
  now,
  now,
  now,
);

console.log(JSON.stringify({ id, slug, author: author?.handle ?? null, url: `https://secretlink.life/blog/${slug}` }));
