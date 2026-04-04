<script lang="ts">
	import Stack, { type StackProps } from './Stack.svelte';

	export type PoolProps = {
		stacks: StackProps[];
		class?: string;
	};

	let { stacks, class: className }: PoolProps = $props();

	const POOL_CELLS = 3 as const;
	let cells = $derived(
		Array.from({ length: POOL_CELLS }, (_, i) => stacks[i] ?? { pieces: [] })
	);
</script>

<div class={`pool ${className ?? ''}`.trim()}>
	{#each cells as stackProps, i (i)}
		<div class="pool__cell">
			<Stack {...stackProps} />
		</div>
	{/each}
</div>

<style>
	/* Rows match board cell size via --cell from .game (container query). */
	.pool {
		width: 100%;
		height: fit-content;
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		grid-template-rows: repeat(3, var(--cell, 4rem));
	}

	.pool__cell {
		width: 100%;
		height: 100%;
		min-width: 0;
		min-height: 0;
	}
</style>
