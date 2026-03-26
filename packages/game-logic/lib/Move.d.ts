import type { Game } from "./Game";
import type { Piece } from "./Piece";
import type { Player } from "./Player";
import { type Stack } from "./Stack";
export declare class InvalidMoveError extends Error {
}
export declare class Move {
    player: Player;
    game: Game;
    fromStack: Stack;
    toStack: Stack;
    constructor(player: Player, fromStack: Stack, toStack: Stack);
    piece(): Piece | undefined;
    /**
     * If the opponent has three in a row, it is legal to cover one of those three
     * by moving a piece directly from the player's pool
     */
    coversOneOfThree(): boolean;
    isValid(): boolean;
    perform(validate?: boolean): void;
}
