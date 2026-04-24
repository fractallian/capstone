<script lang="ts">
	import Avatar from '$lib/components/Avatar.svelte';
	let {
		games,
		formatDate,
		getOpponentLabel
	}: {
		games: {
			id: string;
			opponent: { id: string; name: string | null; image: string | null } | null;
			result: 'win' | 'loss' | 'purple' | 'gold';
			status: 'completed';
			startedAt: string;
			endedAt: string | null;
		}[];
		formatDate: (value: string) => string;
		getOpponentLabel: (
			opponent: { id: string; name: string | null; image: string | null } | null
		) => string;
	} = $props();
</script>

<section class="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
	<div class="flex items-center justify-between gap-3">
		<h2 class="text-lg font-semibold text-slate-900">Completed</h2>
		<span class="text-sm text-slate-500">{games.length}</span>
	</div>

	{#if games.length > 0}
		<div class="mt-4 flex flex-col gap-3">
			{#each games as gameRecord (gameRecord.id)}
				<a
					class="block rounded-lg border border-slate-200 bg-slate-50 p-4 transition hover:border-slate-300 hover:bg-white"
					href={`/game/${gameRecord.id}`}
				>
					<div class="flex items-center justify-between gap-3">
						<div
							class={`flex h-10 w-10 items-center justify-center rounded-lg text-xl font-extrabold ${
								gameRecord.result === 'win'
									? 'bg-emerald-100 text-emerald-700'
									: gameRecord.result === 'loss'
										? 'bg-rose-100 text-rose-700'
										: gameRecord.result === 'purple'
											? 'bg-violet-100 text-violet-700'
											: 'bg-amber-100 text-amber-700'
							}`}
							aria-label={gameRecord.result === 'win'
								? 'Win'
								: gameRecord.result === 'loss'
									? 'Loss'
									: gameRecord.result === 'purple'
										? 'Purple wins'
										: 'Gold wins'}
							title={gameRecord.result === 'win'
								? 'Win'
								: gameRecord.result === 'loss'
									? 'Loss'
									: gameRecord.result === 'purple'
										? 'Purple wins'
										: 'Gold wins'}
						>
							{gameRecord.result === 'win'
								? 'W'
								: gameRecord.result === 'loss'
									? 'L'
									: gameRecord.result === 'purple'
										? 'P'
										: 'G'}
						</div>
						<div class="flex min-w-0 items-center gap-2">
							{#if gameRecord.opponent?.id !== 'ai' && gameRecord.opponent?.id !== 'self'}
								{#if gameRecord.opponent?.image}
									<Avatar
										id={gameRecord.opponent.id}
										image={gameRecord.opponent.image}
										label={getOpponentLabel(gameRecord.opponent)}
										sizeClass="h-7 w-7"
										textClass="text-[10px]"
									/>
								{:else}
									<div
										class="flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-[10px] font-semibold text-slate-700"
									>
										{getOpponentLabel(gameRecord.opponent).slice(0, 2).toUpperCase()}
									</div>
								{/if}
							{/if}
							<p class="truncate text-sm font-medium text-slate-900">
								{getOpponentLabel(gameRecord.opponent)}
							</p>
						</div>
					</div>
					<p class="mt-1 text-xs text-slate-600">
						Completed {formatDate(gameRecord.endedAt ?? gameRecord.startedAt)}
					</p>
				</a>
			{/each}
		</div>
	{:else}
		<p class="mt-4 text-sm text-slate-600">No completed games yet.</p>
	{/if}
</section>
