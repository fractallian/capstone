import { describe, expect, it } from 'vitest';
import { Game } from './Game';
import { listLegalMoves } from './listLegalMoves';

describe('listLegalMoves', () => {
	it('returns only legal moves from the initial position', () => {
		const game = new Game();
		const moves = listLegalMoves(game);
		expect(moves.length).toBeGreaterThan(0);
		for (const { from, to } of moves) {
			const g = new Game();
			expect(() => g.makeMove(g.stacks[from], g.stacks[to])).not.toThrow();
		}
	});
});
