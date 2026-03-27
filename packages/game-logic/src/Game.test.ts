import { beforeEach, describe, expect, it } from 'vitest';
import { Game, type SerializedMove } from './Game';
import { InvalidMoveError } from './Move';
import { PieceSize } from './Piece';
import { PlayerColor } from './Player';
import { viewGameState } from './viewGameState';

/**
 * stack indexes
 *
 * board         p1   p2
 * _____________________
 * 0  1  2  3  | 16 | 19
 * 4  5  6  7  | 17 | 20
 * 8  9  10 11 | 18 | 21
 * 12 13 14 15
 */

describe('Game', () => {
	let game: Game;

	beforeEach(() => {
		game = new Game();
	});

	describe('initialization', () => {
		it('initializes the game with a board and players', () => {
			expect(viewGameState(game)).toMatchInlineSnapshot(`
        "
        X3||  |  |  |  ||O3
        X3||  |  |  |  ||O3
        X3||  |  |  |  ||O3
           |  |  |  |  |   
        "
      `);
		});

		it('creates two players with correct colors', () => {
			expect(game.player1.color).toBe(PlayerColor.Black);
			expect(game.player2.color).toBe(PlayerColor.White);
		});

		it('sets player1 as initial current turn', () => {
			expect(game.currentTurn).toBe(game.player1);
		});

		it('initializes empty moves array', () => {
			expect(game.moves).toEqual([]);
		});

		it('creates correct number of stacks', () => {
			// 16 board stacks + 6 pool stacks (3 per player)
			expect(game.stacks.length).toBe(22);
		});

		it('initializes board as 4x4 grid', () => {
			expect(game.board.stacks.length).toBe(4);
			for (const row of game.board.stacks) {
				expect(row.length).toBe(4);
			}
		});

		it('initializes each player with pool of 3 stacks', () => {
			expect(game.player1.pool.stacks.length).toBe(3);
			expect(game.player2.pool.stacks.length).toBe(3);
		});
	});

	describe('turn management', () => {
		it('alternates turns after each move', () => {
			expect(game.currentTurn).toBe(game.player1);

			game.makeMove(game.player1.pool.stacks[0], game.board.stacks[0][0]);
			expect(game.currentTurn).toBe(game.player2);

			game.makeMove(game.player2.pool.stacks[0], game.board.stacks[0][1]);
			expect(game.currentTurn).toBe(game.player1);
		});

		it('tracks move history', () => {
			game.makeMove(game.player1.pool.stacks[0], game.board.stacks[0][0]);
			game.makeMove(game.player2.pool.stacks[0], game.board.stacks[0][1]);

			expect(game.moves.length).toBe(2);
			expect(game.moves[0].player).toBe(game.player1);
			expect(game.moves[1].player).toBe(game.player2);
		});

		it('enforces turn order in makeMove', () => {
			// Player1's turn, but try to make move as player2
			expect(() => {
				game.makeMove(game.player2.pool.stacks[0], game.board.stacks[0][0]);
			}).toThrow(InvalidMoveError);
		});
	});

	describe('serialization', () => {
		it('serializes into a sequence of moves', () => {
			game.makeMove(game.player1.pool.stacks[0], game.board.stacks[1][1]);
			game.makeMove(game.player2.pool.stacks[0], game.board.stacks[2][1]);
			game.makeMove(game.player1.pool.stacks[0], game.board.stacks[1][2]);
			game.makeMove(game.player2.pool.stacks[0], game.board.stacks[2][2]);
			game.makeMove(game.board.stacks[1][1], game.board.stacks[2][2]);

			expect(viewGameState(game)).toMatchInlineSnapshot(`
        "
        X1||  |  |  |  ||O1
        X3||  |  |X2|  ||O3
        X3||  |O3|X3|  ||O3
           |  |  |  |  |   
        "
      `);

			expect(game.serialize()).toMatchInlineSnapshot(`
[
  {
    "from": 16,
    "to": 5,
  },
  {
    "from": 19,
    "to": 9,
  },
  {
    "from": 16,
    "to": 6,
  },
  {
    "from": 19,
    "to": 10,
  },
  {
    "from": 5,
    "to": 10,
  },
]
`);
		});

		it('serializes empty game correctly', () => {
			expect(game.serialize()).toEqual([]);
		});

		it('serializes single move correctly', () => {
			game.makeMove(game.player1.pool.stacks[0], game.board.stacks[0][0]);

			const serialized = game.serialize();
			expect(serialized.length).toBe(1);
			expect(serialized[0].from).toBe(16); // Player1's first pool stack
			expect(serialized[0].to).toBe(0); // Top-left board position
		});

		it('includes all move details in serialization', () => {
			game.makeMove(game.player1.pool.stacks[1], game.board.stacks[3][3]);

			const serialized = game.serialize();
			expect(serialized[0]).toEqual({
				from: 17, // Player1's second pool stack
				to: 15 // Bottom-right board position
			});
		});
	});

	describe('deserialization', () => {
		it('recreates game from move sequence', () => {
			const moves: SerializedMove[] = [
				{ from: 16, to: 0 },
				{ from: 19, to: 4 },
				{ from: 16, to: 1 }
			];

			const deserializedGame = Game.deserialize(moves);

			expect(deserializedGame.moves.length).toBe(3);
			expect(deserializedGame.currentTurn).toBe(deserializedGame.player2); // After 3 moves
		});

		it('recreates exact game state from serialization', () => {
			// Make some moves in original game
			game.makeMove(game.player1.pool.stacks[0], game.board.stacks[0][0]);
			game.makeMove(game.player2.pool.stacks[0], game.board.stacks[1][1]);
			game.makeMove(game.player1.pool.stacks[1], game.board.stacks[2][2]);

			const serialized = game.serialize();
			const deserializedGame = Game.deserialize(serialized);

			// Should have same visual state
			expect(viewGameState(deserializedGame)).toEqual(viewGameState(game));
			expect(deserializedGame.currentTurn).toBe(deserializedGame.player2);
		});

		it('handles empty move array', () => {
			const deserializedGame = Game.deserialize([]);

			expect(deserializedGame.moves.length).toBe(0);
			expect(deserializedGame.currentTurn).toBe(deserializedGame.player1);
			expect(viewGameState(deserializedGame)).toEqual(viewGameState(game));
		});

		it('deserializes without validation', () => {
			// Create invalid move sequence (same player moving twice)
			const invalidMoves: SerializedMove[] = [
				{ from: 16, to: 0 },
				{ from: 16, to: 1 } // Player1 moving again
			];

			// Should not throw error during deserialization
			expect(() => Game.deserialize(invalidMoves)).not.toThrow();
		});

		it('rejects out-of-range stack indexes', () => {
			const invalidMoves: SerializedMove[] = [{ from: 999, to: 0 }];
			expect(() => Game.deserialize(invalidMoves)).toThrow('stack index out of range');
		});

		it('rejects negative stack indexes', () => {
			const invalidMoves: SerializedMove[] = [{ from: -1, to: 0 }];
			expect(() => Game.deserialize(invalidMoves)).toThrow('stack index out of range');
		});

		it('rejects non-integer stack indexes', () => {
			const invalidMoves = [{ from: 16.5, to: 0 }] as SerializedMove[];
			expect(() => Game.deserialize(invalidMoves)).toThrow('stack indexes must be integers');
		});

		it('maintains move history after deserialization', () => {
			const moves: SerializedMove[] = [
				{ from: 16, to: 0 },
				{ from: 19, to: 4 }
			];

			const deserializedGame = Game.deserialize(moves);

			expect(deserializedGame.moves.length).toBe(2);
			expect(deserializedGame.moves[0].fromStack.index).toBe(16);
			expect(deserializedGame.moves[0].toStack.index).toBe(0);
			expect(deserializedGame.moves[1].fromStack.index).toBe(19);
			expect(deserializedGame.moves[1].toStack.index).toBe(4);
		});
	});

	describe('cloning', () => {
		it('creates identical game clone', () => {
			game.makeMove(game.player1.pool.stacks[0], game.board.stacks[0][0]);
			game.makeMove(game.player2.pool.stacks[0], game.board.stacks[1][1]);

			const clonedGame = game.clone();

			expect(viewGameState(clonedGame)).toEqual(viewGameState(game));
			expect(clonedGame.currentTurn.color).toBe(game.currentTurn.color);
			expect(clonedGame.moves.length).toBe(game.moves.length);
		});

		it('clone is independent from original', () => {
			const clonedGame = game.clone();

			// Make move in original
			game.makeMove(game.player1.pool.stacks[0], game.board.stacks[0][0]);

			// Clone should remain unchanged
			expect(game.moves.length).toBe(1);
			expect(clonedGame.moves.length).toBe(0);
			expect(viewGameState(clonedGame)).not.toEqual(viewGameState(game));
		});

		it('can continue playing from clone', () => {
			game.makeMove(game.player1.pool.stacks[0], game.board.stacks[0][0]);
			const clonedGame = game.clone();

			// Make move in clone
			clonedGame.makeMove(clonedGame.player2.pool.stacks[0], clonedGame.board.stacks[1][1]);

			expect(clonedGame.moves.length).toBe(2);
			expect(game.moves.length).toBe(1);
		});
	});

	describe('move validation', () => {
		it('validates moves by default', () => {
			// Try invalid move (wrong player)
			expect(() => {
				game.makeMove(game.player2.pool.stacks[0], game.board.stacks[0][0]);
			}).toThrow(InvalidMoveError);
		});

		it('can disable validation', () => {
			// Should not throw with validation disabled
			expect(() => {
				game.makeMove(game.player2.pool.stacks[0], game.board.stacks[0][0], false);
			}).not.toThrow();
		});

		it('enforces piece size rules', () => {
			// Place large piece first
			game.makeMove(game.player1.pool.stacks[0], game.board.stacks[0][0]);
			game.makeMove(game.player2.pool.stacks[0], game.board.stacks[1][0]);

			// Try to place smaller piece on larger (should fail)
			expect(() => {
				game.makeMove(game.player1.pool.stacks[0], game.board.stacks[0][0]);
			}).toThrow(InvalidMoveError);
		});
	});

	describe('integration scenarios', () => {
		it('handles complex game sequence', () => {
			const moves: SerializedMove[] = [
				{ from: 16, to: 0 }, // P1: pool[0] -> board[0][0]
				{ from: 19, to: 1 }, // P2: pool[0] -> board[0][1]
				{ from: 16, to: 4 }, // P1: pool[0] -> board[1][0]
				{ from: 19, to: 5 }, // P2: pool[0] -> board[1][1]
				{ from: 16, to: 8 }, // P1: pool[0] -> board[2][0]
				{ from: 19, to: 9 }, // P2: pool[0] -> board[2][1]
				{ from: 0, to: 12 } // P1: board[0][0] -> board[3][0] (vertical win)
			];

			const gameFromMoves = Game.deserialize(moves);
			expect(gameFromMoves.moves.length).toBe(7);
		});

		it('handles piece stacking scenarios', () => {
			// Create scenario with stacked pieces
			// First place pieces to set up a stacking scenario
			game.makeMove(game.player1.pool.stacks[0], game.board.stacks[0][0]); // Size 3 piece
			game.makeMove(game.player2.pool.stacks[0], game.board.stacks[1][0]); // P2 move

			game.makeMove(game.player1.pool.stacks[0], game.board.stacks[0][1]); // Size 2 piece
			game.makeMove(game.player2.pool.stacks[0], game.board.stacks[1][1]); // P2 move

			game.makeMove(game.player1.pool.stacks[0], game.board.stacks[0][2]); // Size 1 piece
			game.makeMove(game.player2.pool.stacks[0], game.board.stacks[1][2]); // P2 move

			game.makeMove(game.player1.pool.stacks[0], game.board.stacks[0][3]); // Size 0 piece
			game.makeMove(game.player2.pool.stacks[0], game.board.stacks[1][3]); // P2 move

			// Now move a larger piece (size 3) on top of smaller piece (size 0)
			game.makeMove(game.board.stacks[0][0], game.board.stacks[0][3]); // Size 3 onto size 0

			// Stack should have 2 pieces now
			expect(game.board.stacks[0][3].pieces.length).toBe(2);
		});
	});

	// it is not valid to move a piece from the pool over an opponent's on-board piece
	// unless one of the pieces being covered is one of three in a row
	describe('move from pool to cover piece exception', () => {
		let moves: SerializedMove[];
		let gameWithThreeInRow: Game;

		beforeEach(() => {
			moves = [
				{ from: 16, to: 0 }, // P1: top row left
				{ from: 19, to: 4 }, // P2: second row left
				{ from: 16, to: 1 }, // P1: top row middle
				{ from: 19, to: 5 }, // P2: second row middle
				{ from: 16, to: 2 }, // P1: top row right (3 in a row!)
				{ from: 19, to: 6 } // P2: second row right (3 in a row!)
			];
			gameWithThreeInRow = Game.deserialize(moves);
		});

		it('allows the exception', () => {
			gameWithThreeInRow.makeMove(
				gameWithThreeInRow.player1.pool.stacks[1],
				gameWithThreeInRow.board.stacks[1][2]
			);
			expect(viewGameState(gameWithThreeInRow)).toMatchInlineSnapshot(`
        "
        X0||X3|X2|X1|  ||O0
        X2||O3|O2|X3|  ||O3
        X3||  |  |  |  ||O3
           |  |  |  |  |   
        "
      `);
		});

		it('does not allow otherwise', () => {
			gameWithThreeInRow.makeMove(
				gameWithThreeInRow.player1.pool.stacks[0],
				gameWithThreeInRow.board.stacks[2][0]
			);
			expect(() =>
				gameWithThreeInRow.makeMove(
					gameWithThreeInRow.player2.pool.stacks[2],
					gameWithThreeInRow.board.stacks[2][0]
				)
			).toThrowError(InvalidMoveError);
			expect(viewGameState(gameWithThreeInRow)).toMatchInlineSnapshot(`
        "
          ||X3|X2|X1|  ||O0
        X3||O3|O2|O1|  ||O3
        X3||X0|  |  |  ||O3
           |  |  |  |  |   
        "
      `);
		});

		it('allows pool to empty space even with three in row', () => {
			// Should always allow pool to empty space
			expect(() => {
				gameWithThreeInRow.makeMove(
					gameWithThreeInRow.player1.pool.stacks[1],
					gameWithThreeInRow.board.stacks[3][3]
				);
			}).not.toThrow();
		});

		it('prevents pool to occupied space without three in row exception', () => {
			// Create game without three in row
			const simpleGame = new Game();
			simpleGame.makeMove(simpleGame.player1.pool.stacks[0], simpleGame.board.stacks[0][0]);
			simpleGame.makeMove(simpleGame.player2.pool.stacks[0], simpleGame.board.stacks[1][0]);

			// Try to cover opponent's piece from pool
			expect(() => {
				simpleGame.makeMove(simpleGame.player1.pool.stacks[1], simpleGame.board.stacks[1][0]);
			}).toThrow(InvalidMoveError);
		});
	});

	describe('edge cases', () => {
		it('handles games with no moves', () => {
			expect(game.serialize()).toEqual([]);
			expect(game.moves.length).toBe(0);
			expect(game.currentTurn).toBe(game.player1);
		});

		it('handles maximum stacking scenario', () => {
			// Create scenario where we can stack multiple pieces
			const targetStack = game.board.stacks[1][1];

			// First get all 4 sizes on the board from player1's pool
			game.makeMove(game.player1.pool.stacks[0], game.board.stacks[0][0]); // Size 3
			game.makeMove(game.player2.pool.stacks[0], game.board.stacks[2][0]); // P2 move

			game.makeMove(game.player1.pool.stacks[0], game.board.stacks[0][1]); // Size 2
			game.makeMove(game.player2.pool.stacks[0], game.board.stacks[2][1]); // P2 move

			game.makeMove(game.player1.pool.stacks[0], game.board.stacks[0][2]); // Size 1
			game.makeMove(game.player2.pool.stacks[0], game.board.stacks[2][2]); // P2 move

			game.makeMove(game.player1.pool.stacks[0], game.board.stacks[0][3]); // Size 0
			game.makeMove(game.player2.pool.stacks[0], game.board.stacks[2][3]); // P2 move

			// Now place the smallest piece (size 0) on target first
			game.makeMove(game.board.stacks[0][3], targetStack); // Size 0 to target
			game.makeMove(game.player2.pool.stacks[1], game.board.stacks[3][0]); // P2 move

			// Then stack larger pieces on top
			game.makeMove(game.board.stacks[0][2], targetStack); // Size 1 on size 0

			expect(targetStack.pieces.length).toBe(2);
			expect(targetStack.topPiece()?.size).toBe(PieceSize.Two); // Size 1 piece on top
		});

		it('maintains correct turn after invalid move attempt', () => {
			expect(game.currentTurn).toBe(game.player1);

			try {
				game.makeMove(game.player2.pool.stacks[0], game.board.stacks[0][0]);
			} catch (_e) {
				// Expected error
			}

			// Turn should remain unchanged after failed move
			expect(game.currentTurn).toBe(game.player1);
			expect(game.moves.length).toBe(0);
		});

		it('preserves game state during serialization roundtrip', () => {
			// Create complex game state
			game.makeMove(game.player1.pool.stacks[0], game.board.stacks[1][1]); // Size 3 piece
			game.makeMove(game.player2.pool.stacks[0], game.board.stacks[2][2]); // Size 3 piece

			// Use up some pieces to get smaller ones available
			game.makeMove(game.player1.pool.stacks[0], game.board.stacks[0][0]); // Size 2 piece
			game.makeMove(game.player2.pool.stacks[0], game.board.stacks[3][3]); // Size 2 piece

			// Now stack a larger piece (size 3) on a smaller piece (size 2)
			game.makeMove(game.board.stacks[1][1], game.board.stacks[0][0]); // Size 3 on Size 2

			const originalState = viewGameState(game);
			const serialized = game.serialize();
			const restored = Game.deserialize(serialized);

			expect(viewGameState(restored)).toEqual(originalState);
			expect(restored.currentTurn.color).toBe(game.currentTurn.color);
		});
	});
});
