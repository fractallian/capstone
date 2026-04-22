import { eq } from 'drizzle-orm';
import { Game } from '@capstone/game-logic';
import { db } from '$lib/server/db';
import { game } from '$lib/server/db/schema';
import { clearCurrentGameForUser } from '$lib/server/game/clear-current-game-for-user';
import type { WinFinalization } from '$lib/server/game/snapshot-meta';

/**
 * If the board has a winner, updates `game` row, clears current-game pointers, and locks the room.
 * Returns win details for the caller to mirror into in-memory state.
 */
export async function finalizeWinIfBoardWon(params: {
	gameId: string;
	game: Game;
	playerUserIdByIndex: Map<0 | 1, string>;
	lockRoom: () => void;
}): Promise<WinFinalization | null> {
	const winner = params.game.board.winner();
	if (!winner) return null;

	const winnerSeat: 0 | 1 = winner === params.game.player1 ? 0 : 1;
	const winnerPlayerId = params.playerUserIdByIndex.get(winnerSeat) ?? null;
	const endedAt = new Date();

	await db
		.update(game)
		.set({
			endedAt,
			winnerPlayerId
		})
		.where(eq(game.id, params.gameId));

	params.lockRoom();

	const player1Id = params.playerUserIdByIndex.get(0);
	const player2Id = params.playerUserIdByIndex.get(1);
	if (player1Id) clearCurrentGameForUser(player1Id);
	if (player2Id) clearCurrentGameForUser(player2Id);

	return { winnerSeatIndex: winnerSeat, winnerPlayerId, endedAt };
}
