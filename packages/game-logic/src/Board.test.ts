import { beforeEach, describe, expect, it } from "vitest";
import { type Board, BoardLine, BoardLineType } from "./Board";
import { Game } from "./Game";
import { Piece, PieceSize } from "./Piece";
import type { Stack } from "./Stack";

describe("Board", () => {
	let game: Game;
	let board: Board;

	beforeEach(() => {
		game = new Game();
		board = game.board;
	});

	describe("construction", () => {
		it("creates 4x4 grid of stacks", () => {
			expect(board.stacks.length).toBe(4);
			for (const row of board.stacks) {
				expect(row.length).toBe(4);
			}
		});

		it("all board positions are empty initially", () => {
			for (let row = 0; row < 4; row++) {
				for (let col = 0; col < 4; col++) {
					expect(board.stacks[row][col].isEmpty()).toBe(true);
				}
			}
		});

		it("registers all board stacks with game", () => {
			// Should have 16 board stacks + 6 pool stacks (3 per player)
			const boardStackCount = 16;
			const poolStackCount = 6;
			expect(game.stacks.length).toBe(boardStackCount + poolStackCount);
		});
	});

	describe("lines generation", () => {
		it("generates 4 horizontal lines", () => {
			const horizontalLines = board.horizontalLines();
			expect(horizontalLines.length).toBe(4);

			// Check each horizontal line contains correct stacks
			for (let row = 0; row < 4; row++) {
				const line = horizontalLines[row];
				expect(line.stacks.length).toBe(4);
				for (let col = 0; col < 4; col++) {
					expect(line.stacks[col]).toBe(board.stacks[row][col]);
				}
			}
		});

		it("generates 4 vertical lines", () => {
			const verticalLines = board.verticalLines();
			expect(verticalLines.length).toBe(4);

			// Check each vertical line contains correct stacks
			for (let col = 0; col < 4; col++) {
				const line = verticalLines[col];
				expect(line.stacks.length).toBe(4);
				for (let row = 0; row < 4; row++) {
					expect(line.stacks[row]).toBe(board.stacks[row][col]);
				}
			}
		});

		it("generates 2 diagonal lines", () => {
			const diagonalLines = board.diagonalLines();
			expect(diagonalLines.length).toBe(2);

			// Main diagonal (top-left to bottom-right)
			const mainDiagonal = diagonalLines[0];
			expect(mainDiagonal.stacks.length).toBe(4);
			for (let i = 0; i < 4; i++) {
				expect(mainDiagonal.stacks[i]).toBe(board.stacks[i][i]);
			}

			// Anti-diagonal (top-right to bottom-left)
			const antiDiagonal = diagonalLines[1];
			expect(antiDiagonal.stacks.length).toBe(4);
			for (let i = 0; i < 4; i++) {
				expect(antiDiagonal.stacks[i]).toBe(board.stacks[3 - i][i]);
			}
		});

		it("generates all 10 possible winning lines", () => {
			const allLines = board.lines();
			expect(allLines.length).toBe(10); // 4 horizontal + 4 vertical + 2 diagonal
		});

		it("all lines contain exactly 4 stacks", () => {
			for (const line of board.lines()) {
				expect(line.stacks.length).toBe(4);
			}
		});

		it("assigns correct line types", () => {
			const horizontalLines = board.horizontalLines();
			const verticalLines = board.verticalLines();
			const diagonalLines = board.diagonalLines();

			// Check horizontal line types
			expect(horizontalLines[0].type).toBe(BoardLineType.outer); // Top row
			expect(horizontalLines[1].type).toBe(BoardLineType.inner); // Second row
			expect(horizontalLines[2].type).toBe(BoardLineType.inner); // Third row
			expect(horizontalLines[3].type).toBe(BoardLineType.outer); // Bottom row

			// Check vertical line types
			expect(verticalLines[0].type).toBe(BoardLineType.outer); // Left column
			expect(verticalLines[1].type).toBe(BoardLineType.inner); // Second column
			expect(verticalLines[2].type).toBe(BoardLineType.inner); // Third column
			expect(verticalLines[3].type).toBe(BoardLineType.outer); // Right column

			// Check diagonal line types
			for (const line of diagonalLines) {
				expect(line.type).toBe(BoardLineType.diagonal);
			}
		});
	});

	describe("winner detection", () => {
		it("returns undefined when no winner exists", () => {
			expect(board.winner()).toBeUndefined();
		});

		it("returns undefined when board is empty", () => {
			expect(board.winner()).toBeUndefined();
		});

		it("detects horizontal winner", () => {
			// Place player1 pieces in top row
			for (let col = 0; col < 4; col++) {
				const piece = new Piece(
					game.player1,
					PieceSize.One,
					board.stacks[0][col],
				);
				board.stacks[0][col].addPiece(piece);
			}

			expect(board.winner()).toBe(game.player1);
		});

		it("detects vertical winner", () => {
			// Place player2 pieces in left column
			for (let row = 0; row < 4; row++) {
				const piece = new Piece(
					game.player2,
					PieceSize.Two,
					board.stacks[row][0],
				);
				board.stacks[row][0].addPiece(piece);
			}

			expect(board.winner()).toBe(game.player2);
		});

		it("detects main diagonal winner", () => {
			// Place player1 pieces on main diagonal
			for (let i = 0; i < 4; i++) {
				const piece = new Piece(
					game.player1,
					PieceSize.Three,
					board.stacks[i][i],
				);
				board.stacks[i][i].addPiece(piece);
			}

			expect(board.winner()).toBe(game.player1);
		});

		it("detects anti-diagonal winner", () => {
			// Place player2 pieces on anti-diagonal
			for (let i = 0; i < 4; i++) {
				const piece = new Piece(
					game.player2,
					PieceSize.Four,
					board.stacks[3 - i][i],
				);
				board.stacks[3 - i][i].addPiece(piece);
			}

			expect(board.winner()).toBe(game.player2);
		});

		it("returns first winner found when multiple players have winning lines", () => {
			// Player1 gets top row
			for (let col = 0; col < 4; col++) {
				const piece = new Piece(
					game.player1,
					PieceSize.One,
					board.stacks[0][col],
				);
				board.stacks[0][col].addPiece(piece);
			}

			// Player2 gets bottom row
			for (let col = 0; col < 4; col++) {
				const piece = new Piece(
					game.player2,
					PieceSize.One,
					board.stacks[3][col],
				);
				board.stacks[3][col].addPiece(piece);
			}

			// Current implementation returns first winner found
			expect(board.winner()).toBe(game.player1);
		});

		it("detects winner even with mixed pieces on some lines", () => {
			// Player1 gets top row (all 4 positions)
			for (let col = 0; col < 4; col++) {
				const piece = new Piece(
					game.player1,
					PieceSize.One,
					board.stacks[0][col],
				);
				board.stacks[0][col].addPiece(piece);
			}

			// Add some player2 pieces elsewhere
			const piece2 = new Piece(game.player2, PieceSize.Two, board.stacks[1][1]);
			board.stacks[1][1].addPiece(piece2);

			// Player1 should still win
			expect(board.winner()).toBe(game.player1);
		});

		it("only considers top pieces for winner detection", () => {
			// Place player2 pieces in bottom layer of top row
			for (let col = 0; col < 4; col++) {
				const bottomPiece = new Piece(
					game.player2,
					PieceSize.One,
					board.stacks[0][col],
				);
				board.stacks[0][col].addPiece(bottomPiece);
			}

			// Cover 3 of them with player1 pieces
			for (let col = 0; col < 3; col++) {
				const topPiece = new Piece(
					game.player1,
					PieceSize.Two,
					board.stacks[0][col],
				);
				board.stacks[0][col].addPiece(topPiece);
			}

			// No winner (player1 has 3 in a row, player2 has 1)
			expect(board.winner()).toBeUndefined();
		});
	});
});

