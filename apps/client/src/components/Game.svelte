<script lang="ts">
	import { browser } from '$app/environment';
	import Board from './Board.svelte';
	import Pool from './Pool.svelte';
	import type { StackProps } from './Stack.svelte';

	export type GameProps = {
		stacks: StackProps[];
		currentTurnIndex?: 0 | 1;
		viewerPlayerIndex: 1 | 2;
		canInteract?: boolean;
		onMove?: (fromStackIndex: number, toStackIndex: number) => void | Promise<void>;
		class?: string;
	};

	let {
		stacks,
		currentTurnIndex,
		viewerPlayerIndex,
		canInteract = false,
		onMove,
		class: className
	}: GameProps = $props();
	let gameElement: HTMLDivElement | undefined;

	function cloneStacks(nextStacks: StackProps[]): StackProps[] {
		return nextStacks.map((stack) => ({
			...stack,
			pieces: stack.pieces.map((piece) => ({ ...piece }))
		}));
	}

	function stacksKey(nextStacks: StackProps[]): string {
		return nextStacks
			.map((stack, stackIndex) =>
				`${stackIndex}:${stack.pieces.map((piece) => `${piece.color}-${piece.size}`).join(',')}`
			)
			.join('|');
	}

	let localStacks = $state(cloneStacks(stacks));
	let localCurrentTurnIndex = $state<0 | 1>(currentTurnIndex ?? 0);
	let incomingStateKey = $derived(`${currentTurnIndex ?? 0}::${stacksKey(stacks)}`);

	// Stack indexes:
	// 0-15 board, 16-18 left pool (player1), 19-21 right pool (player2)
	let draggableColor = $derived(viewerPlayerIndex === 1 ? 1 : 0);
	let interactiveStacks = $derived.by<StackProps[]>(() =>
		localStacks.map((stack, stackIndex) => {
			const topPiece = stack.pieces.at(-1);
			return {
				...stack,
				stackIndex,
				isDropTarget: stackIndex < 16,
				isTopPieceDraggable: Boolean(
					canInteract && topPiece && topPiece.color === draggableColor
				)
			};
		})
	);
	let boardStacks = $derived(interactiveStacks.slice(0, 16));
	let player1PoolStacks = $derived(interactiveStacks.slice(16, 19));
	let player2PoolStacks = $derived(interactiveStacks.slice(19, 22));
	let viewerColor = $derived(viewerPlayerIndex === 1 ? 'Purple' : 'Gold');
	let isViewerTurn = $derived(
		(viewerPlayerIndex === 1 && localCurrentTurnIndex === 0) ||
			(viewerPlayerIndex === 2 && localCurrentTurnIndex === 1)
	);
	let dragBindingKey = $derived(
		interactiveStacks
			.map((stack) => `${stack.stackIndex}:${stack.isTopPieceDraggable ? '1' : '0'}`)
			.join('|')
	);
	let currentTurnLabel = $derived(
		`You are Player${viewerPlayerIndex} (${viewerColor}). It's ${isViewerTurn ? 'your' : "your opponent's"} turn.`
	);

	function applyOptimisticMove(fromStackIndex: number, toStackIndex: number) {
		const fromStack = localStacks[fromStackIndex];
		const toStack = localStacks[toStackIndex];
		const movedPiece = fromStack?.pieces.at(-1);

		if (!fromStack || !toStack || !movedPiece) return;

		localStacks = localStacks.map((stack, stackIndex) => {
			if (stackIndex === fromStackIndex) {
				return {
					...stack,
					pieces: stack.pieces.slice(0, -1)
				};
			}

			if (stackIndex === toStackIndex) {
				return {
					...stack,
					pieces: [...stack.pieces, movedPiece]
				};
			}

			return stack;
		});

		localCurrentTurnIndex = localCurrentTurnIndex === 0 ? 1 : 0;
	}

	function resetDraggedPiece(target: HTMLElement) {
		target.style.transform = 'translate(0px, 0px)';
		target.dataset.x = '0';
		target.dataset.y = '0';
		target.classList.remove('stack__layer--dragging');
	}

	$effect(() => {
		void incomingStateKey;
		localStacks = cloneStacks(stacks);
		localCurrentTurnIndex = currentTurnIndex ?? 0;
	});

	$effect(() => {
		if (!browser || !gameElement) return;
		void dragBindingKey;

		let cancelled = false;
		let cleanup = () => {};

		void import('interactjs').then(({ default: interact }) => {
			if (cancelled) return;

			const draggables = Array.from(
				gameElement.querySelectorAll<HTMLElement>('.stack__layer--draggable')
			).map((element) =>
				interact(element).draggable({
					listeners: {
						start(event) {
							event.target.classList.add('stack__layer--dragging');
						},
						move(event) {
							const target = event.target as HTMLElement;
							const x = (Number(target.dataset.x) || 0) + event.dx;
							const y = (Number(target.dataset.y) || 0) + event.dy;
							target.style.transform = `translate(${x}px, ${y}px)`;
							target.dataset.x = String(x);
							target.dataset.y = String(y);
						},
						end(event) {
							resetDraggedPiece(event.target as HTMLElement);
						}
					}
				})
			);

			const dropzones = Array.from(
				gameElement.querySelectorAll<HTMLElement>('.stack--droppable')
			).map((element) =>
				interact(element).dropzone({
					accept: '.stack__layer--draggable',
					overlap: 0.2,
					ondragenter(event) {
						(event.target as HTMLElement).classList.add('stack--drop-active');
					},
					ondragleave(event) {
						(event.target as HTMLElement).classList.remove('stack--drop-active');
					},
					ondrop(event) {
						const toStackIndex = Number((event.target as HTMLElement).dataset.stackIndex);
						const draggableElement = event.relatedTarget as HTMLElement;
						const fromStackIndex = Number(
							draggableElement.closest<HTMLElement>('.stack')?.dataset.stackIndex
						);

						(event.target as HTMLElement).classList.remove('stack--drop-active');
						resetDraggedPiece(draggableElement);

						if (!Number.isInteger(fromStackIndex) || !Number.isInteger(toStackIndex)) return;
						if (fromStackIndex === toStackIndex) return;
						applyOptimisticMove(fromStackIndex, toStackIndex);
						void onMove?.(fromStackIndex, toStackIndex);
					},
					ondropdeactivate(event) {
						(event.target as HTMLElement).classList.remove('stack--drop-active');
					}
				})
			);

			cleanup = () => {
				for (const draggable of draggables) draggable.unset();
				for (const dropzone of dropzones) dropzone.unset();
			};
		});

		return () => {
			cancelled = true;
			cleanup();
		};
	});
</script>

<div class={`game ${className ?? ''}`.trim()} bind:this={gameElement}>
	<div class="game__status">
		<span class={`game__turn ${isViewerTurn ? 'game__turn--active' : ''}`.trim()}>
			{currentTurnLabel}
		</span>
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

	.game__turn--active {
		background: rgb(220 252 231);
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
