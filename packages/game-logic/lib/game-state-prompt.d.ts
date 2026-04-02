import type { Game } from './Game';
/**
 * Human-readable snapshot for LLM prompts: board tops, pool tops, whose turn.
 * Indices match Game (0–15 board row-major; P1 pools 16–18; P2 pools 19–21).
 */
export declare function describeGameStateForPrompt(game: Game): string;
