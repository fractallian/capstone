import type { SerializedMove } from './Game';
import { Game } from './Game';
/** All legal moves for the current player on this game state (stack indices 0–21). */
export declare function listLegalMoves(game: Game): SerializedMove[];
