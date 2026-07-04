#!/usr/bin/env node
// Generate a fresh set of production secrets for Secretlink.
//
//   node scripts/gen-secrets.mjs            # print to stdout
//   node scripts/gen-secrets.mjs >> .env    # append to a .env file
//
// VAPID keys are generated with the same P-256 curve web-push expects, encoded
// as base64url, so they are drop-in compatible with the `web-push` library.

import { randomBytes, generateKeyPairSync } from "node:crypto";

function hex(bytes) {
  return randomBytes(bytes).toString("hex");
}
function b64(bytes) {
  return randomBytes(bytes).toString("base64");
}

// VAPID: uncompressed P-256 public key (65 bytes, 0x04 || X || Y) + raw 32-byte
// private key, both base64url — matches `npx web-push generate-vapid-keys`.
function genVapid() {
  const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const pubJwk = publicKey.export({ format: "jwk" });
  const privJwk = privateKey.export({ format: "jwk" });
  const point = Buffer.concat([
    Buffer.from([0x04]),
    Buffer.from(pubJwk.x, "base64url"),
    Buffer.from(pubJwk.y, "base64url"),
  ]);
  return {
    publicKey: point.toString("base64url"),
    privateKey: privJwk.d, // already base64url in JWK
  };
}

const vapid = genVapid();

const lines = [
  `JWT_SECRET=${hex(32)}`,
  `SESSION_SECRET=${hex(32)}`,
  `MASTER_KEY=${b64(32)}`,
  `VAPID_PUBLIC_KEY=${vapid.publicKey}`,
  `VAPID_PRIVATE_KEY=${vapid.privateKey}`,
];

console.log("# Generated " + new Date().toISOString());
console.log(lines.join("\n"));
