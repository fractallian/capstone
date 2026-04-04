import { Client, type Room } from 'colyseus.js';
import type { GameServerEvent } from '@capstone/contracts';
import { parseGameEvent } from './client-events';

interface PersistedGameRoomOptions {
	colyseusUrl: string;
	gameId: string;
	userId: string;
	/** When true, only you connect; seat 1 is controlled server-side (see CapstoneRoom). */
	vsAi?: boolean;
	onEvent: (event: GameServerEvent) => void;
	onLeave: () => void;
}

export function wirePersistedGameRoom(
	room: Room,
	handlers: Pick<PersistedGameRoomOptions, 'onEvent' | 'onLeave'>
): void {
	// Register `event` before `onLeave` so the first ROOM_DATA frame after JOIN cannot
	// arrive between handlers (microtask ordering).
	room.onMessage('event', (payload: unknown) => {
		const event = parseGameEvent(payload);
		if (!event) return;
		handlers.onEvent(event);
	});

	room.onLeave(() => {
		handlers.onLeave();
	});
}

export async function connectPersistedGameRoom(options: PersistedGameRoomOptions): Promise<Room> {
	const client = new Client(options.colyseusUrl);
	const room = await client.joinOrCreate('capstone', {
		userId: options.userId,
		gameId: options.gameId,
		...(options.vsAi ? { vsAi: true, needsOpponent: false } : {})
	});

	wirePersistedGameRoom(room, {
		onEvent: options.onEvent,
		onLeave: options.onLeave
	});

	return room;
}
