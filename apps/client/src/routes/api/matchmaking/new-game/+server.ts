import { json } from '@sveltejs/kit';
import { randomUUID } from 'node:crypto';
import { Game } from '@capstone/game-logic';
import { and, asc, eq, isNull, ne } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { game } from '$lib/server/db/schema';
import { buildCapstoneSnapshot } from '$lib/server/game/build-capstone-snapshot';
import { persistCapstoneSnapshot } from '$lib/server/game/persist-capstone-snapshot';
import { randomStartingTurnIndex } from '$lib/server/game/random-starting-turn-index';
import { setCurrentGameForUser } from '$lib/server/game/set-current-game-for-user';
import { realtimePresence } from '$lib/server/realtime/online-presence';

async function ensureWaitingGameForUser(userId: string): Promise<void> {
	const existingWaiting = await db.query.game.findFirst({
		where: and(
			eq(game.player1Id, userId),
			isNull(game.player2Id),
			isNull(game.endedAt),
			eq(game.vsAi, false),
			eq(game.vsSelf, false)
		),
		columns: { id: true }
	});
	if (existingWaiting) return;

	const gameId = randomUUID();
	const g = new Game(randomStartingTurnIndex());
	await db.insert(game).values({
		id: gameId,
		player1Id: userId,
		player2Id: null,
		vsAi: false,
		vsSelf: false,
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


export const POST = async ({ locals }) => {
	if (!locals.session || !locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const waitingCandidates = await db.query.game.findMany({
		where: and(
			isNull(game.player2Id),
			isNull(game.endedAt),
			ne(game.player1Id, locals.user.id),
			eq(game.vsAi, false),
			eq(game.vsSelf, false)
		),
		orderBy: [asc(game.startedAt)],
		columns: { id: true, player1Id: true }
	});
	const onlineCandidates = waitingCandidates.filter((candidate) =>
		realtimePresence.isOnline(candidate.player1Id)
	);
	const offlineCandidates = waitingCandidates.filter(
		(candidate) => !realtimePresence.isOnline(candidate.player1Id)
	);

	for (const candidate of [...onlineCandidates, ...offlineCandidates]) {

		const claimed = await db
			.update(game)
			.set({ player2Id: locals.user.id })
			.where(
				and(
					eq(game.id, candidate.id),
					isNull(game.player2Id),
					isNull(game.endedAt),
					ne(game.player1Id, locals.user.id),
					eq(game.vsAi, false),
					eq(game.vsSelf, false)
				)
			)
			.returning({ id: game.id });

		if (claimed.length === 0) continue;
		setCurrentGameForUser(locals.user.id, claimed[0].id);
		return json({ gameId: claimed[0].id });
	}

	await ensureWaitingGameForUser(locals.user.id);
	return json({ gameId: null });
};
