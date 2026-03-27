import { Client, type Room } from 'colyseus.js';
import type { GameServerEvent } from '@capstone/contracts';
import { parseGameEvent } from './client-events';

interface PersistedGameRoomOptions {
	colyseusUrl: string;
	gameId: string;
	userId: string;
	onEvent: (event: GameServerEvent) => void;
	onLeave: () => void;
}

export function wirePersistedGameRoom(
	room: Room,
	handlers: Pick<PersistedGameRoomOptions, 'onEvent' | 'onLeave'>
): void {
	room.onLeave(() => {
		handlers.onLeave();
	});

	room.onMessage('event', (payload: unknown) => {
		const event = parseGameEvent(payload);
		if (!event) return;
		handlers.onEvent(event);
	});
}

export async function connectPersistedGameRoom(options: PersistedGameRoomOptions): Promise<Room> {
	const client = new Client(options.colyseusUrl);
	const room = await client.joinOrCreate('capstone', {
		userId: options.userId,
		gameId: options.gameId
	});

	wirePersistedGameRoom(room, {
		onEvent: options.onEvent,
		onLeave: options.onLeave
	});

	return room;
}
