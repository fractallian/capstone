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
            if (!Number.isInteger(move.from) || !Number.isInteger(move.to)) {
                throw new Error('Invalid serialized move: stack indexes must be integers.');
            }
            if (move.from < 0 ||
                move.to < 0 ||
                move.from >= game.stacks.length ||
                move.to >= game.stacks.length) {
                throw new Error('Invalid serialized move: stack index out of range.');
            }
            game.makeMove(game.stacks[move.from], game.stacks[move.to], false);
        }
        return game;
    }
}
