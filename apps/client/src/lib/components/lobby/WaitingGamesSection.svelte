<script lang="ts">
	let {
		games,
		formatDate
	}: {
		games: {
			id: string;
			status: 'waiting';
			startedAt: string;
		}[];
		formatDate: (value: string) => string;
	} = $props();
</script>

{#if games.length > 0}
	<section class="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
		<div class="flex items-center justify-between gap-3">
			<h2 class="text-lg font-semibold text-slate-900">Waiting</h2>
			<span class="text-sm text-slate-500">{games.length}</span>
		</div>

		<div class="mt-4 flex flex-col gap-3">
			{#each games as gameRecord (gameRecord.id)}
				<div class="block rounded-lg border border-amber-200 bg-amber-50 p-4">
					<div class="flex items-center justify-between gap-3">
						<p class="text-sm font-medium text-slate-900">Waiting for opponent</p>
						<span
							class="inline-flex h-2.5 w-2.5 rounded-full bg-amber-500"
							aria-label="Waiting for opponent"
						></span>
					</div>
					<p class="mt-1 text-xs text-slate-600">Started {formatDate(gameRecord.startedAt)}</p>
				</div>
			{/each}
		</div>
	</section>
{/if}
