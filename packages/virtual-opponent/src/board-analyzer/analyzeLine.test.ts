import { describe, expect, it } from 'vitest';
import { Game, type SerializedMove } from '@capstone/game-logic';
import { analyzeLine } from './analyzeLine';

function topRow(game: Game) {
	return game.board.horizontalLines()[0];
}

describe('analyzeLine', () => {
	it('returns zeros for an empty line', () => {
		const game = new Game();
		const line = topRow(game);
		expect(analyzeLine(line, game.player1)).toEqual({
			winner: 0,
			loser: 0,
			threeInRow: { player: 0, opponent: 0 },
			twoInRow: { player: 0, opponent: 0 }
		});
	});

	it('counts one triple and two pairs when P1 owns the first three cells of the row', () => {
		const moves: SerializedMove[] = [
			{ from: 16, to: 0 },
			{ from: 19, to: 4 },
			{ from: 16, to: 1 },
			{ from: 19, to: 5 },
			{ from: 16, to: 2 },
			{ from: 19, to: 6 }
		];
		const game = Game.deserialize(moves);
		const line = topRow(game);

		expect(analyzeLine(line, game.player1)).toEqual({
			winner: 0,
			loser: 0,
			threeInRow: { player: 1, opponent: 0 },
			twoInRow: { player: 2, opponent: 0 }
		});

		expect(analyzeLine(line, game.player2)).toEqual({
			winner: 0,
			loser: 0,
			threeInRow: { player: 0, opponent: 1 },
			twoInRow: { player: 0, opponent: 2 }
		});
	});

	it('returns winner and skips threat counts when the perspective player owns all four tops', () => {
		const game = new Game();
		game.makeMove(game.player1.pool.stacks[0], game.board.stacks[0][0]);
		game.makeMove(game.player2.pool.stacks[0], game.board.stacks[1][0]);
		game.makeMove(game.player1.pool.stacks[0], game.board.stacks[0][1]);
		game.makeMove(game.player2.pool.stacks[0], game.board.stacks[1][1]);
		game.makeMove(game.player1.pool.stacks[0], game.board.stacks[0][2]);
		game.makeMove(game.player2.pool.stacks[0], game.board.stacks[1][2]);
		game.makeMove(game.player1.pool.stacks[0], game.board.stacks[0][3]);
		const line = topRow(game);

		expect(analyzeLine(line, game.player1)).toEqual({
			winner: 1,
			loser: 0,
			threeInRow: { player: 0, opponent: 0 },
			twoInRow: { player: 0, opponent: 0 }
		});
	});

	it('returns loser and skips threat counts when the opponent owns all four tops', () => {
		const game = new Game();
		game.makeMove(game.player1.pool.stacks[0], game.board.stacks[0][0]);
		game.makeMove(game.player2.pool.stacks[0], game.board.stacks[1][0]);
		game.makeMove(game.player1.pool.stacks[0], game.board.stacks[0][1]);
		game.makeMove(game.player2.pool.stacks[0], game.board.stacks[1][1]);
		game.makeMove(game.player1.pool.stacks[0], game.board.stacks[0][2]);
		game.makeMove(game.player2.pool.stacks[0], game.board.stacks[1][2]);
		game.makeMove(game.player1.pool.stacks[0], game.board.stacks[0][3]);
		const line = topRow(game);

		expect(analyzeLine(line, game.player2)).toEqual({
			winner: 0,
			loser: 1,
			threeInRow: { player: 0, opponent: 0 },
			twoInRow: { player: 0, opponent: 0 }
		});
	});

	it('does not count mixed-owner windows', () => {
		const game = new Game();
		game.makeMove(game.player1.pool.stacks[0], game.board.stacks[0][0]);
		game.makeMove(game.player2.pool.stacks[0], game.board.stacks[0][1]);
		game.makeMove(game.player1.pool.stacks[0], game.board.stacks[0][2]);
		game.makeMove(game.player2.pool.stacks[0], game.board.stacks[0][3]);
		const line = topRow(game);

		expect(analyzeLine(line, game.player1)).toEqual({
			winner: 0,
			loser: 0,
			threeInRow: { player: 0, opponent: 0 },
			twoInRow: { player: 0, opponent: 0 }
		});
	});
});
