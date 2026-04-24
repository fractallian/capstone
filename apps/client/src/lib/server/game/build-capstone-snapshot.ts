import type { GameSnapshot } from '@capstone/contracts';
import { Game } from '@capstone/game-logic';
import type { SnapshotMeta } from '$lib/server/game/snapshot-meta';

export function buildCapstoneSnapshot(game: Game, meta: SnapshotMeta): GameSnapshot {
	return {
		moves: game.serialize(),
		startingTurnIndex: game.startingTurnIndex,
		currentTurnIndex: game.currentTurnIndex(),
		winnerPlayerId: meta.winnerPlayerId,
		winnerSeatIndex: meta.gameEnded ? meta.winnerSeatIndex : null,
		endedAt: meta.endedAt ? meta.endedAt.toISOString() : null
	};
}
