import { describe, expect, it } from 'vitest';
import { Game } from '@capstone/game-logic';
import { isLeapMove } from './isLeapMove';

describe('isLeapMove', () => {
	it('is 1 for pool → board covering an opponent top', () => {
		const game = new Game();
		game.makeMove(game.player1.pool.stacks[0], game.board.stacks[0][0]);
		expect(game.currentTurn).toBe(game.player2);
		// P2 pool onto P1’s piece on (0,0)
		const move = { from: game.player2.pool.stacks[0].index, to: game.board.stacks[0][0].index };
		expect(isLeapMove(game, move)).toBe(true);
	});

	it('is 0 for pool → empty board cell', () => {
		const game = new Game();
		const move = { from: game.player1.pool.stacks[0].index, to: game.board.stacks[0][0].index };
		expect(isLeapMove(game, move)).toBe(false);
	});

	it('is 0 for pool → covering own piece', () => {
		const game = new Game();
		game.makeMove(game.player1.pool.stacks[0], game.board.stacks[0][0]);
		game.makeMove(game.player2.pool.stacks[0], game.board.stacks[1][0]);
		expect(game.currentTurn).toBe(game.player1);
		// Stack larger P1 pool piece on own smaller piece at (0,0)
		const move = { from: game.player1.pool.stacks[0].index, to: game.board.stacks[0][0].index };
		expect(isLeapMove(game, move)).toBe(false);
	});

	it('is 0 when `from` is not the pool (e.g. board → board)', () => {
		const game = new Game();
		game.makeMove(game.player1.pool.stacks[0], game.board.stacks[0][0]);
		expect(game.currentTurn).toBe(game.player2);
		const move = { from: game.board.stacks[0][0].index, to: game.board.stacks[0][1].index };
		expect(isLeapMove(game, move)).toBe(false);
	});
});
