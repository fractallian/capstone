<script lang="ts">
	import Board from './Board.svelte';
	import Pool from './Pool.svelte';
	import type { StackProps } from './Stack.svelte';

	export type GameProps = {
		stacks: StackProps[];
		currentTurnIndex?: 0 | 1;
		viewerPlayerIndex: 1 | 2;
		class?: string;
	};

	let { stacks, currentTurnIndex, viewerPlayerIndex, class: className }: GameProps = $props();

	// Stack indexes:
	// 0-15 board, 16-18 left pool (player1), 19-21 right pool (player2)
	let boardStacks = $derived(stacks.slice(0, 16));
	let player1PoolStacks = $derived(stacks.slice(16, 19));
	let player2PoolStacks = $derived(stacks.slice(19, 22));
	let viewerColor = $derived(viewerPlayerIndex === 1 ? 'Purple' : 'Gold');
	let isViewerTurn = $derived(
		(viewerPlayerIndex === 1 && currentTurnIndex === 0) ||
			(viewerPlayerIndex === 2 && currentTurnIndex === 1)
	);
	let currentTurnLabel = $derived(
		`You are Player${viewerPlayerIndex} (${viewerColor}). It's ${isViewerTurn ? 'your' : "your opponent's"} turn.`
	);
</script>

<div class={`game ${className ?? ''}`.trim()}>
	<div class="game__status">
		<span class="game__turn">{currentTurnLabel}</span>
	</div>

	<div class="game__pool game__pool--left">
		<Pool stacks={player1PoolStacks} />
	</div>

	<div class="game__board">
		<Board stacks={boardStacks} />
	</div>

	<div class="game__pool game__pool--right">
		<Pool stacks={player2PoolStacks} />
	</div>
</div>

<style>
	.game {
		width: 100%;
		height: 100%;
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 4fr) minmax(0, 1fr);
		grid-template-rows: auto minmax(0, 1fr);
		column-gap: 1.5rem;
		row-gap: 0;
		align-items: stretch;
	}

	.game__status {
		grid-column: 1 / -1;
		display: flex;
		justify-content: center;
		padding-bottom: 0.75rem;
	}

	.game__turn {
		border-radius: 9999px;
		background: rgb(241 245 249);
		color: rgb(15 23 42);
		font-size: 0.875rem;
		font-weight: 600;
		line-height: 1.25rem;
		padding: 0.375rem 0.75rem;
	}

	.game__board {
		width: 100%;
		height: 100%;
	}

	.game__pool {
		width: 100%;
		height: 100%;
	}
</style>
