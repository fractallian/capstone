import { Board } from './Board';
import { Move } from './Move';
import { Player, PlayerColor } from './Player';
export class Game {
    constructor() {
        this.stacks = [];
        this.board = new Board(this);
        this.player1 = new Player(this, PlayerColor.Black);
        this.player2 = new Player(this, PlayerColor.White);
        this.currentTurn = this.player1;
        this.moves = [];
    }
    makeMove(fromStack, toStack, validate = true) {
        const move = new Move(this.currentTurn, fromStack, toStack);
        move.perform(validate);
        this.moves.push(move);
        this.currentTurn = this.currentTurn === this.player1 ? this.player2 : this.player1;
    }
    currentTurnIndex() {
        return this.currentTurn === this.player1 ? 0 : 1;
    }
    serialize() {
        return this.moves.map((move) => {
            return {
                from: move.fromStack.index,
                to: move.toStack.index
            };
        });
    }
    /**
     * Returns a new Game instance that is a clone of the current game
     */
    clone() {
        return Game.deserialize(this.serialize());
    }
    static deserialize(moves) {
        const game = new Game();
        for (const move of moves) {
            game.makeMove(game.stacks[move.from], game.stacks[move.to], false);
        }
        return game;
    }
}
