import { defineGame } from "@secretlink/game-sdk";
import type { GameEvent } from "@secretlink/game-sdk";

type RetroState = {
  phase: "collecting" | "grouping" | "discussing" | "complete";
  players: string[];
  items: Array<{
    id: string;
    category: "mad" | "sad" | "glad";
    text: string;
    votes: number;
    group?: string;
  }>;
  groups: Array<{ name: string; itemIds: string[] }>;
};

export const retroGame = defineGame<RetroState>({
  id: "retro-mad-sad-glad",
  name: "Retro: Mad/Sad/Glad",
  description: "Anonymous sprint retrospective with auto-grouping by AI. Share what made you mad, sad, or glad.",
  minPlayers: 2,
  maxPlayers: 30,
  version: "1.0.0",

  init(playerIds) {
    return {
      phase: "collecting",
      players: [...playerIds],
      items: [],
      groups: [],
    };
  },

  reduce(state, event: GameEvent) {
    switch (event.type) {
      case "add_item": {
        const { category, text } = event.payload as { category: "mad" | "sad" | "glad"; text: string };
        if (!text.trim()) return state;
        if (!["mad", "sad", "glad"].includes(category)) return state;

        const item = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          category,
          text: text.trim(),
          votes: 0,
        };

        return { ...state, items: [...state.items, item] };
      }

      case "vote": {
        const { itemId } = event.payload as { itemId: string };
        return {
          ...state,
          items: state.items.map((item) =>
            item.id === itemId ? { ...item, votes: item.votes + 1 } : item,
          ),
        };
      }

      case "set_groups": {
        const { groups } = event.payload as { groups: Array<{ name: string; itemIds: string[] }> };
        return { ...state, groups, phase: "discussing" };
      }

      case "start_grouping":
        return { ...state, phase: "grouping" };

      case "complete":
        return { ...state, phase: "complete" };

      default:
        return state;
    }
  },

  isComplete(state) {
    return state.phase === "complete";
  },

  getPlayerView(state, _playerId) {
    return {
      phase: state.phase,
      items: state.items.map((item) => ({
        id: item.id,
        category: item.category,
        text: item.text,
        votes: item.votes,
        group: item.group,
      })),
      groups: state.groups,
      summary: {
        mad: state.items.filter((i) => i.category === "mad").length,
        sad: state.items.filter((i) => i.category === "sad").length,
        glad: state.items.filter((i) => i.category === "glad").length,
        total: state.items.length,
      },
    };
  },
});
