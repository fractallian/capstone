/**
 * given a Game object
 * return a text-based visual representation of the board
 * for testing purposes
 *
 * e.g.:
 *
 * X3||  |X3|  |  ||O2
 * X1||  |O3|X2|  ||O3
 * X2||X3|O2|  |  ||O1
 *    |  |  |O3|  |
 */
import type { Game } from './Game';
export declare function viewGameState(game: Game): string;
