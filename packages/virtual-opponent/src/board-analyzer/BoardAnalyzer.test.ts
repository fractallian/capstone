import { describe, expect, it } from 'vitest';
import { Game, type Player, type SerializedMove } from '@capstone/game-logic';
import { BoardAnalyzer } from './BoardAnalyzer';
import { analyzeLine } from './analyzeLine';

/** Mirrors `BoardAnalyzer.analyze()` aggregation (same line order, same early exit on win or loss lines). */
function aggregateThreats(game: Game, player: Player) {
	const threeInRow = { player: 0, opponent: 0 };
	let winner: boolean | undefined;
	let wouldLose: boolean | undefined;
	for (const line of game.board.lines()) {
		const analysis = analyzeLine(line, player);
		if (analysis.winner) {
			winner = true;
			break;
		}
		if (analysis.loser) {
			wouldLose = true;
			break;
		}
		threeInRow.player += analysis.threeInRow.player;
		threeInRow.opponent += analysis.threeInRow.opponent;
	}
	return { threeInRow, winner, wouldLose };
}

function negatedOpponentLineScore(opponentSum: number) {
	return opponentSum === 0 ? 0 : -opponentSum;
}

describe('BoardAnalyzer', () => {
	it('aggregates threeInRow / twoInRow across all lines like the reference helper', () => {
		const moves: SerializedMove[] = [
			{ from: 16, to: 0 },
			{ from: 19, to: 4 },
			{ from: 16, to: 1 },
			{ from: 19, to: 5 },
			{ from: 16, to: 2 },
			{ from: 19, to: 6 }
		];
		const game = Game.deserialize(moves);
		const expected = aggregateThreats(game, game.player1);

		const analyzer = new BoardAnalyzer(game, game.player1);
		analyzer.analyze();

		expect(analyzer.cache.threeInRow).toEqual(expected.threeInRow);
		expect(analyzer.twoInRow()).toBe(negatedOpponentLineScore(expected.threeInRow.opponent));
		expect(expected.winner).toBeUndefined();
	});

	it('starts at zero threat counts on an empty board', () => {
		const game = new Game();
		const analyzer = new BoardAnalyzer(game, game.currentTurn);
		analyzer.analyze();

		expect(analyzer.cache.threeInRow).toEqual({ player: 0, opponent: 0 });
		expect(analyzer.twoInRow()).toBe(0);
	});

	it('does not set cache.winner when the opponent has a full line but perspective is the other player', () => {
		const game = new Game();
		game.makeMove(game.player1.pool.stacks[0], game.board.stacks[0][0]);
		game.makeMove(game.player2.pool.stacks[0], game.board.stacks[1][0]);
		game.makeMove(game.player1.pool.stacks[0], game.board.stacks[0][1]);
		game.makeMove(game.player2.pool.stacks[0], game.board.stacks[1][1]);
		game.makeMove(game.player1.pool.stacks[0], game.board.stacks[0][2]);
		game.makeMove(game.player2.pool.stacks[0], game.board.stacks[1][2]);
		game.makeMove(game.player1.pool.stacks[0], game.board.stacks[0][3]);

		const analyzer = new BoardAnalyzer(game, game.player2);
		analyzer.analyze();

		expect(analyzer.cache.winner).toBe(false);
		expect(analyzer.cache.wouldLose).toBe(true);
		const expected = aggregateThreats(game, game.player2);
		expect(analyzer.cache.threeInRow).toEqual(expected.threeInRow);
		expect(analyzer.twoInRow()).toBe(negatedOpponentLineScore(expected.threeInRow.opponent));
		expect(expected.wouldLose).toBe(true);
	});

	it('stops on the first line where the current player owns all four tops and leaves threat sums at prior totals', () => {
		const game = new Game();
		game.makeMove(game.player1.pool.stacks[0], game.board.stacks[0][0]);
		game.makeMove(game.player2.pool.stacks[0], game.board.stacks[1][0]);
		game.makeMove(game.player1.pool.stacks[0], game.board.stacks[0][1]);
		game.makeMove(game.player2.pool.stacks[0], game.board.stacks[1][1]);
		game.makeMove(game.player1.pool.stacks[0], game.board.stacks[0][2]);
		game.makeMove(game.player2.pool.stacks[0], game.board.stacks[1][2]);
		game.makeMove(game.player1.pool.stacks[0], game.board.stacks[0][3]);

		const analyzerP1 = new BoardAnalyzer(game, game.player1);
		analyzerP1.analyze();

		expect(analyzerP1.cache.winner).toBe(true);
		expect(analyzerP1.cache.threeInRow).toEqual({ player: 0, opponent: 0 });
		expect(analyzerP1.twoInRow()).toBe(0);
	});

	it('uses the constructor player as the perspective (not game.currentTurn)', () => {
		const moves: SerializedMove[] = [{ from: 16, to: 0 }];
		const game = Game.deserialize(moves);
		expect(game.currentTurn).toBe(game.player2);

		const analyzerAsP1 = new BoardAnalyzer(game, game.player1);
		expect(analyzerAsP1.player).toBe(game.player1);
		expect(analyzerAsP1.opponent).toBe(game.player2);
		analyzerAsP1.analyze();
		const expectedP1 = aggregateThreats(game, game.player1);
		expect(analyzerAsP1.cache.threeInRow).toEqual(expectedP1.threeInRow);
		expect(analyzerAsP1.twoInRow()).toBe(negatedOpponentLineScore(expectedP1.threeInRow.opponent));

		const analyzerAsP2 = new BoardAnalyzer(game, game.player2);
		expect(analyzerAsP2.player).toBe(game.player2);
		analyzerAsP2.analyze();
		const expectedP2 = aggregateThreats(game, game.player2);
		expect(analyzerAsP2.cache.threeInRow).toEqual(expectedP2.threeInRow);
		expect(analyzerAsP2.twoInRow()).toBe(negatedOpponentLineScore(expectedP2.threeInRow.opponent));
	});
});

