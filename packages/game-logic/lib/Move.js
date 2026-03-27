import { StackLocation } from './Stack';
export class InvalidMoveError extends Error {
    constructor(errors = ['Move rejected by game rules.']) {
        super(errors.join('; '));
        this.name = 'InvalidMoveError';
        this.errors = errors;
    }
}
export class Move {
    constructor(player, fromStack, toStack) {
        this.player = player;
        this.game = player.game;
        this.fromStack = fromStack;
        this.toStack = toStack;
    }
    piece() {
        return this.fromStack.topPiece();
    }
    /**
     * If the opponent has three in a row, it is legal to cover one of those three
     * by moving a piece directly from the player's pool
     */
    coversOneOfThree() {
        const lines = this.game.board.lines();
        for (const line of lines) {
            if (line.coversOneOfThree(this.toStack)) {
                return true;
            }
        }
        return false;
    }
    isValid() {
        const errors = [];
        if (this.fromStack === this.toStack) {
            errors.push('cannot move to the same stack');
            return { isValid: false, errors };
        }
        const piece = this.piece();
        if (!piece) {
            errors.push('no piece on from stack');
            return { isValid: false, errors };
        }
        if (this.game.currentTurn !== piece.player) {
            errors.push("not the current player's turn");
            return { isValid: false, errors };
        }
        if (!this.toStack.isEmpty()) {
            const top = this.toStack.topPiece();
            if (piece.size === top.size) {
                errors.push('cannot stack on a piece of the same size');
                return { isValid: false, errors };
            }
        }
        if (!this.toStack.canAddPiece(piece)) {
            errors.push('destination cannot accept piece');
            return { isValid: false, errors };
        }
        if (this.fromStack.location === StackLocation.board) {
            return { isValid: true, errors };
        }
        // Pool → board: empty cells are always allowed.
        if (this.toStack.isEmpty())
            return { isValid: true, errors };
        const topPiece = this.toStack.topPiece();
        if (!topPiece)
            return { isValid: true, errors };
        // Stacking on your own pieces (larger on smaller) follows normal stack rules only.
        if (topPiece.player === piece.player) {
            return { isValid: true, errors };
        }
        // Opponent on top: canAddPiece already ensures your piece is larger than theirs
        // (you may only cover a smaller opponent piece). That case is forbidden from the
        // pool unless it is the three-in-a-row exception (covering one of their three).
        if (this.coversOneOfThree())
            return { isValid: true, errors };
        errors.push('pool moves cannot cover an opponent piece unless it completes the three-in-a-row cover rule');
        return { isValid: false, errors };
    }
    perform(validate = true) {
        if (validate) {
            const validation = this.isValid();
            if (!validation.isValid) {
                throw new InvalidMoveError(validation.errors);
            }
        }
        const piece = this.piece();
        this.toStack.addPiece(piece);
        this.fromStack.pieces.pop();
        piece.stack = this.toStack;
    }
}
