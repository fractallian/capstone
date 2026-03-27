import { Pool } from './Pool';
export var PlayerColor;
(function (PlayerColor) {
    PlayerColor[PlayerColor["White"] = 0] = "White";
    PlayerColor[PlayerColor["Black"] = 1] = "Black";
})(PlayerColor || (PlayerColor = {}));
export class Player {
    constructor(game, color) {
        this.game = game;
        this.color = color;
        this.pool = new Pool(this);
    }
}