describe('BoardAnalyzer.wouldLose', () => {
	it('returns 0 when the opponent already owns a full line (immediate loss line)', () => {
		const game = new Game();
		game.makeMove(game.player1.pool.stacks[0], game.board.stacks[0][0]);
		game.makeMove(game.player2.pool.stacks[0], game.board.stacks[1][0]);
		game.makeMove(game.player1.pool.stacks[0], game.board.stacks[0][1]);
		game.makeMove(game.player2.pool.stacks[0], game.board.stacks[1][1]);
		game.makeMove(game.player1.pool.stacks[0], game.board.stacks[0][2]);
		game.makeMove(game.player2.pool.stacks[0], game.board.stacks[1][2]);
		game.makeMove(game.player1.pool.stacks[0], game.board.stacks[0][3]);

		const analyzer = new BoardAnalyzer(game, game.player2);
		analyzer.analyze();

		expect(analyzer.wouldLose()).toBe(0);
	});

	it('returns 0 when the opponent can win in one legal move', () => {
		const game = new Game();
		game.makeMove(game.player1.pool.stacks[0], game.board.stacks[3][0]);
		game.makeMove(game.player2.pool.stacks[0], game.board.stacks[0][0]);
		game.makeMove(game.player1.pool.stacks[0], game.board.stacks[3][1]);
		game.makeMove(game.player2.pool.stacks[0], game.board.stacks[0][1]);
		game.makeMove(game.player1.pool.stacks[0], game.board.stacks[3][2]);
		game.makeMove(game.player2.pool.stacks[0], game.board.stacks[0][2]);
		game.makeMove(game.player1.pool.stacks[0], game.board.stacks[3][3]);

		expect(game.currentTurn).toBe(game.player2);
		const analyzer = new BoardAnalyzer(game, game.player1);
		analyzer.analyze();

		expect(analyzer.cache.wouldLose).toBe(false);
		expect(analyzer.wouldLose()).toBe(0);
	});

	it('returns 1 when it is the perspective player\'s turn (no opponent one-move simulation)', () => {
		const game = new Game();
		const analyzer = new BoardAnalyzer(game, game.player1);
		expect(game.currentTurn).toBe(game.player1);
		analyzer.analyze();
		expect(analyzer.wouldLose()).toBe(1);
	});

	it('returns 1 when it is the opponent\'s turn but they have no one-move win', () => {
		const game = new Game();
		game.makeMove(game.player1.pool.stacks[0], game.board.stacks[0][0]);
		expect(game.currentTurn).toBe(game.player2);

		const analyzer = new BoardAnalyzer(game, game.player1);
		analyzer.analyze();

		expect(analyzer.wouldLose()).toBe(1);
	});

	it('returns 1 on an empty board from either perspective when it is that player\'s turn', () => {
		const game = new Game();
		const a1 = new BoardAnalyzer(game, game.player1);
		a1.analyze();
		expect(a1.wouldLose()).toBe(1);

		const after = new Game();
		after.makeMove(after.player1.pool.stacks[0], after.board.stacks[0][0]);
		const a2 = new BoardAnalyzer(after, after.player2);
		a2.analyze();
		expect(a2.wouldLose()).toBe(1);
	});
});
