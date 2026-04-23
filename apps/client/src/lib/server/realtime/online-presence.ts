const ONLINE_GRACE_MS = 15_000;
const recentActivityByUserId = new Map<string, number>();
const realtimeConnectionCountByUserId = new Map<string, number>();

export const realtimePresence = {
	noteActivity(userId: string): void {
		recentActivityByUserId.set(userId, Date.now());
	},
	markRealtimeConnected(userId: string): void {
		const next = (realtimeConnectionCountByUserId.get(userId) ?? 0) + 1;
		realtimeConnectionCountByUserId.set(userId, next);
	},
	markRealtimeDisconnected(userId: string): void {
		const current = realtimeConnectionCountByUserId.get(userId) ?? 0;
		if (current <= 1) {
			realtimeConnectionCountByUserId.delete(userId);
			return;
		}
		realtimeConnectionCountByUserId.set(userId, current - 1);
	},
	isOnline(userId: string): boolean {
		if ((realtimeConnectionCountByUserId.get(userId) ?? 0) > 0) return true;
		const lastActivityAt = recentActivityByUserId.get(userId);
		if (!lastActivityAt) return false;
		return Date.now() - lastActivityAt <= ONLINE_GRACE_MS;
	}
};