describe("BoardLine", () => {
	let game: Game;
	let stacks: Stack[];

	beforeEach(() => {
		game = new Game();
		// Get some board stacks for testing
		stacks = [
			game.board.stacks[0][0],
			game.board.stacks[0][1],
			game.board.stacks[0][2],
			game.board.stacks[0][3],
		];
	});

	describe("winner detection", () => {
		it("returns undefined for empty line", () => {
			const line = new BoardLine(stacks, BoardLineType.outer);
			expect(line.winningPlayer()).toBeUndefined();
		});

		it("returns undefined for mixed player line", () => {
			const line = new BoardLine(stacks, BoardLineType.outer);

			// Place different players' pieces
			const piece1 = new Piece(game.player1, PieceSize.One, stacks[0]);
			const piece2 = new Piece(game.player2, PieceSize.One, stacks[1]);
			stacks[0].addPiece(piece1);
			stacks[1].addPiece(piece2);

			expect(line.winningPlayer()).toBeUndefined();
		});

		it("returns undefined for incomplete line", () => {
			const line = new BoardLine(stacks, BoardLineType.outer);

			// Place pieces in only 3 positions
			for (let i = 0; i < 3; i++) {
				const piece = new Piece(game.player1, PieceSize.One, stacks[i]);
				stacks[i].addPiece(piece);
			}

			expect(line.winningPlayer()).toBeUndefined();
		});

		it("detects complete line winner", () => {
			const line = new BoardLine(stacks, BoardLineType.outer);

			// Place player1 pieces in all positions
			for (let i = 0; i < 4; i++) {
				const piece = new Piece(game.player1, PieceSize.One, stacks[i]);
				stacks[i].addPiece(piece);
			}

			expect(line.winningPlayer()).toBe(game.player1);
		});

		it("only considers top pieces", () => {
			const line = new BoardLine(stacks, BoardLineType.outer);

			// Place player2 pieces at bottom
			for (let i = 0; i < 4; i++) {
				const bottomPiece = new Piece(game.player2, PieceSize.One, stacks[i]);
				stacks[i].addPiece(bottomPiece);
			}

			// Cover first 3 with player1 pieces
			for (let i = 0; i < 3; i++) {
				const topPiece = new Piece(game.player1, PieceSize.Two, stacks[i]);
				stacks[i].addPiece(topPiece);
			}

			// No winner (3 player1, 1 player2 on top)
			expect(line.winningPlayer()).toBeUndefined();
		});
	});

	describe("three-in-a-row coverage detection", () => {
		it("detects coverage of middle piece in three-in-a-row", () => {
			const line = new BoardLine(stacks, BoardLineType.outer);

			// Set up three in a row for player2
			const pieces = [
				new Piece(game.player2, PieceSize.One, stacks[0]),
				new Piece(game.player2, PieceSize.One, stacks[1]),
				new Piece(game.player2, PieceSize.One, stacks[2]),
			];

			pieces.forEach((piece, i) => {
				stacks[i].addPiece(piece);
			});

			// Mock game currentTurn to be player1
			game.currentTurn = game.player1;

			// Should detect that covering middle position (index 1) covers one of three
			expect(line.coversOneOfThree(stacks[1])).toBe(true);
		});

		it("detects coverage of edge piece in three-in-a-row", () => {
			const line = new BoardLine(stacks, BoardLineType.outer);

			// Set up three in a row: positions 1, 2, 3
			for (let i = 1; i < 4; i++) {
				const piece = new Piece(game.player2, PieceSize.One, stacks[i]);
				stacks[i].addPiece(piece);
			}

			game.currentTurn = game.player1;

			// Should detect that covering edge position covers one of three
			expect(line.coversOneOfThree(stacks[1])).toBe(true);
			expect(line.coversOneOfThree(stacks[3])).toBe(true);
		});

		it("does not detect coverage when no three-in-a-row exists", () => {
			const line = new BoardLine(stacks, BoardLineType.outer);

			// Set up only two in a row
			for (let i = 0; i < 2; i++) {
				const piece = new Piece(game.player2, PieceSize.One, stacks[i]);
				stacks[i].addPiece(piece);
			}

			game.currentTurn = game.player1;

			expect(line.coversOneOfThree(stacks[0])).toBe(false);
			expect(line.coversOneOfThree(stacks[1])).toBe(false);
		});

		it("does not detect coverage of own pieces", () => {
			const line = new BoardLine(stacks, BoardLineType.outer);

			// Set up three in a row for player1
			for (let i = 0; i < 3; i++) {
				const piece = new Piece(game.player1, PieceSize.One, stacks[i]);
				stacks[i].addPiece(piece);
			}

			game.currentTurn = game.player1;

			// Should not allow covering own pieces
			expect(line.coversOneOfThree(stacks[1])).toBe(false);
		});

		it("does not detect coverage when stack is empty", () => {
			const line = new BoardLine(stacks, BoardLineType.outer);

			game.currentTurn = game.player1;

			// Empty stack cannot be covered
			expect(line.coversOneOfThree(stacks[0])).toBe(false);
		});

		it("handles invalid stack not in line", () => {
			const line = new BoardLine(stacks, BoardLineType.outer);
			const otherStack = game.board.stacks[1][0]; // Not in this line

			expect(line.coversOneOfThree(otherStack)).toBe(false);
		});
	});

	describe("line types", () => {
		it("creates lines with correct types", () => {
			const outerLine = new BoardLine(stacks, BoardLineType.outer);
			const innerLine = new BoardLine(stacks, BoardLineType.inner);
			const diagonalLine = new BoardLine(stacks, BoardLineType.diagonal);

			expect(outerLine.type).toBe(BoardLineType.outer);
			expect(innerLine.type).toBe(BoardLineType.inner);
			expect(diagonalLine.type).toBe(BoardLineType.diagonal);
		});

		it("maintains reference to stacks", () => {
			const line = new BoardLine(stacks, BoardLineType.outer);

			expect(line.stacks).toBe(stacks);
			expect(line.stacks.length).toBe(4);
		});
	});
});
