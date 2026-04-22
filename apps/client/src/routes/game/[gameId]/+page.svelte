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
	import { animateMove, animateMoveFromStackIndices } from '$lib/dom/animateStackMove';
	import {
		appendRecentEvent,
		getCapstoneGameBoardRoot,
		setDebugHelpers,
		setDebugRoom,
		type CapstoneDebug
	} from '$lib/realtime/client-events';
	import { chooseMove } from '@capstone/virtual-opponent';

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
			gameId: string;
			gameState: GameStateLike;
			vsAi: boolean;
			vsSelf: boolean;
			viewerPlayerIndex: 1 | 2;
			viewerUserId: string;
			player1: { id: string | null; name: string | null; image: string | null } | null;
			player2: { id: string | null; name: string | null; image: string | null } | null;
		};
	} = $props();
	let gameId = $derived(data.gameId);
	let gameState = $derived(data.gameState);
	let vsAi = $derived(data.vsAi);
	let vsSelf = $derived(data.vsSelf);
	let viewerPlayerIndex = $derived(data.viewerPlayerIndex);
	let viewerUserId = $derived(data.viewerUserId);
	let player1 = $derived(data.player1);
	let player2 = $derived(data.player2);

	let roomStatus = $derived(
		vsAi || vsSelf
			? ('opponent_connected' as const)
			: player2
				? ('opponent_connected' as const)
				: ('waiting_for_opponent' as const)
	);
	let liveSnapshot = $state<GameStateLike>(null);
	let gameMessage = $state<string | null>(null);
	let isAiThinking = $state(false);
	let debugLastEvent: GameServerEvent | null = $state(null);
	let debugEvents: GameServerEvent[] = $state([]);
	let debugSyncSeq = $state(0);
	/** Tracks applied move list length for incremental opponent animation. */
	let lastStateSyncMoveCount = $state(-1);

	function getMoves(gameState: GameStateLike): SerializedMove[] {
		if (!gameState) return [];
		if (Array.isArray(gameState)) return gameState;
		return Array.isArray(gameState.moves) ? gameState.moves : [];
	}

	function getCurrentTurnIndex(gameState: GameStateLike): 0 | 1 {
		if (!gameState || Array.isArray(gameState)) return 0;
		return Number(gameState.currentTurnIndex) === 1 ? 1 : 0;
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

	function turnBeforeAbsolutePly(
		plyIndex: number,
		moveCountBeforeSync: number,
		turnAtStartOfNewMoves: 0 | 1
	): 0 | 1 {
		const offset = plyIndex - moveCountBeforeSync;
		return offset % 2 === 0 ? turnAtStartOfNewMoves : turnAtStartOfNewMoves === 0 ? 1 : 0;
	}

	/** Whether the move at `plyIndex` is played by the opponent from the viewer's seat. */
	function isOpponentIncrementalMove(
		fullMoves: SerializedMove[],
		plyIndex: number,
		viewerIndex: 1 | 2,
		moveCountBeforeSync: number,
		turnAtStartOfNewMoves: 0 | 1
	): boolean {
		const turnBeforePly = turnBeforeAbsolutePly(
			plyIndex,
			moveCountBeforeSync,
			turnAtStartOfNewMoves
		);
		const prevMoves = fullMoves.slice(0, plyIndex);
		const before = Game.deserialize(prevMoves);
		before.currentTurn = turnBeforePly === 1 ? before.player2 : before.player1;
		const moverSeat = before.currentTurnIndex();
		const viewerSeat = viewerIndex - 1;
		return moverSeat !== viewerSeat;
	}

	function hydrateGameFromSnapshotState(snapshot: GameStateLike): Game {
		const moves = getMoves(snapshot);
		const g = Game.deserialize(moves);
		if (!snapshot || Array.isArray(snapshot)) return g;
		g.currentTurn = getCurrentTurnIndex(snapshot) === 1 ? g.player2 : g.player1;
		return g;
	}

	const OPPONENT_MOVE_ANIMATION_MS = 680;

	let game = $derived(hydrateGameFromSnapshotState(liveSnapshot));
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
	/** vsSelf: both seats are interactive; vsAi: lock while AI is thinking. */
	let canInteract = $derived(
		!isGameEnded && (vsSelf ? true : isViewerTurn && !isAiThinking)
	);
	let debugSnapshot = $derived<GameSnapshot>({
		moves: getMoves(liveSnapshot),
		currentTurnIndex,
		winnerPlayerId,
		winnerSeatIndex: winnerSeatIndex === null ? undefined : winnerSeatIndex,
		endedAt
	});
	let movesSyncKey = $derived(JSON.stringify(getMoves(liveSnapshot)));

	let showWinConfetti = $derived(gameOutcome === 'win');

	const confettiPieces = Array.from({ length: 36 }, (_, i) => ({
		id: i,
		left: `${((i * 37) % 100) + (i % 3) * 0.7}%`,
		delay: `${(i % 10) * 0.12}s`,
		duration: `${2.2 + (i % 6) * 0.2}s`,
		size: `${7 + (i % 4) * 2}px`,
		rotation: `${(i * 41) % 360}deg`,
		color: ['#f59e0b', '#ef4444', '#10b981', '#3b82f6', '#a855f7', '#f97316'][i % 6]
	}));

	async function submitMovePayload(command: MakeMoveCommand) {
		const moveCountBeforeSync = getMoves(liveSnapshot).length;
		const turnAtStartOfNewMoves = getCurrentTurnIndex(liveSnapshot);

		const res = await fetch(`/api/games/${gameId}/move`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(command)
		});
		const body = (await res.json()) as {
			snapshot?: GameSnapshot;
			error?: string;
			errors?: string[];
		};
		if (!res.ok) {
			gameMessage = body.error ?? 'Move failed';
			return;
		}
		if (!body.snapshot) {
			gameMessage = 'Invalid response';
			return;
		}

		const moves = body.snapshot.moves;
		const hasNewMoves = lastStateSyncMoveCount >= 0 && moves.length > lastStateSyncMoveCount;
		const newMoves = hasNewMoves ? moves.slice(lastStateSyncMoveCount) : [];

		const applySnapshot = () => {
			lastStateSyncMoveCount = moves.length;
			liveSnapshot = body.snapshot!;
			gameMessage = null;
			debugSyncSeq += 1;
			debugLastEvent = { type: 'state_sync', gameId, snapshot: body.snapshot! };
			debugEvents = appendRecentEvent(debugEvents, debugLastEvent);
			// Trigger client-side AI turn when it's now the AI's seat
			if (vsAi && !getEndedAt(liveSnapshot) && getCurrentTurnIndex(liveSnapshot) === 1) {
				void triggerAiMove();
			}
		};

		const animateOpponentMoveAtPly = (plyIndex: number) => {
			const ply = moves[plyIndex];
			if (ply === undefined) {
				applySnapshot();
				return;
			}
			const root = getCapstoneGameBoardRoot();
			const fromEl = root?.querySelector<HTMLElement>(`[data-stack-index="${ply.from}"]`);
			const toEl = root?.querySelector<HTMLElement>(`[data-stack-index="${ply.to}"]`);
			if (fromEl && toEl) {
				void animateMove(fromEl, toEl, { durationMs: OPPONENT_MOVE_ANIMATION_MS })
					.then(applySnapshot)
					.catch(applySnapshot);
			} else {
				applySnapshot();
			}
		};

		if (hasNewMoves && newMoves.length > 0) {
			const plyToAnimate =
				vsAi && newMoves.length > 1 && moves.length > 0
					? moves.length - 1
					: lastStateSyncMoveCount;
			if (
				isOpponentIncrementalMove(
					moves,
					plyToAnimate,
					viewerPlayerIndex,
					moveCountBeforeSync,
					turnAtStartOfNewMoves
				)
			) {
				animateOpponentMoveAtPly(plyToAnimate);
			} else {
				applySnapshot();
			}
		} else {
			applySnapshot();
		}
	}

	function sendMove(from: number, to: number) {
		const poolIndex = Number(from);
		const boardIndex = Number(to);
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
		void submitMovePayload(command);
	}

	function handleBoardMove(fromStackIndex: number, toStackIndex: number) {
		const command: MakeMoveCommand = {
			type: 'make_move',
			from: fromStackIndex,
			to: toStackIndex
		};
		void submitMovePayload(command);
	}

	/**
	 * Compute the AI's move client-side using the heuristic opponent, apply it
	 * optimistically to the UI immediately, then persist to the server async.
	 */
	async function triggerAiMove() {
		isAiThinking = true;
		// Brief pause so the human move animation settles before AI responds
		await new Promise<void>((r) => setTimeout(r, 400));

		const g = hydrateGameFromSnapshotState(liveSnapshot);

		let chosen: { from: number; to: number };
		try {
			chosen = chooseMove(g);
		} catch {
			isAiThinking = false;
			return;
		}

		// Animate the AI piece moving on the board
		const root = getCapstoneGameBoardRoot();
		const fromEl = root?.querySelector<HTMLElement>(`[data-stack-index="${chosen.from}"]`);
		const toEl = root?.querySelector<HTMLElement>(`[data-stack-index="${chosen.to}"]`);
		if (fromEl && toEl) {
			try {
				await animateMove(fromEl, toEl, { durationMs: OPPONENT_MOVE_ANIMATION_MS });
			} catch {
				// ignore animation errors
			}
		}

		// Apply move locally for optimistic UI
		g.makeMove(g.stacks[chosen.from], g.stacks[chosen.to]);
		const aiWinner = g.board.winner();
		const optimistic: GameSnapshot = {
			moves: g.serialize(),
			currentTurnIndex: g.currentTurnIndex() as 0 | 1,
			winnerPlayerId: null,
			winnerSeatIndex: aiWinner ? 1 : undefined,
			endedAt: aiWinner ? new Date().toISOString() : null
		};
		lastStateSyncMoveCount = optimistic.moves.length;
		liveSnapshot = optimistic;
		isAiThinking = false;

		// Persist in the background — no need to block the UI
		void fetch(`/api/games/${gameId}/move`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				type: 'make_move',
				from: chosen.from,
				to: chosen.to
			} satisfies MakeMoveCommand)
		})
			.then(async (res) => {
				if (!res.ok) return;
				const body = (await res.json()) as { snapshot?: GameSnapshot };
				if (body.snapshot) {
					// Reconcile with server canonical state
					lastStateSyncMoveCount = body.snapshot.moves.length;
					liveSnapshot = body.snapshot;
				}
			})
			.catch(() => {
				// Optimistic state remains; server will be consistent on next load
			});
	}

	$effect(() => {
		if (liveSnapshot === null) {
			liveSnapshot = gameState;
		}
	});

	$effect(() => {
		if (lastStateSyncMoveCount < 0 && liveSnapshot !== null) {
			lastStateSyncMoveCount = getMoves(liveSnapshot).length;
		}
	});

	$effect(() => {
		if (!dev || typeof window === 'undefined') return;
		setDebugRoom(null);
		setDebugHelpers({
			room: null,
			getRoomId: () => null,
			getSyncSeq: () => debugSyncSeq,
			game,
			getGame: () => game,
			lastEvent: debugLastEvent,
			lastSnapshot: debugSnapshot,
			events: debugEvents,
			getSnapshot: () => debugSnapshot,
			getMoves: () => debugSnapshot.moves,
			sendMove,
			awaitNextSync: async () => {
				throw new Error('No realtime connection; reload the page to refresh state.');
			},
			sendMoveAndWait: async (from: number, to: number) => {
				sendMove(from, to);
				throw new Error('No realtime sync; use submit response or reload.');
			},
			joinByRoomId: async () => {
				console.warn('[capstone] joinByRoomId is not used without realtime.');
			},
			clearEvents: () => {
				debugEvents = [];
			},
			info: 'Debug helpers (HTTP moves; reload to see remote changes).',
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
</script>

<div class="flex min-h-0 flex-1 flex-col bg-slate-50 px-4 py-8">
	<section class="mx-auto flex min-h-0 w-full max-w-none flex-1 flex-col gap-5">
		<GamePlayerHeader
			{player1}
			{player2}
			{viewerPlayerIndex}
			{currentTurnIndex}
			{roomStatus}
			{gameMessage}
			{getPlayerLabel}
			{vsAi}
			{vsSelf}
			{isGameEnded}
			{gameOutcome}
			{isAiThinking}
		/>

		<div
			class={`flex min-h-0 flex-1 flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-opacity sm:p-5 ${
				!isGameEnded && !isViewerTurn && !vsSelf ? 'opacity-[0.92]' : ''
			}`}
		>
			<div
				class="relative isolate mx-auto flex min-h-0 w-full max-h-[calc(100dvh-13rem)] flex-1 overflow-hidden rounded-lg"
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
				<div class="relative z-1 flex min-h-0 min-w-0 flex-1">
					<GameComponent
						class={!isGameEnded && !isViewerTurn && !vsSelf ? 'game--inactive' : ''}
						moves={getMoves(liveSnapshot)}
						{movesSyncKey}
						{currentTurnIndex}
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
