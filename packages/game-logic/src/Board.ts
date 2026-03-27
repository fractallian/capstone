import type { Game } from './Game';
import type { Player } from './Player';
import { Stack, StackLocation } from './Stack';

const INDEXES = [0, 1, 2, 3];

export class Board {
	game: Game;
	stacks: Stack[][];

	constructor(game: Game) {
		this.game = game;
		this.stacks = [];
		for (let r = 0; r < 4; r++) {
			const row: Stack[] = [];
			this.stacks.push(row);
			for (let c = 0; c < 4; c++) {
				row.push(new Stack(this.game, StackLocation.board));
			}
		}
	}

	horizontalLines(): BoardLine[] {
		return INDEXES.map((row) => {
			const type = row > 0 && row < 3 ? BoardLineType.inner : BoardLineType.outer;
			return new BoardLine(this.stacks[row], type);
		});
	}

	verticalLines(): BoardLine[] {
		return INDEXES.map((col) => {
			const stacks = INDEXES.map((row) => {
				return this.stacks[row][col];
			});
			const type = col > 0 && col < 3 ? BoardLineType.inner : BoardLineType.outer;
			return new BoardLine(stacks, type);
		});
	}

	diagonalLines(): BoardLine[] {
		return [
			new BoardLine(
				INDEXES.map((i) => {
					return this.stacks[i][i];
				}),
				BoardLineType.diagonal
			),
			new BoardLine(
				INDEXES.map((i) => {
					return this.stacks[3 - i][i];
				}),
				BoardLineType.diagonal
			)
		];
	}

	lines(): BoardLine[] {
		return this.horizontalLines().concat(this.verticalLines()).concat(this.diagonalLines());
	}

	winner(): Player | undefined {
		const lines = this.lines();
		for (const line of lines) {
			const player = line.winningPlayer();
			if (player) {
				return player;
			}
		}
		return undefined;
	}
}

export enum BoardLineType {
	diagonal = 'D',
	inner = 'I',
	outer = 'O'
}

export class BoardLine {
	stacks: Stack[];
	type: BoardLineType;

	constructor(stacks: Stack[], type: BoardLineType) {
		this.stacks = stacks;
		this.type = type;
	}

	winningPlayer(): Player | undefined {
		const topPlayers = this.stacks.map((stack) => stack.topPiece()?.player);
		return topPlayers.every((player) => player === topPlayers[0]) ? topPlayers[0] : undefined;
	}

	coversOneOfThree(toStack: Stack): boolean {
		const stackIndex = this.stacks.indexOf(toStack);
		if (stackIndex < 0) return false;

		const player = toStack.game.currentTurn;
		const coveredPiece = toStack.topPiece();
		if (!coveredPiece || coveredPiece.player === player) return false;

		// does the piece on the stack at this index have my opponent's piece
		const check = (index: number): boolean => {
			const stack = this.stacks[index];
			const topPiece = stack.topPiece();
			return !!(topPiece && topPiece?.player !== player);
		};
		// 0,1,2,3
		switch (stackIndex) {
			case 0:
			case 3:
				// 1,2
				return check(1) && check(2);
			case 1:
				// 0,2 or 2,3
				return (check(0) && check(2)) || (check(2) && check(3));
			case 2:
				// 0,1 or 1,3
				return (check(0) && check(1)) || (check(1) && check(3));
		}
		return false;
	}
}
