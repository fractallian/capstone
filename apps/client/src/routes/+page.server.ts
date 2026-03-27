import { env } from '$env/dynamic/private';
import { desc, or, eq, inArray } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { boardState, game, user } from '$lib/server/db/schema';
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
			).filter((id): id is string => Boolean(id))
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

	const waitingGameRows = lobbyGames.filter((gameRecord) => !gameRecord.endedAt && !gameRecord.player2Id);
	const inProgressGameRows = lobbyGames.filter((gameRecord) => !gameRecord.endedAt && !!gameRecord.player2Id);
	const inProgressGameIds = inProgressGameRows.map((gameRecord) => gameRecord.id);
	const inProgressBoardRows =
		inProgressGameIds.length > 0
			? await db
					.select({
						gameId: boardState.gameId,
						board: boardState.board
					})
					.from(boardState)
					.where(inArray(boardState.gameId, inProgressGameIds))
					.orderBy(boardState.gameId, desc(boardState.createdAt))
			: [];

	const latestBoardByGameId = new Map<string, unknown>();
	for (const row of inProgressBoardRows) {
		if (!latestBoardByGameId.has(row.gameId)) {
			latestBoardByGameId.set(row.gameId, row.board);
		}
	}

	const inProgressSnapshots = inProgressGameRows.map((gameRecord) => {
		const snapshot = latestBoardByGameId.get(gameRecord.id) as
			| { currentTurnIndex?: 0 | 1 }
			| null
			| undefined;
		const currentTurnIndex =
			snapshot && !Array.isArray(snapshot) && snapshot.currentTurnIndex === 1 ? 1 : 0;
		const viewerPlayerIndex = gameRecord.player1Id === locals.user?.id ? 1 : 2;
		const opponentId =
			gameRecord.player1Id === locals.user?.id ? gameRecord.player2Id : gameRecord.player1Id;

		return {
			id: gameRecord.id,
			opponent: opponentId ? opponentById.get(opponentId) ?? null : null,
			status: 'in_progress' as const,
			startedAt: gameRecord.startedAt.toISOString(),
			endedAt: null,
			isYourTurn:
				(viewerPlayerIndex === 1 && currentTurnIndex === 0) ||
				(viewerPlayerIndex === 2 && currentTurnIndex === 1)
		};
	});

	const inProgressGames = inProgressSnapshots.sort((a, b) => {
		if (a.isYourTurn === b.isYourTurn) return 0;
		return a.isYourTurn ? -1 : 1;
	});

	const completedGames = lobbyGames
		.filter((gameRecord) => Boolean(gameRecord.endedAt))
		.map((gameRecord) => ({
			id: gameRecord.id,
			opponent: (() => {
				const opponentId =
					gameRecord.player1Id === locals.user?.id ? gameRecord.player2Id : gameRecord.player1Id;
				return opponentId ? opponentById.get(opponentId) ?? null : null;
			})(),
			result:
				gameRecord.winnerPlayerId && gameRecord.winnerPlayerId === locals.user?.id ? 'win' : 'loss',
			status: 'completed' as const,
			startedAt: gameRecord.startedAt.toISOString(),
			endedAt: gameRecord.endedAt?.toISOString() ?? null
		}));

	const waitingGames = waitingGameRows.map((gameRecord) => ({
		id: gameRecord.id,
		status: 'waiting' as const,
		startedAt: gameRecord.startedAt.toISOString()
	}));

	return {
		githubLoginEnabled: Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET),
		colyseusUrl: getColyseusPublicUrl(url),
		hasSession: Boolean(locals.session),
		user: locals.user
			? {
					id: locals.user.id,
					name: locals.user.name ?? null,
					email: locals.user.email ?? null
				}
			: null,
		inProgressGames,
		waitingGames,
		completedGames
	};
};
