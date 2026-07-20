import { createCipheriv, randomBytes } from "node:crypto";

const API_URL = process.argv[2] ?? "http://localhost:4000";

function encryptMapPayload(plaintext) {
  const key = randomBytes(32);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const ciphertext = Buffer.concat([encrypted, tag]);
  const toB64Url = (buf) =>
    buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return { ciphertext: toB64Url(ciphertext), nonce: toB64Url(iv), key: toB64Url(key) };
}

const EMOJIS = ["🤫", "💬", "📍", "✨", "🌙", "🔥", "💭", "🗺️", "🫣", "💌"];

const DROPS = [
  { lat: 47.507, lng: 19.0457, locationName: "Hungarian Parliament", message: "I watched the sunset from the Danube bank and finally understood why people stay." },
  { lat: 47.496, lng: 19.0394, locationName: "Buda Castle", message: "Met someone here last winter. We never exchanged names. I still think about them." },
  { lat: 47.5029, lng: 19.0348, locationName: "Fisherman's Bastion", message: "Proposed at the top step. They said yes. Nobody else knows yet." },
  { lat: 47.5008, lng: 19.0536, locationName: "St. Stephen's Basilica", message: "I come here when the city feels too loud. The bells help." },
  { lat: 47.4989, lng: 19.0436, locationName: "Chain Bridge", message: "Crossed this bridge on my first day in Budapest. Felt like the start of something." },
  { lat: 47.515, lng: 19.0779, locationName: "Heroes' Square", message: "Skipped class to sit on the steps. Best decision of the semester." },
  { lat: 47.5189, lng: 19.0819, locationName: "Széchenyi Thermal Bath", message: "Lost my phone in the outdoor pool. Found peace instead." },
  { lat: 47.4869, lng: 19.0587, locationName: "Great Market Hall", message: "The lángos vendor winked at me three days in a row. I never went back." },
  { lat: 47.4959, lng: 19.0602, locationName: "Dohány Street Synagogue", message: "Grandmother's city. I whispered her name under the dome." },
  { lat: 47.527, lng: 19.046, locationName: "Margaret Island", message: "Ran the full loop at 6am. The mist on the Danube was unreal." },
  { lat: 47.4839, lng: 19.0468, locationName: "Gellért Hill", message: "Cried at the Citadella view. Not sad — just overwhelmed." },
  { lat: 47.4967, lng: 19.0633, locationName: "Szimpla Kert", message: "First ruin bar night. Wrote my number on a bathroom wall. Regret nothing." },
  { lat: 47.502, lng: 19.058, locationName: "Andrássy út", message: "Dream apartment above the tree line. One day." },
  { lat: 47.5067, lng: 19.0655, locationName: "House of Terror", message: "Heavy afternoon. Needed to sit in the courtyard afterward." },
  { lat: 47.498, lng: 19.051, locationName: "Budapest Eye", message: "Terrified of heights. Went up anyway for them. We broke up two weeks later." },
  { lat: 47.493, lng: 19.0515, locationName: "Váci utca", message: "Tourist trap? Maybe. But the street musician made me cry." },
  { lat: 47.4864, lng: 19.0464, locationName: "Citadella", message: "Liberty Statue from behind, city spread out — this is the postcard in my head." },
  { lat: 47.4859, lng: 19.0544, locationName: "Liberty Bridge", message: "Green tram rattled past while we kissed. Classic Budapest." },
  { lat: 47.5025, lng: 19.0585, locationName: "Hungarian State Opera", message: "Snuck into a rehearsal. Usher looked away on purpose." },
  { lat: 47.5145, lng: 19.0825, locationName: "City Park", message: "Picnic under the trees. Strangers shared wine. Perfect Sunday." },
  { lat: 47.5, lng: 19.0836, locationName: "Keleti pályaudvar", message: "Goodbye at platform 9. Train to Vienna. Still check their stories." },
  { lat: 47.5106, lng: 19.0558, locationName: "Nyugati pályaudvar", message: "Missed the last train. Best night walk home I've had." },
  { lat: 47.489, lng: 19.0472, locationName: "Rudas Baths", message: "Rooftop pool at night. Stars and steam. Felt completely alone in the best way." },
  { lat: 47.4264, lng: 18.9959, locationName: "Memento Park", message: "Out here where the statues go to rest. Quiet and strange and beautiful." },
  { lat: 47.497, lng: 19.052, locationName: "Deák Ferenc tér", message: "Heart of the city. Every line crosses here. So do all my thoughts lately." },
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postSecret(drop, index) {
  const encrypted = encryptMapPayload(drop.message);
  const res = await fetch(`${API_URL}/v1/secrets/map`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ciphertext: encrypted.ciphertext,
      nonce: encrypted.nonce,
      key: encrypted.key,
      lat: drop.lat,
      lng: drop.lng,
      emoji: EMOJIS[index % EMOJIS.length],
      ttlMinutes: 1440,
      cityName: "Budapest",
      countryName: "Hungary",
      locationName: drop.locationName,
    }),
  });

  if (res.status === 429) {
    const body = await res.json();
    const waitMs = (body.retryAfter ?? 65) * 1000;
    console.log(`Rate limited — waiting ${body.retryAfter ?? 65}s…`);
    await sleep(waitMs);
    return postSecret(drop, index);
  }

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`POST failed (${res.status}) at ${drop.locationName}: ${err}`);
  }

  return res.json();
}

const created = [];
for (let i = 0; i < DROPS.length; i++) {
  const drop = DROPS[i];
  const result = await postSecret(drop, i);
  created.push({ id: result.id, location: drop.locationName, lat: drop.lat, lng: drop.lng });
  console.log(`[${i + 1}/${DROPS.length}] ${drop.locationName} → ${result.id}`);
  if ((i + 1) % 10 === 0 && i + 1 < DROPS.length) {
    console.log("Pausing 65s for rate limit…");
    await sleep(65_000);
  }
}

console.log(JSON.stringify({ count: created.length, secrets: created }, null, 2));
