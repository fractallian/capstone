import { randomUUID } from 'node:crypto';
import type { GameSnapshot } from '@capstone/contracts';
import { db } from '$lib/server/db';
import { boardState } from '$lib/server/db/schema';

export async function persistCapstoneSnapshot(gameId: string, snapshot: GameSnapshot): Promise<void> {
	await db.insert(boardState).values({
		id: randomUUID(),
		gameId,
		board: snapshot
	});
}
