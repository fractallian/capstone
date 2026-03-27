import { env } from '$env/dynamic/private';
import { desc, or, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { game } from '$lib/server/db/schema';
import { getColyseusPublicUrl } from '$lib/server/realtime/server';

export const load = async ({ locals, url }) => {
	const lobbyGames = locals.user
		? await db
				.select({
					id: game.id,
					startedAt: game.startedAt,
					endedAt: game.endedAt
				})
				.from(game)
				.where(or(eq(game.player1Id, locals.user.id), eq(game.player2Id, locals.user.id)))
				.orderBy(desc(game.startedAt))
		: [];

	return {
		githubLoginEnabled: Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET),
		colyseusUrl: getColyseusPublicUrl(url),
		currentGameId: locals.currentGameId ?? null,
		hasSession: Boolean(locals.session),
		user: locals.user
			? {
					id: locals.user.id,
					name: locals.user.name ?? null,
					email: locals.user.email ?? null
				}
			: null,
		inProgressGames: lobbyGames
			.filter((gameRecord) => !gameRecord.endedAt)
			.map((gameRecord) => ({
				id: gameRecord.id,
				status: 'in_progress' as const,
				startedAt: gameRecord.startedAt.toISOString(),
				endedAt: null
			})),
		completedGames: lobbyGames
			.filter((gameRecord) => Boolean(gameRecord.endedAt))
			.map((gameRecord) => ({
				id: gameRecord.id,
				status: 'completed' as const,
				startedAt: gameRecord.startedAt.toISOString(),
				endedAt: gameRecord.endedAt?.toISOString() ?? null
			}))
	};
};
