import type { Player } from './Player';
import type { Stack } from './Stack';
export declare enum PieceSize {
    One = 0,
    Two = 1,
    Three = 2,
    Four = 3
}
export declare class Piece {
    player: Player;
    stack: Stack;
    size: PieceSize;
    constructor(player: Player, size: PieceSize, stack: Stack);
}
