import type { Game } from "./Game";
import type { Piece } from "./Piece";
import type { Player } from "./Player";
import { type Stack, StackLocation } from "./Stack";

export class InvalidMoveError extends Error {
	errors: string[];

	constructor(errors: string[] = ["Move rejected by game rules."]) {
		super(errors.join("; "));
		this.name = "InvalidMoveError";
		this.errors = errors;
	}
}

export type MoveValidationResult = {
	isValid: boolean;
	errors: string[];
};

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

	isValid(): MoveValidationResult {
		const errors: string[] = [];

		if (this.fromStack === this.toStack) {
			errors.push("cannot move to the same stack");
			return { isValid: false, errors };
		}

		const piece = this.piece();
		if (!piece) {
			errors.push("no piece on from stack");
			return { isValid: false, errors };
		}

		if (this.game.currentTurn !== piece.player) {
			errors.push("not the current player's turn");
			return { isValid: false, errors };
		}

		if (!this.toStack.canAddPiece(piece)) {
			errors.push("destination cannot accept piece");
			return { isValid: false, errors };
		}

		if (this.fromStack.location === StackLocation.board) {
			return { isValid: true, errors };
		}

		// when moving from pool, destination must be a board stack that is either empty or
		// covers one of your opponent's three in a row
		if (this.toStack.isEmpty()) return { isValid: true, errors };
		if (this.coversOneOfThree()) return { isValid: true, errors };

		errors.push("pool moves must go to an empty stack or cover a three-in-a-row");
		return { isValid: false, errors };
	}

	perform(validate = true) {
		if (validate) {
			const validation = this.isValid();
			if (!validation.isValid) {
				throw new InvalidMoveError(validation.errors);
			}
		}

		this.toStack.addPiece(this.piece() as Piece);
		this.fromStack.pieces.pop();
	}
}
