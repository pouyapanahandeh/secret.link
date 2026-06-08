import { z } from "zod";

/**
 * Game SDK — The interface community game authors implement.
 *
 * A game is a pure function: (state, event) => state
 * plus metadata describing the game.
 */

export const GameEventSchema = z.object({
  type: z.string(),
  playerId: z.string(),
  payload: z.record(z.unknown()),
  timestamp: z.number(),
});

export type GameEvent = z.infer<typeof GameEventSchema>;

export interface GameDefinition<TState = unknown> {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly minPlayers: number;
  readonly maxPlayers: number;
  readonly version: string;

  /** Initial state factory */
  init(playerIds: readonly string[]): TState;

  /** Pure reducer: (state, event) => state */
  reduce(state: TState, event: GameEvent): TState;

  /** Determine if the game is finished */
  isComplete(state: TState): boolean;

  /** Get the view of state visible to a specific player */
  getPlayerView(state: TState, playerId: string): unknown;
}

export function defineGame<TState>(definition: GameDefinition<TState>): GameDefinition<TState> {
  return definition;
}
