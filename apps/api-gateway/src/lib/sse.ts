import type { Context } from "koa";
import { nanoid } from "nanoid";

interface SSEClient {
  channel: string;
  userId: string;
  write: (event: string, data: unknown) => void;
}

interface Ticket {
  channel: string;
  userId: string;
  expiresAt: number;
}

/**
 * Generic in-memory Server-Sent Events hub.
 *
 * Manages short-lived connection tickets (since EventSource cannot send auth
 * headers) and a registry of open client connections keyed by an arbitrary
 * "channel" string (e.g. a user id or conversation id).
 *
 * Single-process only — would need Redis pub/sub to scale horizontally.
 */
export class SSEHub {
  private readonly clients = new Set<SSEClient>();
  private readonly tickets = new Map<string, Ticket>();

  constructor(private readonly ticketTtlMs = 30_000) {
    const timer = setInterval(() => this.pruneTickets(), 60_000);
    // Don't keep the event loop alive solely for cleanup.
    timer.unref?.();
  }

  private pruneTickets() {
    const now = Date.now();
    for (const [key, val] of this.tickets) {
      if (now > val.expiresAt) this.tickets.delete(key);
    }
  }

  /** Create a one-time ticket bound to a channel + user. */
  issueTicket(channel: string, userId: string): string {
    const ticket = nanoid(32);
    this.tickets.set(ticket, { channel, userId, expiresAt: Date.now() + this.ticketTtlMs });
    return ticket;
  }

  /** Validate and consume a ticket (one-time use). Returns null if invalid/expired. */
  consumeTicket(ticket: string): { channel: string; userId: string } | null {
    const data = this.tickets.get(ticket);
    if (!data || Date.now() > data.expiresAt) return null;
    this.tickets.delete(ticket);
    return { channel: data.channel, userId: data.userId };
  }

  /** Push an event to every open client on a channel (optionally excluding one user). */
  notify(channel: string, event: string, data: unknown, excludeUserId?: string) {
    for (const client of this.clients) {
      if (client.channel === channel && client.userId !== excludeUserId) {
        client.write(event, data);
      }
    }
  }

  /**
   * Attach an SSE stream to the Koa context for the given channel.
   * Returns a promise that never resolves — keeps the connection open until
   * the client disconnects. Callers should `await` it as the final handler step.
   */
  attach(ctx: Context, channel: string, userId: string): Promise<void> {
    ctx.req.socket.setKeepAlive(true);
    ctx.req.socket.setNoDelay(true);
    ctx.set("Content-Type", "text/event-stream");
    ctx.set("Cache-Control", "no-cache");
    ctx.set("Connection", "keep-alive");
    ctx.set("X-Accel-Buffering", "no"); // Disable nginx buffering
    ctx.status = 200;

    const stream = ctx.res;
    stream.write("event: connected\ndata: {}\n\n");

    const client: SSEClient = {
      channel,
      userId,
      write: (event, data) => {
        try {
          stream.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        } catch {
          /* stream closed */
        }
      },
    };
    this.clients.add(client);

    const keepAlive = setInterval(() => {
      try {
        stream.write(": ping\n\n");
      } catch {
        clearInterval(keepAlive);
        this.clients.delete(client);
      }
    }, 30_000);

    ctx.req.on("close", () => {
      clearInterval(keepAlive);
      this.clients.delete(client);
    });

    return new Promise(() => {}); // never resolves; connection stays open
  }
}
