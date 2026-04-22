import { json } from '@sveltejs/kit';
import { randomUUID } from 'node:crypto';
import { Game } from '@capstone/game-logic';
import { db } from '$lib/server/db';
import { game } from '$lib/server/db/schema';
import { buildCapstoneSnapshot } from '$lib/server/game/build-capstone-snapshot';
import { persistCapstoneSnapshot } from '$lib/server/game/persist-capstone-snapshot';
import { setCurrentGameForUser } from '$lib/server/game/set-current-game-for-user';

export const POST = async ({ locals }) => {
	if (!locals.session || !locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const gameId = randomUUID();
	const g = new Game();

	await db.insert(game).values({
		id: gameId,
		player1Id: locals.user.id,
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

	setCurrentGameForUser(locals.user.id, gameId);

	return json({ gameId });
};
