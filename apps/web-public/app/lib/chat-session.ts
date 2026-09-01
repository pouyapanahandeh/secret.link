export type ChatSession = {
  token: string;
  memberId: string;
  displayName: string;
};

function storageKey(roomId: string): string {
  return `sl_chat:${roomId}`;
}

export function saveChatSession(roomId: string, session: ChatSession): void {
  sessionStorage.setItem(storageKey(roomId), JSON.stringify(session));
}

export function loadChatSession(roomId: string): ChatSession | null {
  try {
    const raw = sessionStorage.getItem(storageKey(roomId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ChatSession>;
    if (parsed.token && parsed.memberId && parsed.displayName) {
      return {
        token: parsed.token,
        memberId: parsed.memberId,
        displayName: parsed.displayName,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function clearChatSession(roomId: string): void {
  sessionStorage.removeItem(storageKey(roomId));
}
