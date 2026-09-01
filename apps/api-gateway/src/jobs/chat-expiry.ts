import { purgeExpiredRooms } from "../repositories/chat-repo.js";

let timer: ReturnType<typeof setInterval> | null = null;

/** Hard-delete expired chat rooms and all of their members/messages. */
export function runChatExpirySweep(): number {
  return purgeExpiredRooms().length;
}

export function startChatExpiryJob(): void {
  if (timer) return;
  try {
    runChatExpirySweep();
  } catch (e) {
    console.error("[chat-expiry] sweep failed:", e);
  }
  timer = setInterval(() => {
    try {
      runChatExpirySweep();
    } catch (e) {
      console.error("[chat-expiry] sweep failed:", e);
    }
  }, 60_000);
  timer.unref?.();
}
