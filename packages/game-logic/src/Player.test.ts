import { beforeEach, describe, expect, it } from "vitest";
import { Game } from "./Game";
import { PieceSize } from "./Piece";
import { Player, PlayerColor } from "./Player";
import { StackLocation } from "./Stack";

describe("Player", () => {
	let game: Game;

	beforeEach(() => {
		game = new Game();
	});

	describe("construction", () => {
		it("creates player with correct properties", () => {
			const player = new Player(game, PlayerColor.Black);

			expect(player.game).toBe(game);
			expect(player.color).toBe(PlayerColor.Black);
			expect(player.pool).toBeDefined();
		});

		it("supports both player colors", () => {
			const blackPlayer = new Player(game, PlayerColor.Black);
			const whitePlayer = new Player(game, PlayerColor.White);

			expect(blackPlayer.color).toBe(PlayerColor.Black);
			expect(whitePlayer.color).toBe(PlayerColor.White);
			expect(PlayerColor.Black).toBe(1);
			expect(PlayerColor.White).toBe(0);
		});

		it("creates pool automatically", () => {
			const player = new Player(game, PlayerColor.Black);

			expect(player.pool).toBeDefined();
			expect(player.pool.player).toBe(player);
		});
	});

	describe("player colors", () => {
		it("has correct color enum values", () => {
			expect(PlayerColor.White).toBe(0);
			expect(PlayerColor.Black).toBe(1);
		});

		it("players have different colors in game", () => {
			expect(game.player1.color).toBe(PlayerColor.Black);
			expect(game.player2.color).toBe(PlayerColor.White);
			expect(game.player1.color).not.toBe(game.player2.color);
		});
	});
});

describe("Pool", () => {
	let game: Game;
	let player: Player;

	beforeEach(() => {
		game = new Game();
		player = game.player1;
	});

	describe("construction", () => {
		it("creates pool with correct structure", () => {
			expect(player.pool.stacks.length).toBe(3);
			expect(player.pool.player).toBe(player);
		});

		it("each stack has 4 pieces", () => {
			for (const stack of player.pool.stacks) {
				expect(stack.pieces.length).toBe(4);
			}
		});

		it("stacks are pool location", () => {
			for (const stack of player.pool.stacks) {
				expect(stack.location).toBe(StackLocation.pool);
			}
		});

		it("pieces belong to the player", () => {
			for (const stack of player.pool.stacks) {
				for (const piece of stack.pieces) {
					expect(piece.player).toBe(player);
				}
			}
		});

		it("pieces have correct sizes in each stack", () => {
			player.pool.stacks.forEach((stack, _stackIndex) => {
				expect(stack.pieces.length).toBe(4);

				// Each stack should have pieces of sizes 0, 1, 2, 3 (One, Two, Three, Four)
				stack.pieces.forEach((piece, pieceIndex) => {
					expect(piece.size).toBe(pieceIndex);
				});
			});
		});

		it("creates pieces in correct stacking order (largest at bottom)", () => {
			for (const stack of player.pool.stacks) {
				// Bottom piece (index 0) should be smallest (size 0)
				expect(stack.pieces[0].size).toBe(PieceSize.One);
				expect(stack.pieces[1].size).toBe(PieceSize.Two);
				expect(stack.pieces[2].size).toBe(PieceSize.Three);
				// Top piece should be largest (size 3)
				expect(stack.pieces[3].size).toBe(PieceSize.Four);
				expect(stack.topPiece()?.size).toBe(PieceSize.Four);
			}
		});

		it("registers all pool stacks with the game", () => {
			const poolStackCount =
				player.pool.stacks.length + game.player2.pool.stacks.length;
			const boardStackCount = 16; // 4x4 board
			const totalExpectedStacks = poolStackCount + boardStackCount;

			expect(game.stacks.length).toBe(totalExpectedStacks);
		});
	});

	describe("piece distribution", () => {
		it("player1 and player2 have identical pool structure", () => {
			const pool1 = game.player1.pool;
			const pool2 = game.player2.pool;

			expect(pool1.stacks.length).toBe(pool2.stacks.length);

			for (let i = 0; i < pool1.stacks.length; i++) {
				expect(pool1.stacks[i].pieces.length).toBe(
					pool2.stacks[i].pieces.length,
				);

				for (let j = 0; j < pool1.stacks[i].pieces.length; j++) {
					expect(pool1.stacks[i].pieces[j].size).toBe(
						pool2.stacks[i].pieces[j].size,
					);
				}
			}
		});

		it("each player has 3 stacks with 4 pieces each (12 total)", () => {
			for (const player of [game.player1, game.player2]) {
				expect(player.pool.stacks.length).toBe(3);

				let totalPieces = 0;
				for (const stack of player.pool.stacks) {
					totalPieces += stack.pieces.length;
				}

				expect(totalPieces).toBe(12);
			}
		});

		it("each player has 3 pieces of each size", () => {
			for (const player of [game.player1, game.player2]) {
				const sizeCount = [0, 0, 0, 0]; // Count for sizes 0, 1, 2, 3

				for (const stack of player.pool.stacks) {
					for (const piece of stack.pieces) {
						sizeCount[piece.size]++;
					}
				}

				// Each size should appear exactly 3 times
				for (const count of sizeCount) {
					expect(count).toBe(3);
				}
			}
		});
	});
});
