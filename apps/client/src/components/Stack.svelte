<script lang="ts">
	import Piece, { type PieceProps } from './Piece.svelte';

	export type StackProps = {
		pieces: PieceProps[];
		stackIndex?: number;
		isDropTarget?: boolean;
		isTopPieceDraggable?: boolean;
		class?: string;
	};

	let { pieces, stackIndex, isDropTarget = false, isTopPieceDraggable = false, class: className }: StackProps =
		$props();
</script>

<div
	class={`stack ${isDropTarget ? 'stack--droppable' : ''} ${className ?? ''}`.trim()}
	data-stack-index={stackIndex}
>
	{#each pieces as piece, i (i)}
		<div
			class={`stack__layer ${isTopPieceDraggable && i === pieces.length - 1 ? 'stack__layer--draggable' : ''}`.trim()}
			style={`z-index:${i};`}
		>
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

	.stack__layer--draggable {
		cursor: grab;
		touch-action: none;
	}

	.stack__layer--draggable:active {
		cursor: grabbing;
	}

	:global(.stack--drop-active) {
		background: rgb(220 252 231 / 0.9);
	}

	:global(.stack__layer--dragging) {
		opacity: 0.85;
	}
</style>
