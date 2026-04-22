import { error, redirect } from '@sveltejs/kit';
import { and, desc, eq, or } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { boardState, game, user } from '$lib/server/db/schema';

export const load = async ({ locals, params }) => {
	if (!locals.session || !locals.user) {
		throw redirect(302, '/');
	}

	const requestedGameId = params.gameId;

	const [currentGame, latestBoardState] = await Promise.all([
		db.query.game.findFirst({
			where: and(
				eq(game.id, requestedGameId),
				// vsSelf games only have player1Id — allow the owner to view via player1Id alone
				or(eq(game.player1Id, locals.user.id), eq(game.player2Id, locals.user.id))
			)
		}),
		db.query.boardState.findFirst({
			where: eq(boardState.gameId, requestedGameId),
			orderBy: [desc(boardState.createdAt)]
		})
	]);

	if (!currentGame) {
		throw error(404, 'Game not found');
	}

	if (!latestBoardState) {
		throw error(404, 'Game not found');
	}

	const vsSelf = Boolean(currentGame.vsSelf);

	const [player1, player2] = await Promise.all([
		db.query.user.findFirst({
			where: eq(user.id, currentGame.player1Id),
			columns: { id: true, name: true, image: true }
		}),
		currentGame.player2Id
			? db.query.user.findFirst({
					where: eq(user.id, currentGame.player2Id),
					columns: { id: true, name: true, image: true }
				})
			: Promise.resolve(null)
	]);

	return {
		gameId: requestedGameId,
		gameState: latestBoardState.board,
		vsAi: Boolean(currentGame.vsAi),
		vsSelf,
		viewerPlayerIndex: currentGame.player1Id === locals.user.id ? 1 : 2,
		viewerUserId: locals.user.id,
		player1: player1 ?? {
			id: currentGame.player1Id,
			name: null,
			image: null
		},
		player2: currentGame.vsAi
			? { id: null, name: 'CPU', image: null }
			: vsSelf
				? { id: null, name: 'You (Seat 2)', image: null }
				: (player2 ?? null)
	};
};
