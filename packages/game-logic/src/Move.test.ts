import { beforeEach, describe, expect, it } from 'vitest';
import { Game } from './Game';
import { InvalidMoveError, Move } from './Move';
import { Piece, PieceSize } from './Piece';

describe('Move', () => {
	let game: Game;

	beforeEach(() => {
		game = new Game();
	});

	function isValid(move: Move) {
		return move.isValid().isValid;
	}

	describe('basic validation', () => {
		it('only allows moves by player that has current turn', () => {
			const move = new Move(game.player1, game.player1.pool.stacks[0], game.board.stacks[0][0]);

			expect(game.currentTurn).toEqual(game.player1);
			expect(move.isValid()).toEqual({ isValid: true, errors: [] });

			game.currentTurn = game.player2;
			expect(move.isValid()).toEqual({
				isValid: false,
				errors: ["not the current player's turn"]
			});
		});

		it('requires a piece to move', () => {
			// Create an empty stack
			const emptyStack = game.board.stacks[0][0];
			const move = new Move(game.player1, emptyStack, game.board.stacks[0][1]);

			expect(move.piece()).toBeUndefined();
			expect(move.isValid()).toEqual({ isValid: false, errors: ['no piece on from stack'] });
		});

		it('validates piece belongs to moving player', () => {
			// Place player1's piece on board
			game.makeMove(game.player1.pool.stacks[0], game.board.stacks[0][0]);

			// Try to move player1's piece as player2
			const move = new Move(game.player2, game.board.stacks[0][0], game.board.stacks[0][1]);

			expect(move.isValid()).toEqual({
				isValid: false,
				errors: ["not the current player's turn"]
			});
		});

		it('validates destination can accept the piece', () => {
			const largePiece = new Piece(game.player1, PieceSize.Four, game.board.stacks[0][1]);
			game.board.stacks[0][1].addPiece(largePiece);
			// Drain top Four from pool so the moving piece is Three (smaller than Four on board)
			game.makeMove(game.player1.pool.stacks[0], game.board.stacks[0][2]);
			game.makeMove(game.player2.pool.stacks[0], game.board.stacks[1][0]);

			const move = new Move(
				game.player1,
				game.player1.pool.stacks[0],
				game.board.stacks[0][1]
			);

			expect(move.isValid()).toEqual({
				isValid: false,
				errors: ['destination cannot accept piece']
			});
		});

		it('rejects stacking on same-sized piece when destination is occupied', () => {
			const top = new Piece(game.player1, PieceSize.Three, game.board.stacks[0][1]);
			game.board.stacks[0][1].addPiece(top);
			game.makeMove(game.player1.pool.stacks[0], game.board.stacks[0][2]);
			game.makeMove(game.player2.pool.stacks[0], game.board.stacks[1][0]);

			const move = new Move(
				game.player1,
				game.player1.pool.stacks[0],
				game.board.stacks[0][1]
			);

			expect(move.isValid()).toEqual({
				isValid: false,
				errors: ['cannot stack on a piece of the same size']
			});
		});
	});

	describe('pool to board moves', () => {
		it('allows moves to empty board spaces', () => {
			const move = new Move(game.player1, game.player1.pool.stacks[0], game.board.stacks[1][1]);

			expect(game.board.stacks[1][1].isEmpty()).toBe(true);
			expect(isValid(move)).toBe(true);
		});

		it('blocks pool moves onto opponent smaller piece without three-in-a-row cover', () => {
			// P2 has Three on (0,0); P1 can legally stack Four from another pool stack on top.
			game.makeMove(game.player1.pool.stacks[0], game.board.stacks[0][2]);
			game.makeMove(game.player2.pool.stacks[0], game.board.stacks[0][1]);
			game.makeMove(game.player1.pool.stacks[0], game.board.stacks[0][3]);
			game.makeMove(game.player2.pool.stacks[0], game.board.stacks[0][0]);

			const move = new Move(
				game.player1,
				game.player1.pool.stacks[1],
				game.board.stacks[0][0]
			);

			const result = move.isValid();
			expect(result.isValid).toBe(false);
			expect(result.errors[0]).toBe(
				'pool moves cannot cover an opponent piece unless it completes the three-in-a-row cover rule'
			);
		});

		it('allows pool moves onto own smaller piece (normal stacking)', () => {
			// (0,2) ends with P1 Two on top; P1 pool[1] top is Four — stack on own piece.
			game.makeMove(game.player1.pool.stacks[0], game.board.stacks[0][2]);
			game.makeMove(game.player2.pool.stacks[0], game.board.stacks[1][0]);
			game.makeMove(game.player1.pool.stacks[0], game.board.stacks[0][3]);
			game.makeMove(game.player2.pool.stacks[0], game.board.stacks[1][1]);
			game.makeMove(game.board.stacks[0][2], game.board.stacks[0][3]);
			game.makeMove(game.player2.pool.stacks[0], game.board.stacks[1][2]);
			game.makeMove(game.player1.pool.stacks[0], game.board.stacks[0][2]);
			game.makeMove(game.player2.pool.stacks[0], game.board.stacks[1][3]);
			game.makeMove(game.player1.pool.stacks[0], game.board.stacks[0][1]);
			game.makeMove(game.player2.pool.stacks[1], game.board.stacks[2][0]);

			const move = new Move(game.player1, game.player1.pool.stacks[1], game.board.stacks[0][2]);

			expect(isValid(move)).toBe(true);
		});

		it('allows covering opponent pieces when they have three in a row', () => {
			// Set up opponent's three in a row
			const moves = [
				{ from: 16, to: 0 }, // player1 to board[0][0]
				{ from: 19, to: 4 }, // player2 to board[1][0]
				{ from: 16, to: 1 }, // player1 to board[0][1]
				{ from: 19, to: 5 }, // player2 to board[1][1]
				{ from: 16, to: 2 }, // player1 to board[0][2]
				{ from: 19, to: 6 } // player2 to board[1][2] - now has 3 in a row
			];

			game = Game.deserialize(moves);

			// Should allow covering one of the three pieces
			const move = new Move(
				game.player1,
				game.player1.pool.stacks[1],
				game.board.stacks[1][2] // Cover the third piece in player2's row
			);

			expect(move.coversOneOfThree()).toBe(true);
			expect(isValid(move)).toBe(true);
		});
	});

	describe('board to board moves', () => {
		it('allows any valid board to board move', () => {
			// Place a piece on the board first
			game.makeMove(game.player1.pool.stacks[0], game.board.stacks[0][0]);

			// Switch to player2
			expect(game.currentTurn).toBe(game.player2);

			// Player2 makes a move
			game.makeMove(game.player2.pool.stacks[0], game.board.stacks[1][0]);

			// Now player1 can move their piece
			expect(game.currentTurn).toBe(game.player1);

			const move = new Move(game.player1, game.board.stacks[0][0], game.board.stacks[0][1]);

			expect(isValid(move)).toBe(true);
		});

		it('allows board to board moves to occupied spaces (if size allows)', () => {
			// Place small piece
			game.makeMove(game.player1.pool.stacks[0], game.board.stacks[0][0]); // size 3 piece
			// Player 2 turn
			game.makeMove(game.player2.pool.stacks[0], game.board.stacks[1][0]); // size 3 piece

			// Player 1 can move their board piece on top of a smaller piece
			// First we need to get a smaller piece on the board
			game.makeMove(game.player1.pool.stacks[0], game.board.stacks[0][1]); // size 2 piece
			game.makeMove(game.player2.pool.stacks[0], game.board.stacks[1][1]); // size 2 piece

			// Now move the larger piece on top
			const move = new Move(
				game.player1,
				game.board.stacks[0][0], // size 3 piece
				game.board.stacks[0][1] // onto size 2 piece
			);

			expect(isValid(move)).toBe(true);
		});

		it('prevents board to board moves to spaces with larger pieces', () => {
			// Setup: place large piece first, then small piece
			game.makeMove(game.player1.pool.stacks[0], game.board.stacks[0][0]); // size 3 piece
			game.makeMove(game.player2.pool.stacks[0], game.board.stacks[1][0]); // player2 move

			game.makeMove(game.player1.pool.stacks[0], game.board.stacks[0][1]); // size 2 piece
			game.makeMove(game.player2.pool.stacks[0], game.board.stacks[1][1]); // player2 move

			// Try to move smaller piece onto larger piece
			const move = new Move(
				game.player1,
				game.board.stacks[0][1], // size 2 piece
				game.board.stacks[0][0] // onto size 3 piece
			);

			expect(isValid(move)).toBe(false);
		});

		it('prevents stacking on a piece of the same size (any owner)', () => {
			game.makeMove(game.player1.pool.stacks[0], game.board.stacks[0][0]);
			game.makeMove(game.player2.pool.stacks[0], game.board.stacks[1][0]);
			game.makeMove(game.player1.pool.stacks[1], game.board.stacks[0][1]);
			game.makeMove(game.player2.pool.stacks[0], game.board.stacks[1][1]);

			const move = new Move(game.player1, game.board.stacks[0][0], game.board.stacks[0][1]);

			expect(move.isValid()).toEqual({
				isValid: false,
				errors: ['cannot stack on a piece of the same size']
			});
		});
	});

	describe('three-in-a-row detection', () => {
		it('detects horizontal three-in-a-row', () => {
			const moves = [
				{ from: 16, to: 0 }, // player1 (0,0)
				{ from: 19, to: 4 }, // player2 (1,0)
				{ from: 16, to: 1 }, // player1 (0,1)
				{ from: 19, to: 5 }, // player2 (1,1)
				{ from: 16, to: 2 } // player1 (0,2) - now has 3 horizontal
			];

			game = Game.deserialize(moves);

			const move = new Move(
				game.player2,
				game.player2.pool.stacks[1],
				game.board.stacks[0][1] // Cover middle of player1's three
			);

			expect(move.coversOneOfThree()).toBe(true);
		});

		it('detects vertical three-in-a-row', () => {
			const moves = [
				{ from: 16, to: 0 }, // player1 (0,0)
				{ from: 19, to: 1 }, // player2 (0,1)
				{ from: 16, to: 4 }, // player1 (1,0)
				{ from: 19, to: 5 }, // player2 (1,1)
				{ from: 16, to: 8 } // player1 (2,0) - now has 3 vertical
			];

			game = Game.deserialize(moves);

			const move = new Move(
				game.player2,
				game.player2.pool.stacks[1],
				game.board.stacks[1][0] // Cover middle of player1's three
			);

			expect(move.coversOneOfThree()).toBe(true);
		});

		it('detects diagonal three-in-a-row', () => {
			const moves = [
				{ from: 16, to: 0 }, // player1 (0,0)
				{ from: 19, to: 1 }, // player2 (0,1)
				{ from: 16, to: 5 }, // player1 (1,1)
				{ from: 19, to: 2 }, // player2 (0,2)
				{ from: 16, to: 10 } // player1 (2,2) - now has 3 diagonal
			];

			game = Game.deserialize(moves);

			const move = new Move(
				game.player2,
				game.player2.pool.stacks[1],
				game.board.stacks[1][1] // Cover middle of player1's diagonal
			);

			expect(move.coversOneOfThree()).toBe(true);
		});

		it('does not detect two-in-a-row as three-in-a-row', () => {
			const moves = [
				{ from: 16, to: 0 }, // player1 (0,0)
				{ from: 19, to: 4 }, // player2 (1,0)
				{ from: 16, to: 1 }, // player1 (0,1) - only 2 in a row
				{ from: 19, to: 5 } // player2 (1,1)
			];

			game = Game.deserialize(moves);

			const move = new Move(
				game.player1,
				game.player1.pool.stacks[1],
				game.board.stacks[1][0] // Try to cover player2's piece
			);

			expect(move.coversOneOfThree()).toBe(false);
		});
	});

	describe('move execution', () => {
		it('performs valid move correctly', () => {
			const fromStack = game.player1.pool.stacks[0];
			const toStack = game.board.stacks[0][0];
			const piece = fromStack.topPiece();

			const move = new Move(game.player1, fromStack, toStack);

			expect(fromStack.pieces.length).toBe(4);
			expect(toStack.pieces.length).toBe(0);

			move.perform();

			expect(fromStack.pieces.length).toBe(3);
			expect(toStack.pieces.length).toBe(1);
			expect(toStack.topPiece()).toBe(piece);
		});

		it('updates moved piece stack reference', () => {
			const fromStack = game.player1.pool.stacks[0];
			const toStack = game.board.stacks[0][0];
			const piece = fromStack.topPiece();

			const move = new Move(game.player1, fromStack, toStack);
			move.perform();

			expect(piece?.stack).toBe(toStack);
		});

		it('throws error when performing invalid move with validation', () => {
			game.currentTurn = game.player2; // Wrong player

			const move = new Move(game.player1, game.player1.pool.stacks[0], game.board.stacks[0][0]);

			expect(() => move.perform(true)).toThrow(InvalidMoveError);
		});

		it('performs invalid move when validation is disabled', () => {
			game.currentTurn = game.player2; // Wrong player

			const move = new Move(game.player1, game.player1.pool.stacks[0], game.board.stacks[0][0]);

			expect(() => move.perform(false)).not.toThrow();
		});

		it('correctly identifies the piece being moved', () => {
			const stack = game.player1.pool.stacks[0];
			const expectedPiece = stack.topPiece();

			const move = new Move(game.player1, stack, game.board.stacks[0][0]);

			expect(move.piece()).toBe(expectedPiece);
		});
	});

	describe('edge cases', () => {
		it('handles moves with no piece on from stack', () => {
			const emptyStack = game.board.stacks[2][2];
			const move = new Move(game.player1, emptyStack, game.board.stacks[0][0]);

			expect(move.piece()).toBeUndefined();
			expect(move.isValid()).toEqual({ isValid: false, errors: ['no piece on from stack'] });
		});

		it('handles move to same stack', () => {
			const stack = game.player1.pool.stacks[0];
			const move = new Move(game.player1, stack, stack);

			expect(move.isValid()).toEqual({ isValid: false, errors: ['cannot move to the same stack'] });
		});
	});
});
