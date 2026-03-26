<script lang="ts">
	import {
		gameServerEventSchema,
		type GameServerEvent,
		type GameSnapshot,
		type MakeMoveCommand
	} from '@capstone/contracts';
	import { dev } from '$app/environment';
	import { goto } from '$app/navigation';
	import { getAuthClient } from '$lib/auth-client';
	import { Game } from '@capstone/game-logic';
	import { Client, type Room } from 'colyseus.js';
	let {
		data
	}: {
		data: {
			colyseusUrl: string;
			currentGameId: string | null;
			githubLoginEnabled: boolean;
			hasSession: boolean;
			user: { id: string; name: string | null; email: string | null } | null;
		};
	} = $props();

	let isSigningIn = $state(false);
	let isSigningOut = $state(false);
	let isStartingGame = $state(false);
	let matchmakingState = $state<'idle' | 'waiting' | 'matched' | 'failed'>('idle');
	let matchmakingMessage = $state<string | null>(null);
	let room: Room | null = null;

	type CapstoneDebug = {
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
	};

	let debugLastEvent: GameServerEvent | null = null;
	let debugLastSnapshot: GameSnapshot | null = null;
	let debugEvents: GameServerEvent[] = [];
	let debugSyncSeq = 0;
	let debugGame: Game | null = null;
	let debugGameSeq = -1;

	function attachDebugHelpers(currentRoom: Room | null) {
		if (!dev || typeof window === 'undefined') return;
		const debugWindow = window as Window & {
			__capstoneDebug?: CapstoneDebug;
			__capstoneRoom?: Room | null;
		};
		debugWindow.__capstoneDebug = {
			room: currentRoom,
			getRoomId: () => currentRoom?.roomId ?? null,
			getSyncSeq: () => debugSyncSeq,
			game: debugGame,
			getGame: () => debugGame,
			lastEvent: debugLastEvent,
			lastSnapshot: debugLastSnapshot,
			events: debugEvents,
			getSnapshot: () => debugLastSnapshot,
			getMoves: () => debugLastSnapshot?.moves ?? [],
			// Friendly args:
			// - from: pool stack index (0-2) of the *current turn* player
			// - to: board stack index (0-15)
			sendMove: (from: number, to: number) => {
				const poolIndex = Number(from);
				const boardIndex = Number(to);

				const game = debugGame;
				if (!game) throw new Error('No hydrated game snapshot yet.');

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
				currentRoom?.send('command', command);
			},
			awaitNextSync: async (timeoutMs = 5000) => {
				if (!currentRoom) throw new Error('No room connected.');
				const startSeq = debugSyncSeq;

				return await new Promise<GameSnapshot>((resolve, reject) => {
					const timeoutId = setTimeout(() => {
						unsub();
						reject(new Error('Timed out waiting for state_sync.'));
					}, timeoutMs);

					const unsub = currentRoom.onMessage('event', (payload: unknown) => {
						const parsed = gameServerEventSchema.safeParse(payload);
						if (!parsed.success) return;
						if (parsed.data.type !== 'state_sync') return;
						if (debugSyncSeq <= startSeq) return;
						clearTimeout(timeoutId);
						unsub();
						resolve(parsed.data.snapshot);
					});
				});
			},
			sendMoveAndWait: async (from: number, to: number, timeoutMs = 5000) => {
				const startSeq = debugSyncSeq;
				debugWindow.__capstoneDebug?.sendMove(from, to);
				const snapshot = await debugWindow.__capstoneDebug?.awaitNextSync(timeoutMs);
				if (!snapshot) throw new Error('No snapshot received.');
				// Ensure this was actually a new sync (not initial state).
				if (debugSyncSeq <= startSeq) throw new Error('No new state_sync received.');
				return snapshot;
			},
			joinByRoomId: async (roomId: string) => {
				if (!data.user) return;
				const client = new Client(data.colyseusUrl);
				const joined = await client.joinById(roomId, { userId: data.user.id });
				room = joined;
				wireRoom(joined);
			},
			clearEvents: () => {
				debugEvents = [];
				attachDebugHelpers(currentRoom);
			}
		};
	}

	function trackDebugEvent(event: GameServerEvent) {
		debugLastEvent = event;
		if (event.type === 'state_sync') {
			debugLastSnapshot = event.snapshot;
			debugSyncSeq += 1;

			if (debugGameSeq !== debugSyncSeq) {
				debugGame = Game.deserialize(event.snapshot.moves);
				debugGameSeq = debugSyncSeq;
			}
		}
		debugEvents = [...debugEvents.slice(-49), event];
	}

	function exposeRoomForDev(currentRoom: Room | null) {
		if (!dev || typeof window === 'undefined') return;
		const debugWindow = window as Window & {
			__capstoneDebug?: CapstoneDebug;
			__capstoneRoom?: Room | null;
		};
		debugWindow.__capstoneRoom = currentRoom;
		attachDebugHelpers(currentRoom);
	}

	async function signInWithGitHub() {
		isSigningIn = true;
		try {
			await getAuthClient().signIn.social({
				provider: 'github',
				callbackURL: '/'
			});
			// Keep loading state active while redirect/session propagation completes.
			// The page will naturally refresh into the logged-in state.
		} catch {
			isSigningIn = false;
		}
	}

	async function signOut() {
		isSigningOut = true;
		try {
			await getAuthClient().signOut();
			window.location.reload();
		} finally {
			isSigningOut = false;
		}
	}

	function wireRoom(currentRoom: Room) {
		exposeRoomForDev(currentRoom);
		currentRoom.onLeave(() => {
			if (room === currentRoom) {
				room = null;
			}
			exposeRoomForDev(null);
		});

		currentRoom.onMessage('event', (payload: unknown) => {
			const parsed = gameServerEventSchema.safeParse(payload);
			if (!parsed.success) {
				matchmakingState = 'failed';
				matchmakingMessage = 'Received unexpected realtime event.';
				return;
			}
			trackDebugEvent(parsed.data);
			attachDebugHelpers(currentRoom);

			if (parsed.data.type === 'waiting_for_player') {
				matchmakingState = 'waiting';
				matchmakingMessage = 'Waiting for another player...';
				return;
			}

			if (parsed.data.type === 'game_started') {
				matchmakingState = 'matched';
				matchmakingMessage = null;
				void goto('/game');
				return;
			}

			if (parsed.data.type === 'invalid_move') {
				matchmakingState = 'failed';
				matchmakingMessage = parsed.data.message;
			}
		});
	}

	async function startNewGame() {
		if (!data.user) return;
		isStartingGame = true;
		matchmakingState = 'idle';
		matchmakingMessage = null;

		try {
			const client = new Client(data.colyseusUrl);
			// Use Colyseus matchmaker so two different clients get paired into the same room.
			room = await client.joinOrCreate('capstone', { userId: data.user.id });
			wireRoom(room);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			matchmakingState = 'failed';
			matchmakingMessage = message || 'Unable to start matchmaking right now.';
		} finally {
			isStartingGame = false;
		}
	}
