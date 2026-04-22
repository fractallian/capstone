export type SnapshotMeta = {
	gameEnded: boolean;
	winnerPlayerId: string | null;
	winnerSeatIndex: 0 | 1 | null;
	endedAt: Date | null;
};

export type WinFinalization = {
	winnerSeatIndex: 0 | 1;
	winnerPlayerId: string | null;
	endedAt: Date;
};
