import type { Game } from "./Game";
import { Pool } from "./Pool";
export declare enum PlayerColor {
    White = 0,
    Black = 1
}
export declare class Player {
    game: Game;
    color: PlayerColor;
    pool: Pool;
    constructor(game: Game, color: PlayerColor);
}
