<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { getAuthClient } from '$lib/auth-client';
	import { onMount } from 'svelte';
	import CompletedGamesSection from '$lib/components/lobby/CompletedGamesSection.svelte';
	import InProgressGamesSection from '$lib/components/lobby/InProgressGamesSection.svelte';

	let {
		data
	}: {
		data: {
			inProgressGames: {
				id: string;
				opponent: { id: string; name: string | null; image: string | null } | null;
				status: 'in_progress';
				startedAt: string;
				endedAt: null;
				isYourTurn: boolean;
			}[];
			waitingGames: {
				id: string;
				status: 'waiting';
				startedAt: string;
			}[];
			completedGames: {
				id: string;
				opponent: { id: string; name: string | null; image: string | null } | null;
				result: 'win' | 'loss' | 'purple' | 'gold';
				status: 'completed';
				startedAt: string;
				endedAt: string | null;
			}[];
			githubLoginEnabled: boolean;
			googleLoginEnabled: boolean;
			aiOpponentEnabled: boolean;
			vsSelfEnabled: boolean;
			hasSession: boolean;
			user: { id: string; name: string | null; email: string | null } | null;
		};
	} = $props();

	let isSigningIn = $state(false);
	let isSigningOut = $state(false);
	let isStartingGame = $state(false);
	let isAwaitingOpponentOptimistic = $state(false);
	let matchmakingMessage = $state<string | null>(null);

	let hasAwaitingOpponent = $derived(data.waitingGames.length > 0 || isAwaitingOpponentOptimistic);
	let hasSocialLogin = $derived(data.githubLoginEnabled || data.googleLoginEnabled);

	function formatDate(value: string) {
		return new Intl.DateTimeFormat(undefined, {
			dateStyle: 'medium',
			timeStyle: 'short'
		}).format(new Date(value));
	}

	function getOpponentLabel(
		opponent: { id: string; name: string | null; image: string | null } | null
	) {
		if (!opponent) return 'Opponent';
		const fallback = opponent.id.slice(-4);
		return opponent.name?.trim() || `Player ${fallback}`;
	}

	async function signInWithGitHub() {
		isSigningIn = true;
		try {
			await getAuthClient().signIn.social({
				provider: 'github',
				callbackURL: '/'
			});
		} catch {
			isSigningIn = false;
		}
	}

	async function signInWithGoogle() {
		isSigningIn = true;
		try {
			await getAuthClient().signIn.social({
				provider: 'google',
				callbackURL: '/'
			});
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

	async function startNewGame(attempt = 0) {
		if (!data.user) return;
		isStartingGame = true;
		matchmakingMessage = null;

		try {
			const response = await fetch('/api/matchmaking/new-game', { method: 'POST' });
			if (!response.ok) {
				throw new Error('Unable to fetch matchmaking candidates.');
			}
			const body = (await response.json()) as { gameId: string | null };
			if (body.gameId) {
				isAwaitingOpponentOptimistic = false;
				await goto(`/game/${body.gameId}`);
				void invalidateAll();
				return;
			}
			isAwaitingOpponentOptimistic = true;
			void invalidateAll();
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			if (attempt < 1) {
				await startNewGame(attempt + 1);
				return;
			}
			matchmakingMessage = message || 'Unable to start matchmaking right now.';
		} finally {
			isStartingGame = false;
		}
	}

	$effect(() => {
		if (data.waitingGames.length > 0) {
			isAwaitingOpponentOptimistic = false;
		}
	});

	async function startNewAiGame() {
		if (!data.user) return;
		isStartingGame = true;
		matchmakingMessage = null;
		try {
			const res = await fetch('/api/games/vs-ai', { method: 'POST' });
			if (!res.ok) {
				const errBody = (await res.json().catch(() => ({}))) as { error?: string };
				throw new Error(errBody.error ?? 'Unable to start AI game.');
			}
			const { gameId } = (await res.json()) as { gameId: string };
			await goto(`/game/${gameId}`);
			void invalidateAll();
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			matchmakingMessage = message || 'Unable to start AI game right now.';
		} finally {
			isStartingGame = false;
		}
	}

	async function startNewSelfGame() {
		if (!data.user) return;
		isStartingGame = true;
		matchmakingMessage = null;
		try {
			const res = await fetch('/api/games/vs-self', { method: 'POST' });
			if (!res.ok) {
				const errBody = (await res.json().catch(() => ({}))) as { error?: string };
				throw new Error(errBody.error ?? 'Unable to start game.');
			}
			const { gameId } = (await res.json()) as { gameId: string };
			await goto(`/game/${gameId}`);
			void invalidateAll();
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			matchmakingMessage = message || 'Unable to start game right now.';
		} finally {
			isStartingGame = false;
		}
	}

	onMount(() => {
		if (!data.hasSession) return;

		const refreshLobby = () => void invalidateAll();
		const intervalId = window.setInterval(refreshLobby, 3000);

		return () => {
			window.clearInterval(intervalId);
		};
	});
</script>

<div class="min-h-0 flex-1 bg-slate-50 px-4 py-8">
	<div class="mx-auto flex w-full max-w-6xl flex-col gap-8">
		{#if data.hasSession}
			<div class="flex flex-col gap-6">
				<div
					class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
				>
					<div class="flex flex-wrap items-center gap-2">
						{#if isStartingGame}
							<div class="inline-flex items-center gap-2 text-sm text-slate-600" role="status">
								<span
									class="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700"
								></span>
							</div>
						{:else}
							<div class="flex flex-wrap items-center gap-2">
								<button
									type="button"
									class="inline-flex cursor-pointer items-center rounded-lg border px-4 py-2 text-sm font-medium shadow-sm transition disabled:cursor-not-allowed disabled:opacity-70 {hasAwaitingOpponent
										? 'cursor-not-allowed border-amber-200 bg-amber-50 text-amber-950'
										: 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'}"
									disabled={hasAwaitingOpponent}
									onclick={() => void startNewGame()}
								>
									{hasAwaitingOpponent ? 'Awaiting Opponent' : 'New Game'}
								</button>
								{#if data.aiOpponentEnabled}
									<button
										type="button"
										class="inline-flex cursor-pointer items-center rounded-lg border border-violet-300 bg-violet-50 px-4 py-2 text-sm font-medium text-violet-900 shadow-sm transition hover:bg-violet-100"
										onclick={() => void startNewAiGame()}
									>
										Play vs CPU
									</button>
								{/if}
								{#if data.vsSelfEnabled}
									<button
										type="button"
										class="inline-flex cursor-pointer items-center rounded-lg border border-teal-300 bg-teal-50 px-4 py-2 text-sm font-medium text-teal-900 shadow-sm transition hover:bg-teal-100"
										onclick={() => void startNewSelfGame()}
									>
										Local Game
									</button>
								{/if}
							</div>
						{/if}
					</div>
				</div>

				{#if matchmakingMessage}
					<p class="text-sm text-rose-700">{matchmakingMessage}</p>
				{/if}

				<div class="grid gap-6 lg:grid-cols-2">
					<InProgressGamesSection games={data.inProgressGames} {formatDate} {getOpponentLabel} />
					<CompletedGamesSection games={data.completedGames} {formatDate} {getOpponentLabel} />
				</div>
			</div>
		{:else if hasSocialLogin}
			<div class="flex flex-col items-center gap-3">
				<div class="flex flex-wrap items-center justify-center gap-2">
					{#if data.githubLoginEnabled}
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
					{/if}
					{#if data.googleLoginEnabled}
						<button
							type="button"
							class="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
							disabled={isSigningIn}
							onclick={signInWithGoogle}
						>
							<svg class="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
								<path
									fill="#EA4335"
									d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.9-5.5 3.9-3.3 0-6-2.8-6-6.2s2.7-6.2 6-6.2c1.9 0 3.1.8 3.8 1.5l2.6-2.6C16.8 3 14.6 2 12 2 6.9 2 2.8 6.2 2.8 11.3S6.9 20.6 12 20.6c6.9 0 9.1-4.8 9.1-7.3 0-.5-.1-.9-.1-1.3z"
								/>
							</svg>
							{isSigningIn ? 'Logging in…' : 'Log in with Google'}
						</button>
					{/if}
				</div>
				{#if isSigningIn}
					<div
						class="inline-flex items-center gap-2 text-sm text-slate-600"
						role="status"
						aria-live="polite"
					>
						<span
							class="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700"
						></span>
						Connecting to provider…
					</div>
				{/if}
			</div>
		{:else}
			<p class="max-w-md text-center text-sm text-amber-800">
				Social login is not configured. Add <code
					class="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">GITHUB_CLIENT_ID</code
				>
				and
				<code class="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">GITHUB_CLIENT_SECRET</code>
				or
				<code class="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">GOOGLE_CLIENT_ID</code>
				and
				<code class="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">GOOGLE_CLIENT_SECRET</code>
				to your
				<code class="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">.env</code> (see
				<code class="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">.env.example</code>).
			</p>
		{/if}
	</div>
</div>
