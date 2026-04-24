import { Board } from './Board';
import { Move } from './Move';
import { Player } from './Player';
import type { Stack } from './Stack';
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
    from: number;
    to: number;
}
export declare class Game {
    player1: Player;
    player2: Player;
    board: Board;
    startingTurnIndex: 0 | 1;
    currentTurn: Player;
    moves: Move[];
    stacks: Stack[];
    constructor(startingTurnIndex?: 0 | 1);
    makeMove(fromStack: Stack, toStack: Stack, validate?: boolean): void;
    currentTurnIndex(): 0 | 1;
    serialize(): SerializedMove[];
    /**
     * Returns a new Game instance that is a clone of the current game
     */
    clone(): Game;
    static deserialize(moves: SerializedMove[], startingTurnIndex?: 0 | 1): Game;
}
