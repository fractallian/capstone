export var StackLocation;
(function (StackLocation) {
    StackLocation["board"] = "B";
    StackLocation["pool"] = "P";
})(StackLocation || (StackLocation = {}));
export class Stack {
    constructor(game, location) {
        this.pieces = [];
        this.game = game;
        this.location = location;
        this.index = game.stacks.length;
        game.stacks.push(this);
    }
    isEmpty() {
        return this.pieces.length === 0;
    }
    topPiece() {
        if (this.isEmpty())
            return;
        return this.pieces[this.pieces.length - 1];
    }
    addPiece(piece) {
        if (this.canAddPiece(piece)) {
            this.pieces.push(piece);
            return true;
        }
        return false;
    }
    canAddPiece(piece) {
        if (this.isEmpty())
            return true;
        return piece.size > this.topPiece().size;
    }
}
