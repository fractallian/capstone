<script lang="ts">
	import Piece, { type PieceProps } from './Piece.svelte';

	export type StackProps = {
		pieces: PieceProps[];
		class?: string;
	};

	let { pieces, class: className }: StackProps = $props();
</script>

<div class={`stack ${className ?? ''}`.trim()}>
	{#each pieces as piece, i (i)}
		<div class="stack__layer" style={`z-index:${i};`}>
			<Piece {...piece} />
		</div>
	{/each}
</div>

<style>
	.stack {
		width: 100%;
		height: 100%;
		aspect-ratio: 1 / 1;
		position: relative;
	}

	.stack__layer {
		position: absolute;
		inset: 0;
	}
</style>
