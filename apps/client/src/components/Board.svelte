<script lang="ts">
	import Stack, { type StackProps } from './Stack.svelte';

	type BoardProps = {
		stacks: StackProps[];
		class?: string;
	};

	let { stacks, class: className }: BoardProps = $props();

	const BOARD_CELLS = 16 as const;
	let cells = $derived(Array.from({ length: BOARD_CELLS }, (_, i) => stacks[i] ?? { pieces: [] }));
</script>

<div class={`board ${className ?? ''}`.trim()}>
	{#each cells as stackProps, i (i)}
		<div class="board__cell">
			<Stack {...stackProps} />
		</div>
	{/each}
</div>

<style>
	.board {
		width: 100%;
		height: 100%;
		aspect-ratio: 1 / 1;
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		grid-template-rows: repeat(4, minmax(0, 1fr));
		gap: 1px;
		padding: 1px;
		border-radius: 1rem;
		background: rgb(203 213 225);
		overflow: hidden;
	}

	.board__cell {
		width: 100%;
		height: 100%;
		background: rgb(241 245 249);
	}
</style>
