<script lang="ts">
	import { browser } from '$app/environment';
	import Board from './Board.svelte';
	import Pool from './Pool.svelte';
	import type { StackProps } from './Stack.svelte';
	import { Game, Move, PlayerColor, type SerializedMove } from '@capstone/game-logic';

	export type GameProps = {
		moves: SerializedMove[];
		movesSyncKey: string;
		viewerPlayerIndex: 1 | 2;
		canInteract?: boolean;
		onMove?: (fromStackIndex: number, toStackIndex: number) => void | Promise<void>;
		class?: string;
	};

	let {
		moves,
		movesSyncKey,
		viewerPlayerIndex,
		canInteract = false,
		onMove,
		class: className
	}: GameProps = $props();
	let gameElement: HTMLDivElement | undefined;

	let localMoves = $state<SerializedMove[]>([]);

	$effect.pre(() => {
		void movesSyncKey;
		localMoves = [...moves];
	});

	let localGame = $derived(Game.deserialize(localMoves));

	let localStacks = $derived.by<StackProps[]>(() =>
		localGame.stacks.map((stack) => ({
			pieces: stack.pieces.map((piece) => ({
				size: piece.size,
				color: piece.player.color
			}))
		}))
	);

	let draggableColor = $derived(viewerPlayerIndex === 1 ? PlayerColor.Black : PlayerColor.White);
	let interactiveStacks = $derived.by<StackProps[]>(() =>
		localStacks.map((stack, stackIndex) => {
			const topPiece = stack.pieces.at(-1);
			return {
				...stack,
				stackIndex,
				isDropTarget: stackIndex < 16,
				isTopPieceDraggable: Boolean(canInteract && topPiece && topPiece.color === draggableColor)
			};
		})
	);
	let boardStacks = $derived(interactiveStacks.slice(0, 16));
	let player1PoolStacks = $derived(interactiveStacks.slice(16, 19));
	let player2PoolStacks = $derived(interactiveStacks.slice(19, 22));
	let viewerColor = $derived(viewerPlayerIndex === 1 ? 'Purple' : 'Gold');
	let localCurrentTurnIndex = $derived(localGame.currentTurnIndex());
	let isViewerTurn = $derived(
		(viewerPlayerIndex === 1 && localCurrentTurnIndex === 0) ||
			(viewerPlayerIndex === 2 && localCurrentTurnIndex === 1)
	);
	let dragBindingKey = $derived(
		`${JSON.stringify(localMoves)}|${interactiveStacks
			.map((stack) => `${stack.stackIndex}:${stack.isTopPieceDraggable ? '1' : '0'}`)
			.join('|')}`
	);
	let currentTurnLabel = $derived(
		`You are Player${viewerPlayerIndex} (${viewerColor}). It's ${isViewerTurn ? 'your' : "your opponent's"} turn.`
	);

	function isMoveLegal(fromStackIndex: number, toStackIndex: number): boolean {
		const g = Game.deserialize(localMoves);
		if (
			fromStackIndex < 0 ||
			fromStackIndex >= g.stacks.length ||
			toStackIndex < 0 ||
			toStackIndex >= g.stacks.length
		) {
			return false;
		}
		return new Move(g.currentTurn, g.stacks[fromStackIndex], g.stacks[toStackIndex]).isValid()
			.isValid;
	}

	function resetDraggedPiece(target: HTMLElement) {
		target.style.transform = 'translate(0px, 0px)';
		target.dataset.x = '0';
		target.dataset.y = '0';
		target.classList.remove('stack__layer--dragging');
	}

	function clearDropHoverClasses(el: HTMLElement) {
		el.classList.remove('stack--drop-hover-valid', 'stack--drop-hover-invalid');
	}

	$effect(() => {
		if (!browser) return;
		const root = gameElement;
		if (!root) return;
		void dragBindingKey;

		let cancelled = false;
		let cleanup = () => {};

		void import('interactjs').then(({ default: interact }) => {
			if (cancelled) return;

			const draggables = Array.from(
				root.querySelectorAll<HTMLElement>('.stack__layer--draggable')
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
				root.querySelectorAll<HTMLElement>('.stack--droppable')
			).map((element) =>
				interact(element).dropzone({
					accept: '.stack__layer--draggable',
					overlap: 0.2,
					ondragenter(event) {
						const el = event.target as HTMLElement;
						const toStackIndex = Number(el.dataset.stackIndex);
						const draggableElement = event.relatedTarget as HTMLElement | null;
						const fromStackIndex = Number(
							draggableElement?.closest<HTMLElement>('.stack')?.dataset.stackIndex
						);
						clearDropHoverClasses(el);
						if (
							!Number.isInteger(fromStackIndex) ||
							!Number.isInteger(toStackIndex) ||
							fromStackIndex === toStackIndex
						) {
							return;
						}
						el.classList.add(
							isMoveLegal(fromStackIndex, toStackIndex)
								? 'stack--drop-hover-valid'
								: 'stack--drop-hover-invalid'
						);
					},
					ondragleave(event) {
						clearDropHoverClasses(event.target as HTMLElement);
					},
					ondrop(event) {
						const target = event.target as HTMLElement;
						const toStackIndex = Number(target.dataset.stackIndex);
						const draggableElement = event.relatedTarget as HTMLElement;
						const fromStackIndex = Number(
							draggableElement.closest<HTMLElement>('.stack')?.dataset.stackIndex
						);

						clearDropHoverClasses(target);
						resetDraggedPiece(draggableElement);

						if (!Number.isInteger(fromStackIndex) || !Number.isInteger(toStackIndex)) return;
						if (fromStackIndex === toStackIndex) return;
						if (!isMoveLegal(fromStackIndex, toStackIndex)) return;

						localMoves = [...localMoves, { from: fromStackIndex, to: toStackIndex }];
						void onMove?.(fromStackIndex, toStackIndex);
					},
					ondropdeactivate(event) {
						clearDropHoverClasses(event.target as HTMLElement);
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

	<div
		class={`game__pool game__pool--left ${localCurrentTurnIndex === 0 ? 'game__pool--active' : ''}`.trim()}
	>
		<Pool stacks={player1PoolStacks} />
	</div>

	<div class="game__board">
		<Board stacks={boardStacks} />
	</div>

	<div
		class={`game__pool game__pool--right ${localCurrentTurnIndex === 1 ? 'game__pool--active' : ''}`.trim()}
	>
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

	.game--inactive .game__board {
		background: rgb(105, 107, 109);
		border-radius: 0.75rem;
	}

	.game__pool {
		width: 100%;
		height: 100%;
		border-radius: 0.75rem;
	}

	.game__pool--active {
		border: 2px solid rgb(51 65 85);
		background: rgba(248 250 252 / 0.5);
	}
</style>
