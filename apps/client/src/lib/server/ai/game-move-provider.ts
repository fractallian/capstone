import type { SerializedMove } from '@capstone/game-logic';

/** Serializable board state passed to any opponent implementation (LLM, heuristic, scripted, etc.). */
export type GameBoardStateInput = {
	moves: SerializedMove[];
	currentTurnIndex: 0 | 1;
	legalMoves: SerializedMove[];
};

/** A move in global stack index space (same as `SerializedMove` / game commands). */
export type ChosenMove = Pick<SerializedMove, 'from' | 'to'>;

/**
 * Pluggable opponent: given the current rules-consistent state, pick the next move.
 * Implementations may ignore `legalMoves` and validate themselves, but the server
 * should always re-check legality before applying.
 */
export interface GameMoveProvider {
	chooseMove(state: GameBoardStateInput): Promise<ChosenMove>;
}
