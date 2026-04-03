import { Game, type SerializedMove, StackLocation } from '@capstone/game-logic';

/**
 * PRD `leap`: **1** if the move takes a piece from the current player's pool onto the board
 * and **covers an opponent's piece**; else **0**.
 */
export function isLeapMove(game: Game, move: SerializedMove): boolean {
	const from = game.stacks[move.from];
	const to = game.stacks[move.to];
	if (from.location !== StackLocation.pool) return false;
	if (!game.currentTurn.pool.stacks.includes(from)) return false;
	const top = to.topPiece();
	if (!top) return false;
	return top.player !== game.currentTurn;
}
