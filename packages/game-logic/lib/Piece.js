export var PieceSize;
(function (PieceSize) {
    PieceSize[PieceSize["One"] = 0] = "One";
    PieceSize[PieceSize["Two"] = 1] = "Two";
    PieceSize[PieceSize["Three"] = 2] = "Three";
    PieceSize[PieceSize["Four"] = 3] = "Four";
})(PieceSize || (PieceSize = {}));
export class Piece {
    constructor(player, size, stack) {
        this.player = player;
        this.stack = stack;
        this.size = size;
    }
}
