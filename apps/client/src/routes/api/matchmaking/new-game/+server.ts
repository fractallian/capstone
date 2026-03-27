import { json } from '@sveltejs/kit';
import { and, asc, eq, isNull, ne } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { game } from '$lib/server/db/schema';

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
			return json({ gameId: claimed[0].id });
		}
	}

	return json({ gameId: null });
};
