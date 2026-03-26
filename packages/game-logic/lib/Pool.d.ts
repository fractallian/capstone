import type { Player } from "./Player";
import { Stack } from "./Stack";
export declare class Pool {
    player: Player;
    stacks: Stack[];
    constructor(player: Player);
}
