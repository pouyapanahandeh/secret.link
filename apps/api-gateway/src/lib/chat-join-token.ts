import { createHmac, timingSafeEqual } from "node:crypto";

const JOIN_SECRET = process.env["JWT_SECRET"] ?? "dev-secret-change-in-production";

type JoinPayload = {
  roomId: string;
  memberId: string;
  exp: number;
};

function sign(payloadB64: string): string {
  return createHmac("sha256", JOIN_SECRET).update(payloadB64).digest("base64url");
}

export function signJoinToken(roomId: string, memberId: string, expiresAtMs: number): string {
  const payloadB64 = Buffer.from(JSON.stringify({ roomId, memberId, exp: expiresAtMs }), "utf8").toString(
    "base64url",
  );
  return `${payloadB64}.${sign(payloadB64)}`;
}

export function verifyJoinToken(token: string): { roomId: string; memberId: string } | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const payloadB64 = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!payloadB64 || !sig) return null;

  const expected = sign(payloadB64);
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!timingSafeEqual(sigBuf, expectedBuf)) return null;

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as JoinPayload;
    if (!payload.roomId || !payload.memberId || typeof payload.exp !== "number") return null;
    if (Date.now() > payload.exp) return null;
    return { roomId: payload.roomId, memberId: payload.memberId };
  } catch {
    return null;
  }
}
