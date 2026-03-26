import type { Game } from "./Game";
import type { Piece } from "./Piece";
import type { Player } from "./Player";
import { type Stack, StackLocation } from "./Stack";

export class InvalidMoveError extends Error {}

export class Move {
	player: Player;
	game: Game;
	fromStack: Stack;
	toStack: Stack;

	constructor(player: Player, fromStack: Stack, toStack: Stack) {
		this.player = player;
		this.game = player.game;
		this.fromStack = fromStack;
		this.toStack = toStack;
	}

	piece() {
		return this.fromStack.topPiece();
	}

	/**
	 * If the opponent has three in a row, it is legal to cover one of those three
	 * by moving a piece directly from the player's pool
	 */
	coversOneOfThree(): boolean {
		const lines = this.game.board.lines();
		for (const line of lines) {
			if (line.coversOneOfThree(this.toStack)) {
				return true;
			}
		}
		return false;
	}

	isValid() {
		const piece = this.piece();
		if (!piece) return false;
		if (this.game.currentTurn !== piece.player) return false;

		if (!this.toStack.canAddPiece(piece)) return false;

		if (this.fromStack.location === StackLocation.board) {
			return true;
		}

		// when moving from pool, destination must be a board stack that is either empty or
		// covers one of your opponent's three in a row
		if (this.toStack.isEmpty()) return true;
		if (this.coversOneOfThree()) return true;
		return false;
	}

	perform(validate = true) {
		if (validate && !this.isValid()) throw new InvalidMoveError();

		this.toStack.addPiece(this.piece() as Piece);
		this.fromStack.pieces.pop();
	}
}
