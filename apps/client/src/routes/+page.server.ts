import { env } from '$env/dynamic/private';
import { desc, or, eq, inArray } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { game, user } from '$lib/server/db/schema';
import { getColyseusPublicUrl } from '$lib/server/realtime/server';

export const load = async ({ locals, url }) => {
	const lobbyGames = locals.user
		? await db
				.select({
					id: game.id,
					player1Id: game.player1Id,
					player2Id: game.player2Id,
					winnerPlayerId: game.winnerPlayerId,
					startedAt: game.startedAt,
					endedAt: game.endedAt
				})
				.from(game)
				.where(or(eq(game.player1Id, locals.user.id), eq(game.player2Id, locals.user.id)))
				.orderBy(desc(game.startedAt))
		: [];

	const opponentIds = locals.user
		? Array.from(
				new Set(
					lobbyGames.map((gameRecord) =>
						gameRecord.player1Id === locals.user!.id ? gameRecord.player2Id : gameRecord.player1Id
					)
				)
			)
		: [];

	const opponentRows =
		opponentIds.length > 0
			? await db
					.select({
						id: user.id,
						name: user.name,
						image: user.image
					})
					.from(user)
					.where(inArray(user.id, opponentIds))
			: [];

	const opponentById = new Map(
		opponentRows.map((opponent) => [
			opponent.id,
			{ id: opponent.id, name: opponent.name, image: opponent.image ?? null }
		])
	);

	const inProgressGames = lobbyGames
		.filter((gameRecord) => !gameRecord.endedAt)
		.map((gameRecord) => ({
			id: gameRecord.id,
			opponent:
				opponentById.get(
					gameRecord.player1Id === locals.user?.id ? gameRecord.player2Id : gameRecord.player1Id
				) ?? null,
			status: 'in_progress' as const,
			startedAt: gameRecord.startedAt.toISOString(),
			endedAt: null
		}));

	const completedGames = lobbyGames
		.filter((gameRecord) => Boolean(gameRecord.endedAt))
		.map((gameRecord) => ({
			id: gameRecord.id,
			opponent:
				opponentById.get(
					gameRecord.player1Id === locals.user?.id ? gameRecord.player2Id : gameRecord.player1Id
				) ?? null,
			result:
				gameRecord.winnerPlayerId && gameRecord.winnerPlayerId === locals.user?.id ? 'win' : 'loss',
			status: 'completed' as const,
			startedAt: gameRecord.startedAt.toISOString(),
			endedAt: gameRecord.endedAt?.toISOString() ?? null
		}));

	const currentGameId =
		locals.currentGameId &&
		inProgressGames.some((gameRecord) => gameRecord.id === locals.currentGameId)
			? locals.currentGameId
			: null;

	return {
		githubLoginEnabled: Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET),
		colyseusUrl: getColyseusPublicUrl(url),
		currentGameId,
		hasSession: Boolean(locals.session),
		user: locals.user
			? {
					id: locals.user.id,
					name: locals.user.name ?? null,
					email: locals.user.email ?? null
				}
			: null,
		inProgressGames,
		completedGames
	};
};
