<script lang="ts">
	let {
		player1,
		player2,
		viewerPlayerIndex,
		currentTurnIndex,
		roomStatus,
		gameMessage,
		getPlayerLabel
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
	} = $props();
</script>

<div class="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
	<div class="grid items-center gap-4 md:grid-cols-[1fr_auto_1fr]">
		<div
			class={`relative rounded-lg border bg-violet-50 p-4 ${
				currentTurnIndex === 0
					? viewerPlayerIndex === 1
						? 'border-2 border-emerald-600'
						: 'border-2 border-slate-500'
					: 'border-slate-200'
			}`}
		>
			{#if roomStatus === 'opponent_connected' && viewerPlayerIndex === 2}
				<span
					class="absolute top-1/2 right-3 h-3 w-3 -translate-y-1/2 rounded-full bg-emerald-500 ring-2 ring-white"
					aria-label="Opponent connected"
					title="Opponent connected"
				></span>
			{/if}
			<div class="flex items-center gap-3">
				{#if player1?.image}
					<img src={player1.image} alt={getPlayerLabel(player1)} class="h-10 w-10 rounded-full object-cover" />
				{:else}
					<div
						class="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700"
					>
						{getPlayerLabel(player1).slice(0, 2).toUpperCase()}
					</div>
				{/if}
				<div class="min-w-0">
					<p class="truncate text-sm font-semibold text-slate-900">{getPlayerLabel(player1)}</p>
					<p class="text-xs text-slate-600">Player 1</p>
				</div>
			</div>
		</div>
		<div class="text-center text-lg font-bold text-slate-500">VS.</div>
		<div
			class={`relative rounded-lg border bg-amber-50 p-4 ${
				currentTurnIndex === 1
					? viewerPlayerIndex === 2
						? 'border-2 border-emerald-600'
						: 'border-2 border-slate-500'
					: 'border-slate-200'
			}`}
		>
			{#if roomStatus === 'opponent_connected' && viewerPlayerIndex === 1}
				<span
					class="absolute top-1/2 right-3 h-3 w-3 -translate-y-1/2 rounded-full bg-emerald-500 ring-2 ring-white"
					aria-label="Opponent connected"
					title="Opponent connected"
				></span>
			{/if}
			<div class="flex items-center gap-3">
				{#if player2?.image}
					<img src={player2.image} alt={getPlayerLabel(player2)} class="h-10 w-10 rounded-full object-cover" />
				{:else}
					<div
						class="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700"
					>
						{getPlayerLabel(player2).slice(0, 2).toUpperCase()}
					</div>
				{/if}
				<div class="min-w-0">
					<p class="truncate text-sm font-semibold text-slate-900">{getPlayerLabel(player2)}</p>
					<p class="text-xs text-slate-600">Player 2</p>
				</div>
			</div>
		</div>
	</div>
	{#if gameMessage}
		<p class="mt-2 text-sm text-rose-700">{gameMessage}</p>
	{/if}
</div>
