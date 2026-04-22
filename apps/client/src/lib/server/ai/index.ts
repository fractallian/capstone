/**
 * Server-side AI barrel. The heuristic opponent now runs client-side
 * (`@capstone/virtual-opponent`). This module is kept so that any remaining
 * server imports still resolve; `getGameMoveProvider` always returns null.
 */
export type { GameMoveProvider, GameBoardStateInput, ChosenMove } from './game-move-provider';
export { VirtualOpponentGameMoveProvider } from './virtual-opponent-move-provider';

/** @deprecated AI now runs client-side. Returns null so callers no-op. */
export function getGameMoveProvider(): null {
	return null;
}
