/**
 * Headless move / persistence / win / server-AI pipeline shared by CapstoneRoom
 * (and later HTTP handlers). Colyseus only broadcasts; this module owns DB writes
 * for snapshots and game end.
 */
import { gameSnapshotSchema, type GameSnapshot } from '@capstone/contracts';
import { eq } from 'drizzle-orm';
import { Game, InvalidMoveError, listLegalMoves, type SerializedMove } from '@capstone/game-logic';
import { randomUUID } from 'node:crypto';
import { getGameMoveProvider } from '$lib/server/ai';
import { db } from '$lib/server/db';
import { boardState, game } from '$lib/server/db/schema';
import { clearCurrentGameForUser } from '$lib/server/realtime/current-game-for-user';

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

export function buildCapstoneSnapshot(game: Game, meta: SnapshotMeta): GameSnapshot {
	return {
		moves: game.serialize(),
		currentTurnIndex: game.currentTurnIndex(),
		winnerPlayerId: meta.winnerPlayerId,
		winnerSeatIndex: meta.gameEnded ? meta.winnerSeatIndex : null,
		endedAt: meta.endedAt ? meta.endedAt.toISOString() : null
	};
}

export async function persistCapstoneSnapshot(gameId: string, snapshot: GameSnapshot): Promise<void> {
	await db.insert(boardState).values({
		id: randomUUID(),
		gameId,
		board: snapshot
	});
}

export async function loadCapstoneSnapshotFromDb(
	gameId: string,
	fallback: GameSnapshot
): Promise<GameSnapshot> {
	const latestBoardState = await db.query.boardState.findFirst({
		where: (table, { eq }) => eq(table.gameId, gameId),
		orderBy: (table, { desc }) => [desc(table.createdAt)]
	});

	const parsed = gameSnapshotSchema.safeParse(latestBoardState?.board);
	return parsed.success ? parsed.data : fallback;
}

/**
 * If the board has a winner, updates `game` row, clears current-game pointers, and locks the room.
 * Returns win details for the caller to mirror into in-memory state.
 */
export async function finalizeWinIfBoardWon(params: {
	gameId: string;
	game: Game;
	playerUserIdByIndex: Map<0 | 1, string>;
	lockRoom: () => void;
}): Promise<WinFinalization | null> {
	const winner = params.game.board.winner();
	if (!winner) return null;

	const winnerSeat: 0 | 1 = winner === params.game.player1 ? 0 : 1;
	const winnerPlayerId = params.playerUserIdByIndex.get(winnerSeat) ?? null;
	const endedAt = new Date();

	await db
		.update(game)
		.set({
			endedAt,
			winnerPlayerId
		})
		.where(eq(game.id, params.gameId));

	params.lockRoom();

	const player1Id = params.playerUserIdByIndex.get(0);
	const player2Id = params.playerUserIdByIndex.get(1);
	if (player1Id) clearCurrentGameForUser(player1Id);
	if (player2Id) clearCurrentGameForUser(player2Id);

	return { winnerSeatIndex: winnerSeat, winnerPlayerId, endedAt };
}

function pickRandomMove<T extends { from: number; to: number }>(legalMoves: T[]): T {
	return legalMoves[Math.floor(Math.random() * legalMoves.length)]!;
}

/**
 * Server-side AI ply (seat 1), persist, and broadcast. No-op if not vsAi, game over, or not AI turn.
 */
export async function runCapstoneServerAiTurn(params: {
	gameId: string;
	game: Game;
	vsAi: boolean;
	gameEnded: boolean;
	playerUserIdByIndex: Map<0 | 1, string>;
	lockRoom: () => void;
	getSnapshotMeta: () => SnapshotMeta;
	setSnapshotMeta: (patch: Partial<SnapshotMeta>) => void;
	broadcastStateSync: (snapshot: GameSnapshot) => void;
}): Promise<void> {
	if (!params.vsAi || params.gameEnded) return;

	const aiSeat: 0 | 1 = 1;
	if (params.game.currentTurnIndex() !== aiSeat) return;

	const legalMoves = listLegalMoves(params.game);
	if (legalMoves.length === 0) return;

	let chosen = pickRandomMove(legalMoves);
	const provider = getGameMoveProvider();
	if (provider) {
		try {
			chosen = await provider.chooseMove({
				moves: params.game.serialize(),
				currentTurnIndex: params.game.currentTurnIndex(),
				legalMoves
			});
		} catch (err) {
			console.warn('[capstone:cpu-move] provider failed; falling back to random legal move:', err);
			chosen = pickRandomMove(legalMoves);
		}
	}

	const stillLegal = legalMoves.some(
		(m: SerializedMove) => m.from === chosen.from && m.to === chosen.to
	);
	if (!stillLegal) {
		chosen = legalMoves[0]!;
	}

	params.game.makeMove(params.game.stacks[chosen.from], params.game.stacks[chosen.to]);

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

	const meta = params.getSnapshotMeta();
	const built = buildCapstoneSnapshot(params.game, meta);
	await persistCapstoneSnapshot(params.gameId, built);
	const latest = await loadCapstoneSnapshotFromDb(params.gameId, built);
	params.broadcastStateSync(latest);
}

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
 * Caller is responsible for seating / Colyseus; this function is the shared core after a legal seat is known.
 */
export async function applyHumanMakeMoveCommand(params: {
	gameId: string;
	game: Game;
	from: number;
	to: number;
	gamePersisted: boolean;
	gameEnded: boolean;
	playerIndex: 0 | 1;
	vsAi: boolean;
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

	const endedAfterHuman = metaAfterHuman.gameEnded;

	if (!endedAfterHuman) {
		await runCapstoneServerAiTurn({
			gameId: params.gameId,
			game: params.game,
			vsAi: params.vsAi,
			gameEnded: params.getSnapshotMeta().gameEnded,
			playerUserIdByIndex: params.playerUserIdByIndex,
			lockRoom: params.lockRoom,
			getSnapshotMeta: params.getSnapshotMeta,
			setSnapshotMeta: params.setSnapshotMeta,
			broadcastStateSync: params.broadcastStateSync
		});
	}

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
