<script lang="ts">
	import { dev } from '$app/environment';
	import GameComponent from '../../../components/Game.svelte';
	import type { StackProps } from '../../../components/Stack.svelte';
	import type { SerializedMove } from '@capstone/game-logic';
	import { Game, PlayerColor } from '@capstone/game-logic';
	import {
		gameServerEventSchema,
		type GameServerEvent,
		type GameSnapshot,
		type MakeMoveCommand
	} from '@capstone/contracts';
	import { Client, type Room } from 'colyseus.js';

	type GameStateLike =
		| {
				moves?: SerializedMove[];
				currentTurnIndex?: 0 | 1;
				winnerPlayerId?: string | null;
				endedAt?: string | null;
		  }
		| SerializedMove[]
		| null;

	let {
		data
	}: {
		data: {
			colyseusUrl: string;
			gameId: string;
			gameState: GameStateLike;
			viewerPlayerIndex: 1 | 2;
			viewerUserId: string;
			player1: { id: string; name: string | null; image: string | null } | null;
			player2: { id: string; name: string | null; image: string | null } | null;
		};
	} = $props();

	type CapstoneDebug = {
		room: Room | null;
		getRoomId: () => string | null;
		getSyncSeq: () => number;
		game: Game;
		getGame: () => Game;
		lastEvent: GameServerEvent | null;
		lastSnapshot: GameSnapshot;
		events: GameServerEvent[];
		getSnapshot: () => GameSnapshot;
		getMoves: () => GameSnapshot['moves'];
		sendMove: (from: number, to: number) => void;
		awaitNextSync: (timeoutMs?: number) => Promise<GameSnapshot>;
		sendMoveAndWait: (from: number, to: number, timeoutMs?: number) => Promise<GameSnapshot>;
		joinByRoomId: (roomId: string) => Promise<void>;
		clearEvents: () => void;
		info: string;
	};

	let room: Room | null = $state(null);
	let roomStatus = $state<
		'connecting' | 'opponent_connected' | 'waiting_for_opponent' | 'disconnected'
	>('connecting');
	let liveSnapshot = $state<GameStateLike>(data.gameState);
	let gameMessage = $state<string | null>(null);
	let debugLastEvent: GameServerEvent | null = $state(null);
	let debugEvents: GameServerEvent[] = $state([]);
	let debugSyncSeq = $state(0);

	function getMoves(gameState: GameStateLike): SerializedMove[] {
		if (!gameState) return [];
		if (Array.isArray(gameState)) return gameState;
		return Array.isArray(gameState.moves) ? gameState.moves : [];
	}

	function getCurrentTurnIndex(gameState: GameStateLike): 0 | 1 {
		if (!gameState || Array.isArray(gameState)) return 0;
		return gameState.currentTurnIndex === 1 ? 1 : 0;
	}

	function getWinnerPlayerId(gameState: GameStateLike): string | null {
		if (!gameState || Array.isArray(gameState)) return null;
		return gameState.winnerPlayerId ?? null;
	}

	function getEndedAt(gameState: GameStateLike): string | null {
		if (!gameState || Array.isArray(gameState)) return null;
		return gameState.endedAt ?? null;
	}

	function getPlayerLabel(
		player: { id: string; name: string | null; image: string | null } | null
	) {
		if (!player) return 'Waiting...';
		return player.name?.trim() || `Player ${player.id.slice(-4)}`;
	}

	let game = $derived(Game.deserialize(getMoves(liveSnapshot)));
	let currentTurnIndex = $derived(getCurrentTurnIndex(liveSnapshot));
	let winnerPlayerId = $derived(getWinnerPlayerId(liveSnapshot));
	let endedAt = $derived(getEndedAt(liveSnapshot));
	let isGameEnded = $derived(Boolean(endedAt));
	let canInteract = $derived(
		!isGameEnded &&
			roomStatus === 'opponent_connected' &&
			((data.viewerPlayerIndex === 1 && currentTurnIndex === 0) ||
				(data.viewerPlayerIndex === 2 && currentTurnIndex === 1))
	);
	let debugSnapshot = $derived<GameSnapshot>({
		moves: getMoves(liveSnapshot),
		currentTurnIndex,
		winnerPlayerId,
		endedAt
	});
	let stacks = $derived.by<StackProps[]>(() =>
		game.stacks.map((stack) => ({
			pieces: stack.pieces.map((piece) => ({
				size: piece.size,
				color: piece.player.color === PlayerColor.Black ? PlayerColor.Black : PlayerColor.White
			}))
		}))
	);

	function sendMove(from: number, to: number) {
		const poolIndex = Number(from);
		const boardIndex = Number(to);
		if (!room) {
			throw new Error('No realtime room is attached on the persisted game page.');
		}
		const fromStackIndex = game.currentTurn.pool.stacks[poolIndex]?.index;
		if (fromStackIndex === undefined) {
			throw new Error(`Invalid pool index ${poolIndex}. Expected 0-2.`);
		}
		if (!Number.isInteger(boardIndex) || boardIndex < 0 || boardIndex > 15) {
			throw new Error(`Invalid board index ${boardIndex}. Expected 0-15.`);
		}

		const command: MakeMoveCommand = {
			type: 'make_move',
			from: fromStackIndex,
			to: boardIndex
		};
		room.send('command', command);
	}

	function updateRoomStatus(connectedPlayerIndexes: number[]) {
		const viewerIndex = data.viewerPlayerIndex - 1;
		const opponentIndex = viewerIndex === 0 ? 1 : 0;
		roomStatus = connectedPlayerIndexes.includes(opponentIndex)
			? 'opponent_connected'
			: 'waiting_for_opponent';
	}

	function handleBoardMove(fromStackIndex: number, toStackIndex: number) {
		if (!room) {
			throw new Error('No realtime room is attached on the persisted game page.');
		}

		const command: MakeMoveCommand = {
			type: 'make_move',
			from: fromStackIndex,
			to: toStackIndex
		};
		room.send('command', command);
	}

	$effect(() => {
		if (!dev || typeof window === 'undefined') return;

		const debugWindow = window as Window & {
			__capstoneDebug?: CapstoneDebug;
			__capstoneRoom?: Room | null;
		};

		debugWindow.__capstoneRoom = room;
		debugWindow.__capstoneDebug = {
			room,
			getRoomId: () => room?.roomId ?? null,
			getSyncSeq: () => debugSyncSeq,
			game,
			getGame: () => game,
			lastEvent: debugLastEvent,
			lastSnapshot: debugSnapshot,
			events: debugEvents,
			getSnapshot: () => debugSnapshot,
			getMoves: () => debugSnapshot.moves,
			sendMove,
			awaitNextSync: async (timeoutMs = 5000) => {
				if (!room) throw new Error('No room connected.');
				const currentRoom = room;
				const startSeq = debugSyncSeq;
				return await new Promise<GameSnapshot>((resolve, reject) => {
					const timeoutId = setTimeout(() => {
						unsub();
						reject(new Error('Timed out waiting for state_sync.'));
					}, timeoutMs);

					const unsub = currentRoom.onMessage('event', (payload: unknown) => {
						const parsed = gameServerEventSchema.safeParse(payload);
						if (!parsed.success || parsed.data.type !== 'state_sync') return;
						if (debugSyncSeq <= startSeq) return;
						clearTimeout(timeoutId);
						unsub();
						resolve(parsed.data.snapshot);
					});
				});
			},
			sendMoveAndWait: async (from: number, to: number, timeoutMs = 5000) => {
				const startSeq = debugSyncSeq;
				sendMove(from, to);
				const snapshot = await debugWindow.__capstoneDebug!.awaitNextSync(timeoutMs);
				if (debugSyncSeq <= startSeq) throw new Error('No new state_sync received.');
				return snapshot;
			},
			joinByRoomId: async (roomId: string) => {
				const client = new Client(data.colyseusUrl);
				const joined = await client.joinById(roomId, { userId: data.viewerUserId });
				room = joined;
			},
			clearEvents: () => {
				debugEvents = [];
			},
			info: 'Debug helpers attached from the persisted game page with realtime room support.'
		};
	});

	$effect(() => {
		let cancelled = false;
		let activeRoom: Room | null = null;

		async function connectToRoom() {
			const client = new Client(data.colyseusUrl);
			const joined = await client.joinOrCreate('capstone', {
				userId: data.viewerUserId,
				gameId: data.gameId
			});
			if (cancelled) {
				void joined.leave();
				return;
			}

			activeRoom = joined;
			room = joined;
			roomStatus = 'waiting_for_opponent';

			joined.onLeave(() => {
				if (activeRoom === joined) {
					activeRoom = null;
					room = null;
					roomStatus = 'disconnected';
				}
			});

			joined.onMessage('event', (payload: unknown) => {
				const parsed = gameServerEventSchema.safeParse(payload);
				if (!parsed.success) return;

				debugLastEvent = parsed.data;
				debugEvents = [...debugEvents.slice(-49), parsed.data];

				if (parsed.data.type === 'state_sync') {
					liveSnapshot = parsed.data.snapshot;
					gameMessage =
						parsed.data.snapshot.endedAt && parsed.data.snapshot.winnerPlayerId
							? parsed.data.snapshot.winnerPlayerId === data.viewerUserId
								? 'Game over: you won.'
								: 'Game over: you lost.'
							: null;
					debugSyncSeq += 1;
					return;
				}

				if (parsed.data.type === 'presence_update') {
					updateRoomStatus(parsed.data.connectedPlayerIndexes);
					return;
				}

				if (parsed.data.type === 'waiting_for_player') {
					roomStatus = 'waiting_for_opponent';
					return;
				}

				if (parsed.data.type === 'invalid_move') {
					gameMessage = parsed.data.message;
				}
			});
		}

		void connectToRoom();

		return () => {
			cancelled = true;
			if (activeRoom) {
				void activeRoom.leave();
			}
		};
	});
