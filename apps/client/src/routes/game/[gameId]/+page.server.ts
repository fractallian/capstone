import { env } from '$env/dynamic/private';
import { error, redirect } from '@sveltejs/kit';
import { and, desc, eq, or } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { boardState, game } from '$lib/server/db/schema';
import { getColyseusPublicUrl } from '$lib/server/realtime/server';

export const load = async ({ locals, params, url }) => {
	if (!locals.session || !locals.user) {
		throw redirect(302, '/');
	}

	const requestedGameId = params.gameId;

	const [currentGame, latestBoardState] = await Promise.all([
		db.query.game.findFirst({
			where: and(
				eq(game.id, requestedGameId),
				or(eq(game.player1Id, locals.user.id), eq(game.player2Id, locals.user.id))
			)
		}),
		db.query.boardState.findFirst({
			where: eq(boardState.gameId, requestedGameId),
			orderBy: [desc(boardState.createdAt)]
		})
	]);

	// Allow loading a newly-created room before it has persisted a DB game row
	// (first player waiting for opponent). Once second player joins, persistence
	// fills in canonical game/board state and viewer seat info.
	if (!currentGame) {
		if (locals.currentGameId !== requestedGameId) {
			throw error(404, 'Game not found');
		}

		return {
			colyseusUrl: getColyseusPublicUrl(url),
			gameId: requestedGameId,
			gameState: latestBoardState?.board ?? null,
			viewerPlayerIndex: 1 as const,
			viewerUserId: locals.user.id
		};
	}

	if (!latestBoardState) {
		throw error(404, 'Game not found');
	}

	return {
		colyseusUrl: getColyseusPublicUrl(url),
		gameId: requestedGameId,
		gameState: latestBoardState.board,
		viewerPlayerIndex: currentGame.player1Id === locals.user.id ? 1 : 2,
		viewerUserId: locals.user.id
	};
};
