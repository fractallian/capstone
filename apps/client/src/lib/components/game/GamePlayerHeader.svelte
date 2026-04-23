<script lang="ts">
	let {
		player1,
		player2,
		viewerPlayerIndex,
		currentTurnIndex,
		roomStatus,
		gameMessage,
		getPlayerLabel,
		vsAi = false,
		vsSelf = false,
		isAiThinking = false,
		isGameEnded = false,
		gameOutcome = null,
		winnerSeatIndex = null
	}: {
		player1: { id: string | null; name: string | null; image: string | null } | null;
		player2: { id: string | null; name: string | null; image: string | null } | null;
		viewerPlayerIndex: 1 | 2;
		currentTurnIndex: 0 | 1;
		roomStatus: 'connecting' | 'opponent_connected' | 'waiting_for_opponent' | 'disconnected';
		gameMessage: string | null;
		getPlayerLabel: (
			player: { id: string | null; name: string | null; image: string | null } | null
		) => string;
		vsAi?: boolean;
		vsSelf?: boolean;
		isAiThinking?: boolean;
		isGameEnded?: boolean;
		/** Set when the game ended with a known winner for the viewer. */
		gameOutcome?: 'win' | 'loss' | null;
		winnerSeatIndex?: 0 | 1 | null;
	} = $props();

	let isViewerTurn = $derived(
		(viewerPlayerIndex === 1 && currentTurnIndex === 0) ||
			(viewerPlayerIndex === 2 && currentTurnIndex === 1)
	);

	let turnBubbleLabel = $derived(
		isGameEnded
			? vsSelf
				? winnerSeatIndex === 1
					? 'Gold Wins!'
					: winnerSeatIndex === 0
						? 'Purple Wins!'
						: 'Game over'
				: gameOutcome === 'win'
					? 'You won!'
					: gameOutcome === 'loss'
						? 'You lost!'
						: 'Game over'
			: isAiThinking
				? 'CPU thinking…'
				: vsSelf
					? currentTurnIndex === 0
						? "Purple's Turn"
						: "Gold's Turn"
					: isViewerTurn
						? "It's Your Turn"
						: vsAi
							? "CPU's Turn"
							: "Opponent's Turn"
	);

	let turnBubbleClass = $derived(
		isGameEnded
			? vsSelf
				? winnerSeatIndex === 1
					? 'bg-amber-50 text-amber-950 ring-amber-200'
					: winnerSeatIndex === 0
						? 'bg-violet-50 text-violet-950 ring-violet-200'
						: 'bg-slate-100 text-slate-700 ring-slate-200'
				: gameOutcome === 'win'
					? 'bg-emerald-50 text-emerald-900 ring-emerald-200'
					: gameOutcome === 'loss'
						? 'bg-rose-50 text-rose-900 ring-rose-200'
						: 'bg-slate-100 text-slate-700 ring-slate-200'
			: vsSelf
				? currentTurnIndex === 0
					? 'bg-violet-50 text-violet-950 ring-violet-200'
					: 'bg-amber-50 text-amber-950 ring-amber-200'
				: isViewerTurn
					? 'bg-violet-50 text-violet-950 ring-violet-200'
					: 'bg-slate-100 text-slate-600 ring-slate-200'
	);

	let opponent = $derived(viewerPlayerIndex === 1 ? player2 : player1);
	let opponentSeatLabel = $derived(viewerPlayerIndex === 1 ? 'Player 2' : 'Player 1');

	function opponentInitials(p: typeof opponent) {
		const label = getPlayerLabel(p);
		const t = label.trim();
		if (t.length >= 2) return t.slice(0, 2).toUpperCase();
		return t.toUpperCase() || '?';
	}

	let showOpponentOnline = $derived(roomStatus === 'opponent_connected');
</script>

<header class="flex flex-col gap-3">
	<div class={`flex flex-wrap items-center gap-3 ${vsSelf ? 'justify-center' : 'justify-between'}`}>
		{#if !vsSelf}
			<div
				class="rounded-xl bg-violet-100 px-4 py-2 text-sm font-semibold tracking-tight text-violet-950 shadow-sm ring-1 ring-violet-200/80"
			>
				You
			</div>
		{/if}

		<div
			class={`rounded-full px-5 py-2 text-center text-sm font-semibold shadow-sm ring-1 ${turnBubbleClass}`}
			aria-live={isGameEnded ? 'polite' : undefined}
		>
			{turnBubbleLabel}
		</div>

		{#if !vsSelf}
			<div
				class="relative flex min-w-0 max-w-[min(100%,14rem)] items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm"
			>
				{#if showOpponentOnline}
					<span
						class="absolute top-2 right-2 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white"
						aria-label="Opponent active"
						title="Opponent active"
					></span>
				{/if}
				{#if opponent?.image}
					<img
						src={opponent.image}
						alt={getPlayerLabel(opponent)}
						class="h-11 w-11 shrink-0 rounded-full object-cover"
					/>
				{:else}
					<div
						class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-900 ring-1 ring-amber-200/80"
					>
						{opponentInitials(opponent)}
					</div>
				{/if}
				<div class="min-w-0 pr-1">
					<p class="truncate text-sm font-semibold text-slate-900">{getPlayerLabel(opponent)}</p>
					<p class="text-xs text-slate-500">{opponentSeatLabel}</p>
				</div>
			</div>
		{/if}
	</div>
	{#if gameMessage}
		<p class="text-sm text-rose-700">{gameMessage}</p>
	{/if}
</header>
