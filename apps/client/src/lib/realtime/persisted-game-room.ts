import type { GameServerEvent } from '@capstone/contracts';
import { Client, type Room } from 'colyseus.js';
import { parseGameEvent } from '$lib/realtime/client-events';

type PersistedGameRoomOptions = {
	colyseusUrl: string;
	gameId: string;
	userId: string;
	onEvent: (event: GameServerEvent) => void;
	onLeave: () => void;
};

export async function connectPersistedGameRoom(options: PersistedGameRoomOptions): Promise<Room> {
	const client = new Client(options.colyseusUrl);
	const room = await client.joinOrCreate('capstone', {
		userId: options.userId,
		gameId: options.gameId
	});

	room.onMessage('event', (payload: unknown) => {
		const event = parseGameEvent(payload);
		if (!event) return;
		options.onEvent(event);
	});
	room.onLeave(() => {
		options.onLeave();
	});
	return room;
}
