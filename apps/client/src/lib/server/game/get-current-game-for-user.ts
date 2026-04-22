import { currentGameByUserId } from '$lib/server/game/current-game-store';

export function getCurrentGameForUser(userId: string): string | null {
	return currentGameByUserId.get(userId) ?? null;
}
