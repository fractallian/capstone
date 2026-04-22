import { json } from '@sveltejs/kit';
import { randomUUID } from 'node:crypto';
import { gameSnapshotSchema } from '@capstone/contracts';
import { Game } from '@capstone/game-logic';
import { and, asc, desc, eq, isNull, ne } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { boardState, game } from '$lib/server/db/schema';
import { buildCapstoneSnapshot } from '$lib/server/game/build-capstone-snapshot';
import { persistCapstoneSnapshot } from '$lib/server/game/persist-capstone-snapshot';
import { setCurrentGameForUser } from '$lib/server/game/set-current-game-for-user';

async function ensureWaitingGameForUser(userId: string): Promise<void> {
	const existingWaiting = await db.query.game.findFirst({
		where: and(
			eq(game.player1Id, userId),
			isNull(game.player2Id),
			isNull(game.endedAt),
			eq(game.vsAi, false)
		),
		columns: { id: true }
	});
	if (existingWaiting) return;

	const gameId = randomUUID();
	const g = new Game();
	await db.insert(game).values({
		id: gameId,
		player1Id: userId,
		player2Id: null,
		vsAi: false,
		startedAt: new Date()
	});
	await persistCapstoneSnapshot(
		gameId,
		buildCapstoneSnapshot(g, {
			gameEnded: false,
			winnerPlayerId: null,
			winnerSeatIndex: null,
			endedAt: null
		})
	);
	setCurrentGameForUser(userId, gameId);
}

async function setClaimedGameTurnToPlayer2(gameId: string): Promise<void> {
	const latestBoardState = await db.query.boardState.findFirst({
		where: eq(boardState.gameId, gameId),
		orderBy: [desc(boardState.createdAt)]
	});
	const parsed = gameSnapshotSchema.safeParse(latestBoardState?.board);
	if (!parsed.success) return;

	const snapshot = parsed.data;
	await db.insert(boardState).values({
		id: randomUUID(),
		gameId,
		board: {
			...snapshot,
			currentTurnIndex: 1
		}
	});
}

export const POST = async ({ locals }) => {
	if (!locals.session || !locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	// Claim the oldest waiting game by atomically setting player2Id.
	// If another request wins the race, retry a few times.
	for (let attempt = 0; attempt < 3; attempt += 1) {
		const oldestWaitingGame = await db.query.game.findFirst({
			where: and(isNull(game.player2Id), isNull(game.endedAt), ne(game.player1Id, locals.user.id)),
			orderBy: [asc(game.startedAt)],
			columns: { id: true }
		});

		if (!oldestWaitingGame) {
			return json({ gameId: null });
		}

		const claimed = await db
			.update(game)
			.set({ player2Id: locals.user.id })
			.where(
				and(
					eq(game.id, oldestWaitingGame.id),
					isNull(game.player2Id),
					isNull(game.endedAt),
					ne(game.player1Id, locals.user.id)
				)
			)
			.returning({ id: game.id });

		if (claimed.length > 0) {
			await setClaimedGameTurnToPlayer2(claimed[0].id);
			return json({ gameId: claimed[0].id });
		}
	}

	void ensureWaitingGameForUser(locals.user.id);
	return json({ gameId: null });
};
