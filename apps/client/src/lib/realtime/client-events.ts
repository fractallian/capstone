import { gameServerEventSchema, type GameServerEvent, type GameSnapshot } from '@capstone/contracts';
import type { Game } from '@capstone/game-logic';
import type { Room } from 'colyseus.js';
import type { AnimateStackMoveOptions } from '$lib/dom/animateStackMove';

/** DOM-only stack flight (dev); see `$lib/dom/animateStackMove`. */
export type CapstoneAnimateStackMove = {
	animateMove: (
		fromStack: HTMLElement,
		toStack: HTMLElement,
		options?: AnimateStackMoveOptions
	) => Promise<void>;
	animateMoveFromStackIndices: (fromIndex: number, toIndex: number) => Promise<void>;
};

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
	/** Set on the persisted game page in dev — try `__capstoneAnimateStackMove` on `window`. */
	animateStackMove?: CapstoneAnimateStackMove;
};

type CapstoneDebugWindow = Window & {
	__capstoneDebug?: CapstoneDebug;
	__capstoneRoom?: Room | null;
	__capstoneAnimateStackMove?: CapstoneAnimateStackMove;
};

let capstoneGameBoardRoot: HTMLElement | null = null;

/** Called from `Game.svelte` (dev) so dev helpers can resolve `[data-stack-index]`. */
export function setCapstoneGameBoardRoot(el: HTMLElement | null): void {
	capstoneGameBoardRoot = el;
}

export function getCapstoneGameBoardRoot(): HTMLElement | null {
	return capstoneGameBoardRoot;
}

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
	if (debug.animateStackMove) {
		debugWindow.__capstoneAnimateStackMove = debug.animateStackMove;
	} else {
		delete debugWindow.__capstoneAnimateStackMove;
	}
}
