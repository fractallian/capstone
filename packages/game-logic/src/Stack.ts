import type { Game } from './Game';
import type { Piece } from './Piece';

export enum StackLocation {
	board = 'B',
	pool = 'P'
}

export class Stack {
	pieces: Piece[];
	game: Game;
	location: StackLocation;
	index: number;

	constructor(game: Game, location: StackLocation) {
		this.pieces = [];
		this.game = game;
		this.location = location;
		this.index = game.stacks.length;
		game.stacks.push(this);
	}

	isEmpty() {
		return this.pieces.length === 0;
	}

	topPiece(): Piece | undefined {
		if (this.isEmpty()) return;
		return this.pieces[this.pieces.length - 1];
	}

	addPiece(piece: Piece): boolean {
		if (this.canAddPiece(piece)) {
			this.pieces.push(piece);
			return true;
		}
		return false;
	}

	canAddPiece(piece: Piece): boolean {
		if (this.isEmpty()) return true;
		return piece.size > (this.topPiece() as Piece).size;
	}
}
