import { gameServerEventSchema, type GameServerEvent, type GameSnapshot } from '@capstone/contracts';
import type { Game } from '@capstone/game-logic';
import type { Room } from 'colyseus.js';

export type CapstoneDebug = {
	room: Room | null;
	getRoomId: () => string | null;
	getSyncSeq: () => number;
	game: Game | null;
	getGame: () => Game | null;
	lastEvent: GameServerEvent | null;
	lastSnapshot: GameSnapshot | null;
	events: GameServerEvent[];
	getSnapshot: () => GameSnapshot | null;
	getMoves: () => GameSnapshot['moves'];
	sendMove: (from: number, to: number) => void;
	awaitNextSync: (timeoutMs?: number) => Promise<GameSnapshot>;
	sendMoveAndWait: (from: number, to: number, timeoutMs?: number) => Promise<GameSnapshot>;
	joinByRoomId: (roomId: string) => Promise<void>;
	clearEvents: () => void;
	info?: string;
};

type CapstoneDebugWindow = Window & {
	__capstoneDebug?: CapstoneDebug;
	__capstoneRoom?: Room | null;
};

export function parseGameEvent(payload: unknown): GameServerEvent | null {
	const parsed = gameServerEventSchema.safeParse(payload);
	return parsed.success ? parsed.data : null;
}

export function appendRecentEvent(events: GameServerEvent[], event: GameServerEvent): GameServerEvent[] {
	return [...events.slice(-49), event];
}

export function setDebugRoom(currentRoom: Room | null): void {
	if (typeof window === 'undefined') return;
	const debugWindow = window as CapstoneDebugWindow;
	debugWindow.__capstoneRoom = currentRoom;
}

export function setDebugHelpers(debug: CapstoneDebug): void {
	if (typeof window === 'undefined') return;
	const debugWindow = window as CapstoneDebugWindow;
	debugWindow.__capstoneDebug = debug;
}
