import { defineGame } from "@secretlink/game-sdk";
import type { GameEvent } from "@secretlink/game-sdk";

type TwoTruthsState = {
  phase: "submitting" | "guessing" | "results" | "complete";
  players: string[];
  submissions: Record<string, { statements: string[]; lieIndex: number }>;
  currentRound: number;
  guesses: Record<string, Record<string, number>>; // round_player -> guesser -> lieGuessIndex
  scores: Record<string, number>;
};

export const twoTruthsGame = defineGame<TwoTruthsState>({
  id: "two-truths-and-a-lie",
  name: "Two Truths & a Lie",
  description: "Each player submits 3 statements — two truths and one lie. The team guesses which is the lie.",
  minPlayers: 3,
  maxPlayers: 20,
  version: "1.0.0",

  init(playerIds) {
    const scores: Record<string, number> = {};
    for (const id of playerIds) {
      scores[id] = 0;
    }

    return {
      phase: "submitting",
      players: [...playerIds],
      submissions: {},
      currentRound: 0,
      guesses: {},
      scores,
    };
  },

  reduce(state, event: GameEvent) {
    switch (event.type) {
      case "submit_statements": {
        const { statements, lieIndex } = event.payload as { statements: string[]; lieIndex: number };
        if (statements.length !== 3 || lieIndex < 0 || lieIndex > 2) return state;

        const newSubmissions = { ...state.submissions, [event.playerId]: { statements, lieIndex } };
        const allSubmitted = state.players.every((p) => p in newSubmissions);

        return {
          ...state,
          submissions: newSubmissions,
          phase: allSubmitted ? "guessing" : "submitting",
        };
      }

      case "guess": {
        const { targetPlayer, guessedLieIndex } = event.payload as { targetPlayer: string; guessedLieIndex: number };
        if (event.playerId === targetPlayer) return state; // can't guess your own

        const roundKey = `${state.currentRound}_${targetPlayer}`;
        const roundGuesses = state.guesses[roundKey] ?? {};

        const newGuesses = {
          ...state.guesses,
          [roundKey]: { ...roundGuesses, [event.playerId]: guessedLieIndex },
        };

        // Check if correct and update scores
        const submission = state.submissions[targetPlayer];
        const newScores = { ...state.scores };
        if (submission && guessedLieIndex === submission.lieIndex) {
          newScores[event.playerId] = (newScores[event.playerId] ?? 0) + 1;
        }

        return { ...state, guesses: newGuesses, scores: newScores };
      }

      case "next_round": {
        const nextRound = state.currentRound + 1;
        if (nextRound >= state.players.length) {
          return { ...state, phase: "complete" };
        }
        return { ...state, currentRound: nextRound, phase: "guessing" };
      }

      case "show_results":
        return { ...state, phase: "results" };

      default:
        return state;
    }
  },

  isComplete(state) {
    return state.phase === "complete";
  },

  getPlayerView(state, playerId) {
    if (state.phase === "submitting") {
      return {
        phase: state.phase,
        hasSubmitted: playerId in state.submissions,
        submittedCount: Object.keys(state.submissions).length,
        totalPlayers: state.players.length,
      };
    }

    const currentPlayer = state.players[state.currentRound];
    const submission = currentPlayer ? state.submissions[currentPlayer] : undefined;

    return {
      phase: state.phase,
      currentRound: state.currentRound,
      totalRounds: state.players.length,
      currentPlayer,
      statements: submission?.statements,
      // Only show lie index in results phase
      lieIndex: state.phase === "results" || state.phase === "complete" ? submission?.lieIndex : undefined,
      scores: state.scores,
      myScore: state.scores[playerId] ?? 0,
    };
  },
});
