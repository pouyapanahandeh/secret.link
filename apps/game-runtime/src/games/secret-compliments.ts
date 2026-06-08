import { defineGame } from "@secretlink/game-sdk";
import type { GameEvent } from "@secretlink/game-sdk";

type ComplimentsState = {
  phase: "writing" | "revealing" | "complete";
  players: string[];
  compliments: Record<string, Array<{ from: string; text: string }>>;
  revealedCount: number;
};

export const secretComplimentsGame = defineGame<ComplimentsState>({
  id: "secret-compliments",
  name: "Secret Compliments",
  description: "Round-robin anonymous appreciation. Send compliments to your teammates — they'll never know who sent them.",
  minPlayers: 3,
  maxPlayers: 30,
  version: "1.0.0",

  init(playerIds) {
    const compliments: Record<string, Array<{ from: string; text: string }>> = {};
    for (const id of playerIds) {
      compliments[id] = [];
    }
    return {
      phase: "writing",
      players: [...playerIds],
      compliments,
      revealedCount: 0,
    };
  },

  reduce(state, event: GameEvent) {
    switch (event.type) {
      case "send_compliment": {
        const { targetPlayer, text } = event.payload as { targetPlayer: string; text: string };
        if (event.playerId === targetPlayer) return state;
        if (!text.trim()) return state;

        const targetCompliments = state.compliments[targetPlayer] ?? [];
        return {
          ...state,
          compliments: {
            ...state.compliments,
            [targetPlayer]: [...targetCompliments, { from: event.playerId, text }],
          },
        };
      }

      case "reveal":
        return { ...state, phase: "revealing", revealedCount: state.revealedCount + 1 };

      case "complete":
        return { ...state, phase: "complete" };

      default:
        return state;
    }
  },

  isComplete(state) {
    return state.phase === "complete";
  },

  getPlayerView(state, playerId) {
    const myCompliments = (state.compliments[playerId] ?? []).map((c) => ({
      text: c.text,
      // Never reveal who sent the compliment
    }));

    return {
      phase: state.phase,
      totalPlayers: state.players.length,
      myComplimentsCount: myCompliments.length,
      myCompliments: state.phase === "revealing" || state.phase === "complete" ? myCompliments : [],
      totalComplimentsSent: Object.values(state.compliments).flat().length,
    };
  },
});
