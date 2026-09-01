import { SSEHub } from "./sse.js";

/** Dedicated SSE hub for secret chat rooms (channel = room id). */
export const chatsHub = new SSEHub();
