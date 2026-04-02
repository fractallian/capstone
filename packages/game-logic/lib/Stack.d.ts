import type { Game } from './Game';
import type { Piece } from './Piece';
export declare enum StackLocation {
    board = "B",
    pool = "P"
}
export declare class Stack {
    pieces: Piece[];
    game: Game;
    location: StackLocation;
    index: number;
    constructor(game: Game, location: StackLocation);
    isEmpty(): boolean;
    topPiece(): Piece | undefined;
    addPiece(piece: Piece): boolean;
    canAddPiece(piece: Piece): boolean;
}
