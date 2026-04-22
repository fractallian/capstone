import { currentGameByUserId } from '$lib/server/game/current-game-store';

export function setCurrentGameForUser(userId: string, gameId: string): void {
	currentGameByUserId.set(userId, gameId);
}
