import type { SerializedMove } from '@capstone/game-logic';
import { Game } from '@capstone/game-logic';

export const OPPONENT_MOVE_ANIMATION_MS = 680;

function turnBeforeAbsolutePly(
	plyIndex: number,
	moveCountBeforeSync: number,
	turnAtStartOfNewMoves: 0 | 1
): 0 | 1 {
	const offset = plyIndex - moveCountBeforeSync;
	return offset % 2 === 0 ? turnAtStartOfNewMoves : turnAtStartOfNewMoves === 0 ? 1 : 0;
}

export function isOpponentIncrementalMove(params: {
	fullMoves: SerializedMove[];
	plyIndex: number;
	viewerIndex: 1 | 2;
	moveCountBeforeSync: number;
	turnAtStartOfNewMoves: 0 | 1;
}): boolean {
	const turnBeforePly = turnBeforeAbsolutePly(
		params.plyIndex,
		params.moveCountBeforeSync,
		params.turnAtStartOfNewMoves
	);
	const prevMoves = params.fullMoves.slice(0, params.plyIndex);
	const before = Game.deserialize(prevMoves);
	before.currentTurn = turnBeforePly === 1 ? before.player2 : before.player1;
	const moverSeat = before.currentTurnIndex();
	const viewerSeat = params.viewerIndex - 1;
	return moverSeat !== viewerSeat;
}