</script>

<main class="min-h-screen bg-slate-50 px-4 py-8">
	<section class="mx-auto flex w-full max-w-6xl flex-col gap-6">
		<div class="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
			<div class="grid items-center gap-4 md:grid-cols-[1fr_auto_1fr]">
				<div
					class={`relative rounded-lg border bg-violet-50 p-4 ${
						currentTurnIndex === 0
							? data.viewerPlayerIndex === 1
								? 'border-2 border-emerald-600'
								: 'border-2 border-slate-500'
							: 'border-slate-200'
					}`}
				>
					{#if roomStatus === 'opponent_connected' && data.viewerPlayerIndex === 2}
						<span
							class="absolute top-1/2 right-3 h-3 w-3 -translate-y-1/2 rounded-full bg-emerald-500 ring-2 ring-white"
							aria-label="Opponent connected"
							title="Opponent connected"
						></span>
					{/if}
					<div class="flex items-center gap-3">
						{#if data.player1?.image}
							<img
								src={data.player1.image}
								alt={getPlayerLabel(data.player1)}
								class="h-10 w-10 rounded-full object-cover"
							/>
						{:else}
							<div
								class="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700"
							>
								{getPlayerLabel(data.player1).slice(0, 2).toUpperCase()}
							</div>
						{/if}
						<div class="min-w-0">
							<p class="truncate text-sm font-semibold text-slate-900">
								{getPlayerLabel(data.player1)}
							</p>
							<p class="text-xs text-slate-600">Player 1</p>
						</div>
					</div>
				</div>
				<div class="text-center text-lg font-bold text-slate-500">VS.</div>
				<div
					class={`relative rounded-lg border bg-amber-50 p-4 ${
						currentTurnIndex === 1
							? data.viewerPlayerIndex === 2
								? 'border-2 border-emerald-600'
								: 'border-2 border-slate-500'
							: 'border-slate-200'
					}`}
				>
					{#if roomStatus === 'opponent_connected' && data.viewerPlayerIndex === 1}
						<span
							class="absolute top-1/2 right-3 h-3 w-3 -translate-y-1/2 rounded-full bg-emerald-500 ring-2 ring-white"
							aria-label="Opponent connected"
							title="Opponent connected"
						></span>
					{/if}
					<div class="flex items-center gap-3">
						{#if data.player2?.image}
							<img
								src={data.player2.image}
								alt={getPlayerLabel(data.player2)}
								class="h-10 w-10 rounded-full object-cover"
							/>
						{:else}
							<div
								class="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700"
							>
								{getPlayerLabel(data.player2).slice(0, 2).toUpperCase()}
							</div>
						{/if}
						<div class="min-w-0">
							<p class="truncate text-sm font-semibold text-slate-900">
								{getPlayerLabel(data.player2)}
							</p>
							<p class="text-xs text-slate-600">Player 2</p>
						</div>
					</div>
				</div>
			</div>
			{#if gameMessage}
				<p class="mt-2 text-sm text-rose-700">{gameMessage}</p>
			{/if}
		</div>

		<div
			class={`rounded-lg border p-4 shadow-sm ${
				(data.viewerPlayerIndex === 1 && currentTurnIndex === 0) ||
				(data.viewerPlayerIndex === 2 && currentTurnIndex === 1)
					? 'border-slate-200 bg-white'
					: 'border-slate-200 bg-slate-300'
			}`}
		>
			<div class="mx-auto aspect-[6/4] w-full max-w-5xl">
				<GameComponent
					{stacks}
					{currentTurnIndex}
					viewerPlayerIndex={data.viewerPlayerIndex}
					{canInteract}
					onMove={handleBoardMove}
				/>
			</div>
		</div>
	</section>
</main>
