import { currentGameByUserId } from '$lib/server/game/current-game-store';

export function clearCurrentGameForUser(userId: string): void {
	currentGameByUserId.delete(userId);
}