</script>

<main class="flex min-h-screen flex-col items-center justify-center gap-8 px-4">
	<div class="max-w-lg text-center">
		<h1 class="text-3xl font-semibold tracking-tight text-slate-900">Welcome</h1>
	</div>

	{#if data.hasSession}
		<div class="flex flex-col items-center gap-3">
			<p class="max-w-md text-center text-sm text-emerald-800">
				Logged in as
				<strong>{data.user?.name ?? data.user?.email ?? 'your account'}</strong>.
			</p>
			<button
				type="button"
				class="inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
				disabled={isSigningOut}
				onclick={signOut}
			>
				{isSigningOut ? 'Signing out…' : 'Log out'}
			</button>

			<div class="mt-2 flex flex-col items-center gap-2">
				<button
					type="button"
					class="inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
					disabled={isStartingGame || matchmakingState === 'waiting'}
					onclick={() => void startNewGame()}
				>
					{isStartingGame ? 'Starting...' : 'New Game'}
				</button>

				{#if data.currentGameId}
					<button
						type="button"
						class="inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm transition hover:bg-slate-50"
						onclick={() => goto('/game')}
					>
						Go to current game
					</button>
				{/if}
			</div>

			{#if matchmakingState === 'waiting'}
				<p class="text-sm text-slate-700">waiting for another player</p>
			{/if}

			{#if matchmakingMessage}
				<p class="text-sm text-rose-700">{matchmakingMessage}</p>
			{/if}
		</div>
	{:else if data.githubLoginEnabled}
		<div class="flex flex-col items-center gap-3">
			<button
				type="button"
				class="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
				disabled={isSigningIn}
				onclick={signInWithGitHub}
			>
				<svg class="h-5 w-5" viewBox="0 0 98 96" aria-hidden="true">
					<path
						fill="currentColor"
						fill-rule="evenodd"
						clip-rule="evenodd"
						d="M48.854 0C21.839 0 0 22 0 49.217c0 21.756 13.993 40.172 33.405 46.69 2.427.49 3.316-1.059 3.316-2.362 0-1.141-.08-5.052-.08-9.127-13.59 2.934-16.42-5.867-16.42-5.867-2.184-5.704-5.42-7.17-5.42-7.17-4.448-3.015.324-3.015.324-3.015 4.934.326 7.523 5.052 7.523 5.052 4.367 7.496 11.404 5.378 14.235 4.074.404-3.178 1.699-5.378 3.074-6.6-10.839-1.141-22.243-5.378-22.243-24.283 0-5.378 1.94-9.778 5.014-13.2-.485-1.222-2.184-6.275.486-13.038 0 0 4.125-1.304 13.426 5.052a46.97 46.97 0 0 1 12.214-1.63c4.125 0 8.33.571 12.213 1.63 9.302-6.356 13.427-5.052 13.427-5.052 2.67 6.763.97 11.816.485 13.038 3.155 3.422 5.015 7.822 5.015 13.2 0 18.905-11.404 23.06-22.324 24.283 1.78 1.548 3.316 4.481 3.316 9.126 0 6.6-.08 11.897-.08 13.526 0 1.304.89 2.853 3.316 2.364 19.412-6.52 33.405-24.934 33.405-46.691C97.707 22 75.788 0 48.854 0z"
					/>
				</svg>
				{isSigningIn ? 'Logging in…' : 'Log in with GitHub'}
			</button>
			{#if isSigningIn}
				<div
					class="inline-flex items-center gap-2 text-sm text-slate-600"
					role="status"
					aria-live="polite"
				>
					<span
						class="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700"
					></span>
					Connecting to GitHub…
				</div>
			{/if}
		</div>
	{:else}
		<p class="max-w-md text-center text-sm text-amber-800">
			GitHub login is not configured. Add <code
				class="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">GITHUB_CLIENT_ID</code
			>
			and
			<code class="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">GITHUB_CLIENT_SECRET</code>
			to your
			<code class="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">.env</code> (see
			<code class="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">.env.example</code>).
		</p>
	{/if}

	<p class="text-xs text-slate-500">
		Realtime server:
		<code class="rounded bg-slate-100 px-1 py-0.5 font-mono text-[11px]">{data.colyseusUrl}</code>
	</p>
</main>
