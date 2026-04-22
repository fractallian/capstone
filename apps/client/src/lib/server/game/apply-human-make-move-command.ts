import type { GameSnapshot } from '@capstone/contracts';
import { Game, InvalidMoveError } from '@capstone/game-logic';
import { buildCapstoneSnapshot } from '$lib/server/game/build-capstone-snapshot';
import { finalizeWinIfBoardWon } from '$lib/server/game/finalize-win-if-board-won';
import { loadCapstoneSnapshotFromDb } from '$lib/server/game/load-capstone-snapshot-from-db';
import { persistCapstoneSnapshot } from '$lib/server/game/persist-capstone-snapshot';
import type { SnapshotMeta } from '$lib/server/game/snapshot-meta';

export type ApplyHumanMoveError =
	| { kind: 'invalid_move'; message: string; errors: string[] }
	| { kind: 'game_not_started' }
	| { kind: 'game_ended' }
	| { kind: 'not_your_turn' };

export type ApplyHumanMoveSuccess = {
	snapshot: GameSnapshot;
	gameEnded: boolean;
};

/**
 * Applies a seated player's make_move: validate preconditions, mutate `game`, win path, persist, optional server AI.
 * Caller is responsible for seating / auth; this function is the shared core after a legal seat is known.
 */
export async function applyHumanMakeMoveCommand(params: {
	gameId: string;
	game: Game;
	from: number;
	to: number;
	gamePersisted: boolean;
	gameEnded: boolean;
	playerIndex: 0 | 1;
	playerUserIdByIndex: Map<0 | 1, string>;
	lockRoom: () => void;
	getSnapshotMeta: () => SnapshotMeta;
	setSnapshotMeta: (patch: Partial<SnapshotMeta>) => void;
	broadcastStateSync: (snapshot: GameSnapshot) => void;
}): Promise<{ ok: true; value: ApplyHumanMoveSuccess } | { ok: false; error: ApplyHumanMoveError }> {
	if (!params.gamePersisted) {
		return { ok: false, error: { kind: 'game_not_started' } };
	}
	if (params.gameEnded) {
		return { ok: false, error: { kind: 'game_ended' } };
	}

	const expectedPlayer = params.playerIndex === 0 ? params.game.player1 : params.game.player2;
	if (params.game.currentTurn !== expectedPlayer) {
		return { ok: false, error: { kind: 'not_your_turn' } };
	}

	try {
		params.game.makeMove(params.game.stacks[params.from], params.game.stacks[params.to]);
	} catch (error) {
		const message = error instanceof InvalidMoveError ? error.message : 'Move failed.';
		const errors = error instanceof InvalidMoveError ? error.errors : ['move failed'];
		return { ok: false, error: { kind: 'invalid_move', message, errors } };
	}

	const win = await finalizeWinIfBoardWon({
		gameId: params.gameId,
		game: params.game,
		playerUserIdByIndex: params.playerUserIdByIndex,
		lockRoom: params.lockRoom
	});

	if (win) {
		params.setSnapshotMeta({
			gameEnded: true,
			winnerSeatIndex: win.winnerSeatIndex,
			winnerPlayerId: win.winnerPlayerId,
			endedAt: win.endedAt
		});
	}

	const metaAfterHuman = params.getSnapshotMeta();
	const built = buildCapstoneSnapshot(params.game, metaAfterHuman);
	await persistCapstoneSnapshot(params.gameId, built);
	const latest = await loadCapstoneSnapshotFromDb(params.gameId, built);
	params.broadcastStateSync(latest);

	const finalMeta = params.getSnapshotMeta();
	const finalBuilt = buildCapstoneSnapshot(params.game, finalMeta);
	const finalSnap = await loadCapstoneSnapshotFromDb(params.gameId, finalBuilt);

	return {
		ok: true,
		value: {
			snapshot: finalSnap,
			gameEnded: finalMeta.gameEnded
		}
	};
}
