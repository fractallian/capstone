import { describe, expect, it } from 'vitest';
import { Game } from '@capstone/game-logic';
import { isOpponentIncrementalMove, OPPONENT_MOVE_ANIMATION_MS } from './opponent-move-animation';

function applyFirstLegalMove(g: Game): void {
	const from = g.currentTurn.pool.stacks.find((stack) => stack.pieces.length > 0);
	const to = g.board.stacks.flat().find((stack) => stack.pieces.length === 0);
	if (!from || !to) throw new Error('No legal move available for test setup.');
	g.makeMove(from, to);
}

describe('opponent-move-animation', () => {
	it('keeps the shared animation duration constant used for opponent move transitions', () => {
		expect(OPPONENT_MOVE_ANIMATION_MS).toBe(680);
	});

	it('does not animate when the new move is made by the viewer seat', () => {
		const result = isOpponentIncrementalMove({
			fullMoves: [{ from: 0, to: 3 }],
			plyIndex: 0,
			viewerIndex: 1,
			moveCountBeforeSync: 0,
			turnAtStartOfNewMoves: 0
		});
		expect(result).toBe(false);
	});

	it('animates when the new move is made by the opponent seat', () => {
		const result = isOpponentIncrementalMove({
			fullMoves: [{ from: 0, to: 3 }],
			plyIndex: 0,
			viewerIndex: 2,
			moveCountBeforeSync: 0,
			turnAtStartOfNewMoves: 0
		});
		expect(result).toBe(true);
	});

	it('evaluates later incremental plies relative to prior sync move count and turn', () => {
		const g = new Game();
		applyFirstLegalMove(g);
		applyFirstLegalMove(g);
		const result = isOpponentIncrementalMove({
			fullMoves: g.serialize(),
			plyIndex: 1,
			viewerIndex: 1,
			moveCountBeforeSync: 1,
			turnAtStartOfNewMoves: 1
		});
		expect(result).toBe(true);
	});
});
