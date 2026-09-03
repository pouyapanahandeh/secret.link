type Vault = Record<string, { k: string; exp: string }>;

function storageKey(userId: string): string {
  return `sl_chat_keys:${userId}`;
}

function readVault(userId: string): Vault {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Vault;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed;
  } catch {
    return {};
  }
}

function writeVault(userId: string, vault: Vault): void {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(vault));
  } catch {
    /* quota / private mode */
  }
}

function prune(vault: Vault, now = Date.now()): Vault {
  const next: Vault = {};
  for (const [roomId, entry] of Object.entries(vault)) {
    if (!entry?.k || !entry.exp) continue;
    if (new Date(entry.exp).getTime() <= now) continue;
    next[roomId] = { k: String(entry.k), exp: String(entry.exp) };
  }
  return next;
}

export function saveChatKey(userId: string, roomId: string, keyBase64: string, expiresAt: string): void {
  if (!userId || !roomId || !keyBase64 || !expiresAt) return;
  if (new Date(expiresAt).getTime() <= Date.now()) return;
  const vault = prune(readVault(userId));
  vault[roomId] = { k: keyBase64, exp: expiresAt };
  writeVault(userId, vault);
}

export function loadChatKey(userId: string, roomId: string): string | null {
  const vault = prune(readVault(userId));
  const entry = vault[roomId];
  if (!entry) return null;
  writeVault(userId, vault);
  return entry.k;
}

export function loadChatKeyMap(userId: string): Record<string, string> {
  const vault = prune(readVault(userId));
  writeVault(userId, vault);
  const keys: Record<string, string> = {};
  for (const [roomId, entry] of Object.entries(vault)) keys[roomId] = entry.k;
  return keys;
}
