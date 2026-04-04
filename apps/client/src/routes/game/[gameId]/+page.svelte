<script lang="ts">
	import { dev } from '$app/environment';
	import GameComponent from '../../../components/Game.svelte';
	import GamePlayerHeader from '$lib/components/game/GamePlayerHeader.svelte';
	import type { SerializedMove } from '@capstone/game-logic';
	import { Game } from '@capstone/game-logic';
	import {
		type GameServerEvent,
		type GameSnapshot,
		type MakeMoveCommand
	} from '@capstone/contracts';
	import { Client, type Room } from 'colyseus.js';
	import { animateMove, animateMoveFromStackIndices } from '$lib/dom/animateStackMove';
	import {
		appendRecentEvent,
		getCapstoneGameBoardRoot,
		parseGameEvent,
		setDebugHelpers,
		setDebugRoom,
		type CapstoneDebug
	} from '$lib/realtime/client-events';
	import { connectPersistedGameRoom } from '$lib/realtime/persisted-game-room';

	type GameStateLike =
		| {
				moves?: SerializedMove[];
				currentTurnIndex?: 0 | 1;
				winnerPlayerId?: string | null;
				winnerSeatIndex?: 0 | 1 | null;
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
			vsAi: boolean;
			viewerPlayerIndex: 1 | 2;
			viewerUserId: string;
			player1: { id: string | null; name: string | null; image: string | null } | null;
			player2: { id: string | null; name: string | null; image: string | null } | null;
		};
	} = $props();
	let colyseusUrl = $derived(data.colyseusUrl);
	let gameId = $derived(data.gameId);
	let gameState = $derived(data.gameState);
	let vsAi = $derived(data.vsAi);
	let viewerPlayerIndex = $derived(data.viewerPlayerIndex);
	let viewerUserId = $derived(data.viewerUserId);
	let player1 = $derived(data.player1);
	let player2 = $derived(data.player2);

	let room: Room | null = $state(null);
	let roomStatus = $state<
		'connecting' | 'opponent_connected' | 'waiting_for_opponent' | 'disconnected'
	>('connecting');
	let liveSnapshot = $state<GameStateLike>(null);
	let gameMessage = $state<string | null>(null);
	let debugLastEvent: GameServerEvent | null = $state(null);
	let debugEvents: GameServerEvent[] = $state([]);
	let debugSyncSeq = $state(0);
	/** Tracks `state_sync` move list length to detect new plies (not full history replay). */
	let lastStateSyncMoveCount = -1;

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

	function getWinnerSeatIndex(gameState: GameStateLike): 0 | 1 | null {
		if (!gameState || Array.isArray(gameState)) return null;
		const seat = gameState.winnerSeatIndex;
		return seat === 0 || seat === 1 ? seat : null;
	}

	function getPlayerLabel(
		player: { id: string | null; name: string | null; image: string | null } | null
	) {
		if (!player) return 'Waiting...';
		if (player.name?.trim()) return player.name.trim();
		if (player.id) return `Player ${player.id.slice(-4)}`;
		return 'Waiting...';
	}

	/** The player to move after `prevCount` plies — that player plays the next incremental move. */
	function isOpponentIncrementalMove(
		fullMoves: SerializedMove[],
		prevCount: number,
		viewerIndex: 1 | 2
	): boolean {
		const prevMoves = fullMoves.slice(0, prevCount);
		const before = Game.deserialize(prevMoves);
		const moverSeat = before.currentTurnIndex();
		const viewerSeat = viewerIndex - 1;
		return moverSeat !== viewerSeat;
	}

	/** DOM flight duration for opponent moves (see `$lib/dom/animateStackMove`). */
	const OPPONENT_MOVE_ANIMATION_MS = 680;

	let game = $derived(Game.deserialize(getMoves(liveSnapshot)));
	let currentTurnIndex = $derived(getCurrentTurnIndex(liveSnapshot));
	let winnerPlayerId = $derived(getWinnerPlayerId(liveSnapshot));
	let winnerSeatIndex = $derived(getWinnerSeatIndex(liveSnapshot));
	let endedAt = $derived(getEndedAt(liveSnapshot));
	let isGameEnded = $derived(Boolean(endedAt));
	let isViewerWinner = $derived(
		Boolean(
			isGameEnded &&
			(winnerSeatIndex !== null
				? winnerSeatIndex === viewerPlayerIndex - 1
				: winnerPlayerId === viewerUserId)
		)
	);
	let gameOutcome = $derived.by<'win' | 'loss' | null>(() => {
		if (!isGameEnded) return null;
		if (!(winnerSeatIndex !== null || Boolean(winnerPlayerId))) return null;
		return isViewerWinner ? 'win' : 'loss';
	});
	let isViewerTurn = $derived(
		(viewerPlayerIndex === 1 && currentTurnIndex === 0) ||
			(viewerPlayerIndex === 2 && currentTurnIndex === 1)
	);
	let canInteract = $derived(!isGameEnded && isViewerTurn);
	let debugSnapshot = $derived<GameSnapshot>({
		moves: getMoves(liveSnapshot),
		currentTurnIndex,
		winnerPlayerId,
		winnerSeatIndex: winnerSeatIndex === null ? undefined : winnerSeatIndex,
		endedAt
	});
	let movesSyncKey = $derived(JSON.stringify(getMoves(liveSnapshot)));

	let showWinConfetti = $derived(gameOutcome === 'win');

	/** Stable layout; avoids random() in $derived re-running every tick. */
	const confettiPieces = Array.from({ length: 36 }, (_, i) => ({
		id: i,
		left: `${((i * 37) % 100) + (i % 3) * 0.7}%`,
		delay: `${(i % 10) * 0.12}s`,
		duration: `${2.2 + (i % 6) * 0.2}s`,
		size: `${7 + (i % 4) * 2}px`,
		rotation: `${(i * 41) % 360}deg`,
		color: ['#f59e0b', '#ef4444', '#10b981', '#3b82f6', '#a855f7', '#f97316'][i % 6]
	}));

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
		const viewerIndex = viewerPlayerIndex - 1;
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
		if (liveSnapshot === null) {
			liveSnapshot = gameState;
		}
	});

	$effect(() => {
		if (!dev || typeof window === 'undefined') return;
		setDebugRoom(room);
		setDebugHelpers({
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
						const event = parseGameEvent(payload);
						if (!event || event.type !== 'state_sync') return;
						if (debugSyncSeq <= startSeq) return;
						clearTimeout(timeoutId);
						unsub();
						resolve(event.snapshot);
					});
				});
			},
			sendMoveAndWait: async (from: number, to: number, timeoutMs = 5000) => {
				const startSeq = debugSyncSeq;
				sendMove(from, to);
				const snapshot = await (
					window as Window & { __capstoneDebug?: CapstoneDebug }
				).__capstoneDebug!.awaitNextSync(timeoutMs);
				if (debugSyncSeq <= startSeq) throw new Error('No new state_sync received.');
				return snapshot;
			},
			joinByRoomId: async (roomId: string) => {
				const client = new Client(colyseusUrl);
				const joined = await client.joinById(roomId, { userId: viewerUserId });
				room = joined;
			},
			clearEvents: () => {
				debugEvents = [];
			},
			info: 'Debug helpers attached from the persisted game page with realtime room support.',
			animateStackMove: {
				animateMove,
				animateMoveFromStackIndices: (fromIndex: number, toIndex: number) => {
					const root = getCapstoneGameBoardRoot();
					if (!root) {
						return Promise.reject(
							new Error('Game board root not registered — ensure the board is mounted (dev only).')
						);
					}
					return animateMoveFromStackIndices(root, fromIndex, toIndex);
				}
			}
		});
	});

	$effect(() => {
		// Read deps synchronously so this effect re-runs on route/param changes and
		// subscribes correctly (reads inside async continuations are not tracked).
		const wsUrl = colyseusUrl;
		const userId = viewerUserId;
		const persistedGameId = gameId;
		const isVsAi = vsAi;

		let cancelled = false;
		let activeRoom: Room | null = null;

		async function connectToRoom() {
			const joined = await connectPersistedGameRoom({
				colyseusUrl: wsUrl,
				userId,
				gameId: persistedGameId,
				vsAi: isVsAi,
				onLeave: () => {
					if (activeRoom === joined) {
						activeRoom = null;
						room = null;
						roomStatus = 'disconnected';
					}
				},
				onEvent: (event) => {
					debugLastEvent = event;
					debugEvents = appendRecentEvent(debugEvents, event);

					if (event.type === 'state_sync') {
						const moves = event.snapshot.moves;
						const hasNewMoves =
							lastStateSyncMoveCount >= 0 && moves.length > lastStateSyncMoveCount;
						const newMoves = hasNewMoves ? moves.slice(lastStateSyncMoveCount) : [];

						if (hasNewMoves) {
							console.log('[capstone] move received (state_sync)', {
								newMoves,
								gameId: event.gameId,
								moveCount: moves.length,
								snapshot: event.snapshot
							});
						}

						const applySnapshot = () => {
							lastStateSyncMoveCount = moves.length;
							liveSnapshot = event.snapshot;
							gameMessage = null;
							debugSyncSeq += 1;
						};

						if (
							hasNewMoves &&
							newMoves.length > 0 &&
							isOpponentIncrementalMove(moves, lastStateSyncMoveCount, viewerPlayerIndex)
						) {
							const first = newMoves[0]!;
							const root = getCapstoneGameBoardRoot();
							const fromEl = root?.querySelector<HTMLElement>(
								`[data-stack-index="${first.from}"]`
							);
							const toEl = root?.querySelector<HTMLElement>(
								`[data-stack-index="${first.to}"]`
							);
							if (fromEl && toEl) {
								void animateMove(fromEl, toEl, {
									durationMs: OPPONENT_MOVE_ANIMATION_MS
								})
									.then(applySnapshot)
									.catch(applySnapshot);
							} else {
								applySnapshot();
							}
						} else {
							applySnapshot();
						}
						return;
					}

					if (event.type === 'presence_update') {
						updateRoomStatus(event.connectedPlayerIndexes);
						return;
					}

					if (event.type === 'waiting_for_player') {
						roomStatus = 'waiting_for_opponent';
						return;
					}

					if (event.type === 'invalid_move') {
						gameMessage = event.message;
					}
				}
			});
			if (cancelled) {
				void joined.leave();
				return;
			}

			activeRoom = joined;
			room = joined;
			roomStatus = 'waiting_for_opponent';
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

<div class="min-h-0 flex-1 bg-slate-50 px-4 py-8">
	<section class="mx-auto flex w-full max-w-none flex-col gap-5">
		<GamePlayerHeader
			{player1}
			{player2}
			{viewerPlayerIndex}
			{currentTurnIndex}
			{roomStatus}
			{gameMessage}
			{getPlayerLabel}
			{vsAi}
			{isGameEnded}
			{gameOutcome}
		/>

		<div
			class={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-opacity sm:p-5 ${
				!isGameEnded && !isViewerTurn ? 'opacity-[0.92]' : ''
			}`}
		>
			<div
				class="relative isolate mx-auto min-h-[min(58vh,22rem)] w-full overflow-hidden rounded-lg"
			>
				{#if showWinConfetti}
					<div
						class="pointer-events-none absolute inset-0 z-0 overflow-hidden"
						aria-hidden="true"
					>
						{#each confettiPieces as piece (piece.id)}
							<span
								class="confetti-piece"
								style={`left:${piece.left}; width:${piece.size}; height:${piece.size}; background:${piece.color}; animation-delay:${piece.delay}; animation-duration:${piece.duration}; transform:rotate(${piece.rotation});`}
							></span>
						{/each}
					</div>
				{/if}
				<div class="relative z-[1] min-h-[min(58vh,22rem)] w-full">
					<GameComponent
						class={!isGameEnded && !isViewerTurn ? 'game--inactive' : ''}
						moves={getMoves(liveSnapshot)}
						{movesSyncKey}
						{viewerPlayerIndex}
						{canInteract}
						onMove={handleBoardMove}
					/>
				</div>
			</div>
		</div>
	</section>
</div>

<style>
	.confetti-piece {
		position: absolute;
		top: -10%;
		border-radius: 2px;
		opacity: 0.9;
		animation-name: confetti-fall;
		animation-timing-function: linear;
		animation-iteration-count: infinite;
	}

	@keyframes confetti-fall {
		0% {
			transform: translate3d(0, -10%, 0) rotate(0deg);
		}
		100% {
			transform: translate3d(0, 120vh, 0) rotate(560deg);
		}
	}
</style>
