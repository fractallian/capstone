import { describe, expect, it } from 'vitest';
import { Game } from '@capstone/game-logic';
import { chooseMove } from './chooseMove';

describe('chooseMove', () => {
	it('evaluates from the mover\'s perspective so defense (blocking a one-move win) is prioritized', () => {
		const game = new Game();
		game.makeMove(game.player1.pool.stacks[0], game.board.stacks[3][0]);
		game.makeMove(game.player2.pool.stacks[0], game.board.stacks[0][0]);
		game.makeMove(game.player1.pool.stacks[0], game.board.stacks[3][1]);
		game.makeMove(game.player2.pool.stacks[0], game.board.stacks[0][1]);
		game.makeMove(game.player1.pool.stacks[0], game.board.stacks[3][2]);
		game.makeMove(game.player2.pool.stacks[0], game.board.stacks[0][2]);
		game.makeMove(game.player1.pool.stacks[0], game.board.stacks[3][3]);

		expect(game.currentTurn).toBe(game.player2);
		const chosen = chooseMove(game);
		// Completing the top row at (0,3) is the uniquely strong move (CPU wins); regression:
		// we used to score with `currentTurn` (human) as analyzer.player and picked poorly.
		expect(chosen.to).toBe(3);
	});
});
