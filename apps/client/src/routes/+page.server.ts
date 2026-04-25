import { env } from '$env/dynamic/private';
import { desc, or, eq, inArray } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { boardState, game, user } from '$lib/server/db/schema';
import { realtimePresence } from '$lib/server/realtime/online-presence';
export const load = async ({ locals }) => {
	const lobbyGames = locals.user
		? await db
				.select({
					id: game.id,
					player1Id: game.player1Id,
					player2Id: game.player2Id,
					vsAi: game.vsAi,
					vsSelf: game.vsSelf,
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

	const waitingGameRows = lobbyGames.filter(
		(gameRecord) =>
			!gameRecord.endedAt && !gameRecord.player2Id && !gameRecord.vsAi && !gameRecord.vsSelf
	);
	const inProgressGameRows = lobbyGames.filter(
		(gameRecord) =>
			!gameRecord.endedAt && (!!gameRecord.player2Id || gameRecord.vsAi || gameRecord.vsSelf)
	);
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
		const opponentOnline =
			gameRecord.vsAi || gameRecord.vsSelf || !opponentId
				? null
				: realtimePresence.isOnline(opponentId);

		return {
			id: gameRecord.id,
			opponent: gameRecord.vsAi
				? { id: 'ai', name: 'CPU', image: null as string | null }
				: gameRecord.vsSelf
					? { id: 'self', name: 'Local Game', image: null as string | null }
					: opponentId
						? (opponentById.get(opponentId) ?? null)
						: null,
			status: 'in_progress' as const,
			startedAt: gameRecord.startedAt.toISOString(),
			endedAt: null,
			opponentOnline,
			// vsSelf: always your turn (you play both sides)
			isYourTurn: gameRecord.vsSelf
				? true
				: (viewerPlayerIndex === 1 && currentTurnIndex === 0) ||
					(viewerPlayerIndex === 2 && currentTurnIndex === 1)
		};
	});

	const inProgressGames = inProgressSnapshots.sort((a, b) => {
		if (a.isYourTurn !== b.isYourTurn) return a.isYourTurn ? -1 : 1;
		const aOnlineRank = a.opponentOnline === true ? 0 : a.opponentOnline === false ? 1 : 2;
		const bOnlineRank = b.opponentOnline === true ? 0 : b.opponentOnline === false ? 1 : 2;
		if (aOnlineRank !== bOnlineRank) return aOnlineRank - bOnlineRank;

		return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime();
	});
	const completedGameRows = lobbyGames.filter((gameRecord) => Boolean(gameRecord.endedAt));
	const completedGameIds = completedGameRows.map((gameRecord) => gameRecord.id);
	const completedBoardRows =
		completedGameIds.length > 0
			? await db
					.select({
						gameId: boardState.gameId,
						board: boardState.board
					})
					.from(boardState)
					.where(inArray(boardState.gameId, completedGameIds))
					.orderBy(boardState.gameId, desc(boardState.createdAt), desc(boardState.id))
			: [];
	const latestCompletedBoardByGameId = new Map<string, unknown>();
	for (const row of completedBoardRows) {
		if (!latestCompletedBoardByGameId.has(row.gameId)) {
			latestCompletedBoardByGameId.set(row.gameId, row.board);
		}
	}

	const completedGames = completedGameRows
		.filter((gameRecord) => Boolean(gameRecord.endedAt))
		.map((gameRecord) => ({
			id: gameRecord.id,
			opponent: (() => {
				if (gameRecord.vsAi) {
					return { id: 'ai', name: 'CPU', image: null as string | null };
				}
				if (gameRecord.vsSelf) {
					return { id: 'self', name: 'Local Game', image: null as string | null };
				}
				const opponentId =
					gameRecord.player1Id === locals.user?.id ? gameRecord.player2Id : gameRecord.player1Id;
				return opponentId ? (opponentById.get(opponentId) ?? null) : null;
			})(),
			result: (() => {
				if (gameRecord.vsSelf) {
					const snapshot = latestCompletedBoardByGameId.get(gameRecord.id) as
						| { winnerSeatIndex?: 0 | 1 | null }
						| null
						| undefined;
					const seat =
						snapshot && !Array.isArray(snapshot) && snapshot.winnerSeatIndex !== undefined
							? snapshot.winnerSeatIndex
							: null;
					return seat === 1 ? 'gold' : 'purple';
				}
				return gameRecord.winnerPlayerId && gameRecord.winnerPlayerId === locals.user?.id
					? 'win'
					: 'loss';
			})(),
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
		googleLoginEnabled: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
		aiOpponentEnabled: env.AI_OPPONENT_ENABLED !== 'false',
		vsSelfEnabled: true,
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
