import { gameSnapshotSchema, type GameSnapshot } from '@capstone/contracts';
import { db } from '$lib/server/db';

/** Normalize JSONB quirks before Zod (e.g. stringly-typed numbers) so load matches SSR raw board. */
function coerceStoredBoardJson(raw: unknown): unknown {
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw;
	const o = raw as Record<string, unknown>;
	const out: Record<string, unknown> = { ...o };
	const t = o['currentTurnIndex'];
	const currentTurnIndex = t === 1 || t === '1' ? 1 : 0;
	out['currentTurnIndex'] = currentTurnIndex;
	if (Array.isArray(o['moves'])) {
		out['moves'] = (o['moves'] as unknown[]).map((m) => {
			if (!m || typeof m !== 'object' || Array.isArray(m)) return m;
			const mv = m as Record<string, unknown>;
			return {
				from: Number(mv['from']),
				to: Number(mv['to'])
			};
		});
	}
	const s = o['startingTurnIndex'];
	if (s === 0 || s === 1 || s === '0' || s === '1') {
		out['startingTurnIndex'] = Number(s);
		return out;
	}
	const moveCount = Array.isArray(out['moves']) ? out['moves'].length : 0;
	out['startingTurnIndex'] =
		moveCount % 2 === 0 ? currentTurnIndex : currentTurnIndex === 0 ? 1 : 0;
	return out;
}

export async function loadCapstoneSnapshotFromDb(
	gameId: string,
	fallback: GameSnapshot
): Promise<GameSnapshot> {
	const latestBoardState = await db.query.boardState.findFirst({
		where: (table, { eq }) => eq(table.gameId, gameId),
		orderBy: (table, { desc }) => [desc(table.createdAt), desc(table.id)]
	});

	const coerced = coerceStoredBoardJson(latestBoardState?.board);
	const parsed = gameSnapshotSchema.safeParse(coerced);
	if (!parsed.success && latestBoardState?.board !== undefined) {
		console.warn('[capstone] board snapshot failed validation; using fallback', gameId, parsed.error);
	}
	return parsed.success ? parsed.data : fallback;
}
