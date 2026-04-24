<script lang="ts">
	let {
		games,
		formatDate,
		getOpponentLabel
	}: {
		games: {
			id: string;
			opponent: { id: string; name: string | null; image: string | null } | null;
			status: 'in_progress';
			startedAt: string;
			endedAt: null;
			opponentOnline: boolean | null;
			isYourTurn: boolean;
		}[];
		formatDate: (value: string) => string;
		getOpponentLabel: (
			opponent: { id: string; name: string | null; image: string | null } | null
		) => string;
	} = $props();
</script>

<section class="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
	<div class="flex items-center justify-between gap-3">
		<h2 class="text-lg font-semibold text-slate-900">In Progress</h2>
		<span class="text-sm text-slate-500">{games.length}</span>
	</div>

	{#if games.length > 0}
		<div class="mt-4 flex flex-col gap-3">
			{#each games as gameRecord (gameRecord.id)}
				<a
					class={`block rounded-lg border p-4 transition hover:border-slate-300 ${
						gameRecord.isYourTurn
							? 'border-emerald-200 bg-emerald-50 hover:bg-emerald-100/60'
							: 'border-slate-200 bg-slate-50 hover:bg-white'
					}`}
					href={`/game/${gameRecord.id}`}
				>
					<div class="flex items-center gap-2">
						{#if gameRecord.opponent?.image}
							<img
								src={gameRecord.opponent.image}
								alt={getOpponentLabel(gameRecord.opponent)}
								class="h-7 w-7 rounded-full object-cover"
							/>
						{:else}
							<div
								class="flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-[10px] font-semibold text-slate-700"
							>
								{getOpponentLabel(gameRecord.opponent).slice(0, 2).toUpperCase()}
							</div>
						{/if}
						<p class="text-sm font-medium text-slate-900">{getOpponentLabel(gameRecord.opponent)}</p>
						{#if gameRecord.opponentOnline !== null}
							<span
								class={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${gameRecord.opponentOnline ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'}`}
							>
								{gameRecord.opponentOnline ? 'Online' : 'Offline'}
							</span>
						{/if}
					</div>
					<p class="mt-1 text-xs text-slate-600">Started {formatDate(gameRecord.startedAt)}</p>
				</a>
			{/each}
		</div>
	{:else}
		<p class="mt-4 text-sm text-slate-600">No in-progress games yet.</p>
	{/if}
</section>
