import type { Game } from "./Game";
import { Pool } from "./Pool";

export enum PlayerColor {
	White = 0,
	Black = 1,
}

export class Player {
	game: Game;
	color: PlayerColor;
	pool: Pool;

	constructor(game: Game, color: PlayerColor) {
		this.game = game;
		this.color = color;
		this.pool = new Pool(this);
	}
}
