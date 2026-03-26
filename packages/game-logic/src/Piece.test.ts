import { beforeEach, describe, expect, it } from "vitest";
import { Game } from "./Game";
import { Piece, PieceSize } from "./Piece";
import { type Player, PlayerColor } from "./Player";
import { Stack, StackLocation } from "./Stack";

describe("Piece", () => {
	let game: Game;
	let player1: Player;
	let player2: Player;
	let stack: Stack;

	beforeEach(() => {
		game = new Game();
		player1 = game.player1;
		player2 = game.player2;
		stack = new Stack(game, StackLocation.board);
	});

	it("creates a piece with correct properties", () => {
		const piece = new Piece(player1, PieceSize.Three, stack);

		expect(piece.player).toBe(player1);
		expect(piece.size).toBe(PieceSize.Three);
		expect(piece.stack).toBe(stack);
	});

	it("has all valid piece sizes", () => {
		expect(PieceSize.One).toBe(0);
		expect(PieceSize.Two).toBe(1);
		expect(PieceSize.Three).toBe(2);
		expect(PieceSize.Four).toBe(3);
	});

	it("can create pieces for different players", () => {
		const piece1 = new Piece(player1, PieceSize.One, stack);
		const piece2 = new Piece(player2, PieceSize.Two, stack);

		expect(piece1.player).toBe(player1);
		expect(piece1.player.color).toBe(PlayerColor.Black);
		expect(piece2.player).toBe(player2);
		expect(piece2.player.color).toBe(PlayerColor.White);
	});

	it("can create pieces of all sizes", () => {
		const sizes = [
			PieceSize.One,
			PieceSize.Two,
			PieceSize.Three,
			PieceSize.Four,
		];

		sizes.forEach((size, index) => {
			const piece = new Piece(player1, size, stack);
			expect(piece.size).toBe(index);
		});
	});

	it("maintains reference to its stack", () => {
		const boardStack = new Stack(game, StackLocation.board);
		const poolStack = new Stack(game, StackLocation.pool);

		const boardPiece = new Piece(player1, PieceSize.One, boardStack);
		const poolPiece = new Piece(player2, PieceSize.Two, poolStack);

		expect(boardPiece.stack).toBe(boardStack);
		expect(poolPiece.stack).toBe(poolStack);
	});
});
