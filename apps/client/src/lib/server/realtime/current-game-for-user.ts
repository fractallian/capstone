const currentGameByUserId = new Map<string, string>();

export function setCurrentGameForUser(userId: string, gameId: string): void {
	currentGameByUserId.set(userId, gameId);
}

export function clearCurrentGameForUser(userId: string): void {
	currentGameByUserId.delete(userId);
}

export function getCurrentGameForUser(userId: string): string | null {
	return currentGameByUserId.get(userId) ?? null;
}
