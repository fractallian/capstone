/**
 * HTTP adapter for the move endpoint. Loads the game from the DB, validates seat
 * ownership (with special handling for vsAi and vsSelf), then delegates to the
 * shared pipeline.
 *
 * vsAi:   the authenticated user (player1) also submits AI moves for seat 1 on
 *         behalf of the client-side opponent.
 * vsSelf: the authenticated user (player1) alternates between both seats.
 */
import type { GameSnapshot } from '@capstone/contracts';
import { and, desc, eq, or } from 'drizzle-orm';
import { Game } from '@capstone/game-logic';
import { db } from '$lib/server/db';
import { boardState, game as gameTable } from '$lib/server/db/schema';
import { applyHumanMakeMoveCommand } from '$lib/server/game/apply-human-make-move-command';
import { buildCapstoneSnapshot } from '$lib/server/game/build-capstone-snapshot';
import { loadCapstoneSnapshotFromDb } from '$lib/server/game/load-capstone-snapshot-from-db';
import type { SnapshotMeta } from '$lib/server/game/snapshot-meta';

type HttpMoveError = { error: string; status: number; errors?: string[] };
type HttpMoveResult = { ok: true; snapshot: GameSnapshot } | { ok: false; body: HttpMoveError };

export async function applyHttpGameMove(params: {
	gameId: string;
	userId: string;
	from: number;
	to: number;
}): Promise<HttpMoveResult> {
	const { gameId, userId, from, to } = params;

	// ── Load game row ──────────────────────────────────────────────────────────
	const gameRow = await db.query.game.findFirst({
		where: eq(gameTable.id, gameId)
	});
	if (!gameRow) {
		return { ok: false, body: { error: 'Game not found', status: 404 } };
	}

	// ── Seat resolution ────────────────────────────────────────────────────────
	// For vsAi / vsSelf the authenticated user (player1) is allowed to submit
	// moves for whichever seat is currently active.
	const isOwner = gameRow.player1Id === userId;
	const isPlayer2 = gameRow.player2Id === userId;
	const isSpecialMode = gameRow.vsAi || gameRow.vsSelf;

	if (!isOwner && !isPlayer2) {
		return { ok: false, body: { error: 'Not a participant in this game', status: 403 } };
	}

	// ── Load the latest board snapshot ────────────────────────────────────────
	const latestBoard = await db.query.boardState.findFirst({
		where: eq(boardState.gameId, gameId),
		orderBy: [desc(boardState.createdAt), desc(boardState.id)]
	});
	const gamePersisted = latestBoard !== undefined;

	// ── Reconstruct in-memory game ────────────────────────────────────────────
	let g: Game;
	if (gamePersisted && latestBoard?.board) {
		const raw = latestBoard.board as {
			moves?: { from: number; to: number }[];
			startingTurnIndex?: 0 | 1;
			currentTurnIndex?: 0 | 1;
		};
		const moves = Array.isArray(raw?.moves) ? raw.moves : [];
		const startingTurnIndex = raw?.startingTurnIndex === 1 ? 1 : 0;
		g = Game.deserialize(moves, startingTurnIndex);
		if (raw?.currentTurnIndex === 1) {
			g.currentTurn = g.player2;
		} else {
			g.currentTurn = g.player1;
		}
	} else {
		g = new Game();
	}

	// Determine playerIndex after we know whose turn it is.
	let playerIndex: 0 | 1;
	if (isSpecialMode && isOwner) {
		// Owner acts as whichever seat is currently active.
		playerIndex = g.currentTurnIndex() as 0 | 1;
	} else if (isOwner) {
		playerIndex = 0;
	} else {
		// isPlayer2 — human vs human
		playerIndex = 1;
	}

	// ── Snapshot meta from game row ────────────────────────────────────────────
	const gameEnded = Boolean(gameRow.endedAt);
	let snapshotMeta: SnapshotMeta = {
		gameEnded,
		winnerPlayerId: gameRow.winnerPlayerId ?? null,
		winnerSeatIndex: null,
		endedAt: gameRow.endedAt ?? null
	};

	const playerUserIdByIndex = new Map<0 | 1, string>();
	playerUserIdByIndex.set(0, gameRow.player1Id);
	if (gameRow.player2Id) playerUserIdByIndex.set(1, gameRow.player2Id);
	// For vsSelf both seats belong to the same user (win attribution still works)
	if (gameRow.vsSelf) playerUserIdByIndex.set(1, gameRow.player1Id);

	// ── Apply move ────────────────────────────────────────────────────────────
	const result = await applyHumanMakeMoveCommand({
		gameId,
		game: g,
		from,
		to,
		gamePersisted,
		gameEnded,
		playerIndex,
		playerUserIdByIndex,
		lockRoom: () => {}, // no in-memory room for HTTP
		getSnapshotMeta: () => snapshotMeta,
		setSnapshotMeta: (patch) => {
			snapshotMeta = { ...snapshotMeta, ...patch };
		},
		broadcastStateSync: () => {} // response is the sync
	});

	if (!result.ok) {
		const e = result.error;
		if (e.kind === 'game_not_started')
			return { ok: false, body: { error: 'Game not started', status: 409 } };
		if (e.kind === 'game_ended')
			return { ok: false, body: { error: 'Game has ended', status: 409 } };
		if (e.kind === 'not_your_turn')
			return { ok: false, body: { error: 'Not your turn', status: 409 } };
		if (e.kind === 'invalid_move')
			return { ok: false, body: { error: e.message, status: 422, errors: e.errors } };
		return { ok: false, body: { error: 'Move failed', status: 500 } };
	}

	return { ok: true, snapshot: result.value.snapshot };
}
