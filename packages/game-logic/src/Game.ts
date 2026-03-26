import { Board } from "./Board";
import { Move } from "./Move";
import { Player, PlayerColor } from "./Player";
import type { Stack } from "./Stack";

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

export interface SerializedMove {
	// stack indexes
	from: number;
	to: number;
}

export class Game {
	player1: Player;
	player2: Player;
	board: Board;
	currentTurn: Player; // who's turn is it?
	moves: Move[];
	stacks: Stack[]; // index of all stacks for serialization

	constructor() {
		this.stacks = [];
		this.board = new Board(this);
		this.player1 = new Player(this, PlayerColor.Black);
		this.player2 = new Player(this, PlayerColor.White);
		this.currentTurn = this.player1;
		this.moves = [];
	}

	makeMove(fromStack: Stack, toStack: Stack, validate = true) {
		const move = new Move(this.currentTurn, fromStack, toStack);
		move.perform(validate);
		this.moves.push(move);
		this.currentTurn =
			this.currentTurn === this.player1 ? this.player2 : this.player1;
	}

	currentTurnIndex() {
		return this.currentTurn === this.player1 ? 0 : 1;
	}

	serialize(): SerializedMove[] {
		return this.moves.map((move) => {
			return {
				from: move.fromStack.index,
				to: move.toStack.index,
			};
		});
	}

	/**
	 * Returns a new Game instance that is a clone of the current game
	 */
	clone() {
		return Game.deserialize(this.serialize());
	}

	static deserialize(moves: SerializedMove[]): Game {
		const game = new Game();
		for (const move of moves) {
			game.makeMove(game.stacks[move.from], game.stacks[move.to], false);
		}
		return game;
	}
}
