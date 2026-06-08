import Koa from "koa";
import Router from "@koa/router";
import bodyParser from "koa-bodyparser";
import pino from "pino";
import type { GameDefinition, GameEvent } from "@secretlink/game-sdk";
import { twoTruthsGame } from "./games/two-truths.js";
import { secretComplimentsGame } from "./games/secret-compliments.js";
import { retroGame } from "./games/retro-mad-sad-glad.js";

const logger = pino({ level: process.env["LOG_LEVEL"] ?? "info" });
const app = new Koa();
app.use(bodyParser());

const router = new Router({ prefix: "/v1/games" });

// Registry of available games
const gameRegistry = new Map<string, GameDefinition<unknown>>([
  [twoTruthsGame.id, twoTruthsGame as GameDefinition<unknown>],
  [secretComplimentsGame.id, secretComplimentsGame as GameDefinition<unknown>],
  [retroGame.id, retroGame as GameDefinition<unknown>],
]);

// Active game sessions
const sessions = new Map<string, { gameId: string; state: unknown; playerIds: string[] }>();

// List available games
router.get("/", async (ctx) => {
  const games = [...gameRegistry.values()].map((g) => ({
    id: g.id,
    name: g.name,
    description: g.description,
    minPlayers: g.minPlayers,
    maxPlayers: g.maxPlayers,
  }));
  ctx.body = { games };
});

// Create a new game session
router.post("/sessions", async (ctx) => {
  const body = ctx.request.body as Record<string, unknown>;
  const gameId = String(body.gameId ?? "");
  const playerIds = (body.playerIds ?? []) as string[];

  const gameDef = gameRegistry.get(gameId);
  if (!gameDef) {
    ctx.status = 404;
    ctx.body = { error: "game_not_found" };
    return;
  }

  if (playerIds.length < gameDef.minPlayers || playerIds.length > gameDef.maxPlayers) {
    ctx.status = 400;
    ctx.body = { error: "invalid_player_count", min: gameDef.minPlayers, max: gameDef.maxPlayers };
    return;
  }

  const sessionId = crypto.randomUUID();
  const state = gameDef.init(playerIds);
  sessions.set(sessionId, { gameId, state, playerIds });

  logger.info({ sessionId, gameId, playerCount: playerIds.length }, "Game session created");
  ctx.status = 201;
  ctx.body = { sessionId, gameId };
});

// Send an event to a game session
router.post("/sessions/:sessionId/events", async (ctx) => {
  const session = sessions.get(ctx.params["sessionId"]!);
  if (!session) {
    ctx.status = 404;
    ctx.body = { error: "session_not_found" };
    return;
  }

  const gameDef = gameRegistry.get(session.gameId);
  if (!gameDef) {
    ctx.status = 500;
    ctx.body = { error: "game_definition_missing" };
    return;
  }

  const event = ctx.request.body as GameEvent;
  const newState = gameDef.reduce(session.state, event);
  session.state = newState;

  const isComplete = gameDef.isComplete(newState);
  logger.info({ sessionId: ctx.params["sessionId"], eventType: event.type, isComplete }, "Game event processed");

  ctx.body = { ok: true, isComplete };
});

// Get player view of game state
router.get("/sessions/:sessionId/view/:playerId", async (ctx) => {
  const session = sessions.get(ctx.params["sessionId"]!);
  if (!session) {
    ctx.status = 404;
    ctx.body = { error: "session_not_found" };
    return;
  }

  const gameDef = gameRegistry.get(session.gameId);
  if (!gameDef) {
    ctx.status = 500;
    ctx.body = { error: "game_definition_missing" };
    return;
  }

  const playerId = ctx.params["playerId"]!;
  const view = gameDef.getPlayerView(session.state, playerId);
  ctx.body = { gameId: session.gameId, playerId, view };
});

app.use(router.routes());
app.use(router.allowedMethods());

const port = Number(process.env["PORT"] ?? 4002);
app.listen(port, () => {
  logger.info({ port, gamesLoaded: gameRegistry.size }, "Game runtime listening");
});
