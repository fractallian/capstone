import type { Game } from "./Game";
import type { Player } from "./Player";
import { Stack } from "./Stack";
export declare class Board {
    game: Game;
    stacks: Stack[][];
    constructor(game: Game);
    horizontalLines(): BoardLine[];
    verticalLines(): BoardLine[];
    diagonalLines(): BoardLine[];
    lines(): BoardLine[];
    winner(): Player | undefined;
}
export declare enum BoardLineType {
    diagonal = "D",
    inner = "I",
    outer = "O"
}
export declare class BoardLine {
    stacks: Stack[];
    type: BoardLineType;
    constructor(stacks: Stack[], type: BoardLineType);
    winningPlayer(): Player | undefined;
    coversOneOfThree(toStack: Stack): boolean;
}
