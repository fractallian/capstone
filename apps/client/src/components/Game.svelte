<script lang="ts">
	import { browser, dev } from '$app/environment';
	import Board from './Board.svelte';
	import Pool from './Pool.svelte';
	import type { StackProps } from './Stack.svelte';
	import { setCapstoneGameBoardRoot } from '$lib/realtime/client-events';
	import { Game, Move, type SerializedMove } from '@capstone/game-logic';

	export type GameProps = {
		moves: SerializedMove[];
		movesSyncKey: string;
		startingTurnIndex: 0 | 1;
		/** Must match persisted snapshot; `deserialize(moves)` alone is wrong at ply 0 when seat 2 starts. */
		currentTurnIndex: 0 | 1;
		viewerPlayerIndex: 1 | 2;
		vsSelf?: boolean;
		canInteract?: boolean;
		onMove?: (fromStackIndex: number, toStackIndex: number) => void | Promise<void>;
		class?: string;
	};

	let {
		moves,
		movesSyncKey,
		startingTurnIndex,
		currentTurnIndex,
		viewerPlayerIndex,
		vsSelf = false,
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

	$effect(() => {
		if (!dev || !browser) return;
		setCapstoneGameBoardRoot(gameElement ?? null);
		return () => setCapstoneGameBoardRoot(null);
	});

	function hydrateGame(movesList: SerializedMove[], startingTurn: 0 | 1, turn: 0 | 1): Game {
		const g = Game.deserialize(movesList, startingTurn);
		g.currentTurn = turn === 1 ? g.player2 : g.player1;
		return g;
	}
	let localGame = $derived(hydrateGame(localMoves, startingTurnIndex, currentTurnIndex));

	let localStacks = $derived.by<StackProps[]>(() =>
		localGame.stacks.map((stack) => ({
			pieces: stack.pieces.map((piece) => ({
				size: piece.size,
				color: piece.player.color
			}))
		}))
	);

	let draggableColor = $derived.by(() => {
		if (vsSelf) {
			return localGame.currentTurn.color;
		}
		return viewerPlayerIndex === 1 ? localGame.player1.color : localGame.player2.color;
	});
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
	/** Viewer always on the left (matches board mock); stack indices stay server-correct. */
	let viewerPoolStacks = $derived(viewerPlayerIndex === 1 ? player1PoolStacks : player2PoolStacks);
	let opponentPoolStacks = $derived(
		viewerPlayerIndex === 1 ? player2PoolStacks : player1PoolStacks
	);
	let isViewerTurn = $derived(
		(viewerPlayerIndex === 1 && currentTurnIndex === 0) ||
			(viewerPlayerIndex === 2 && currentTurnIndex === 1)
	);
	let dragBindingKey = $derived(
		`${JSON.stringify(localMoves)}|${interactiveStacks
			.map((stack) => `${stack.stackIndex}:${stack.isTopPieceDraggable ? '1' : '0'}`)
			.join('|')}`
	);

	function isMoveLegal(fromStackIndex: number, toStackIndex: number): boolean {
		const g = hydrateGame(localMoves, startingTurnIndex, currentTurnIndex);
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
		gameElement?.classList.remove('game--drag-from-pool', 'game--drag-from-board');
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
							const stack = (event.target as HTMLElement).closest<HTMLElement>('.stack');
							const idx = Number(stack?.dataset.stackIndex);
							if (root && Number.isInteger(idx)) {
								root.classList.toggle('game--drag-from-pool', idx >= 16);
								root.classList.toggle('game--drag-from-board', idx < 16);
							}
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

			const dropzones = Array.from(root.querySelectorAll<HTMLElement>('.stack--droppable')).map(
				(element) =>
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

<div class="game-viewport">
	<div
		class={`game ${vsSelf ? 'game--vs-self' : ''} ${className ?? ''}`.trim()}
		bind:this={gameElement}
	>
		<div class={`game__pool game__pool--viewer ${isViewerTurn ? 'game__pool--turn' : ''}`.trim()}>
			<Pool stacks={viewerPoolStacks} />
		</div>

		<div class="game__board">
			<Board stacks={boardStacks} />
		</div>

		<div
			class={`game__pool game__pool--opponent ${!isViewerTurn ? 'game__pool--turn' : ''}`.trim()}
		>
			<Pool stacks={opponentPoolStacks} />
		</div>
	</div>
</div>

<style>
	/*
	 * Outer anchor supplies both cqw & cqh. --cell is the smaller of:
	 * - width fit: (W − gaps) / 6 (pool column = one board cell)
	 * - height fit: board is 4 cells tall ⇒ (H − pad) / 4
	 */
	.game-viewport {
		container-type: size;
		container-name: capstone-game;
		width: 100%;
		height: 100%;
		min-width: 0;
		min-height: 0;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.game {
		box-sizing: border-box;
		--col-gap: clamp(0.75rem, 2vw, 1.75rem);
		--pad-v: 0.375rem;
		--cell-from-w: calc((100cqw - 2 * var(--col-gap)) / 6);
		--cell-from-h: calc((100cqh - 2 * var(--pad-v)) / 4);
		--cell: min(var(--cell-from-w), var(--cell-from-h));
		display: grid;
		grid-template-columns: var(--cell) calc(4 * var(--cell)) var(--cell);
		column-gap: var(--col-gap);
		width: calc(6 * var(--cell) + 2 * var(--col-gap));
		max-width: 100%;
		height: calc(4 * var(--cell));
		max-height: 100%;
		margin-inline: auto;
		align-items: center;
		justify-items: stretch;
		min-width: 0;
	}

	.game__board {
		position: relative;
		z-index: 1;
		width: 100%;
		min-width: 0;
		aspect-ratio: 1 / 1;
		max-height: 100%;
		justify-self: stretch;
		align-self: center;
	}

	.game__pool {
		position: relative;
		z-index: 1;
		width: 100%;
		min-width: 0;
		align-self: center;
		justify-self: stretch;
	}

	/* Stack pools above the board only while dragging from a pool (DOM order would hide the piece). */
	.game--drag-from-pool .game__pool {
		z-index: 5;
	}
	.game--drag-from-pool .game__board {
		z-index: 0;
	}

	/* Stack the board above pools while dragging from the board (e.g. toward a pool). */
	.game--drag-from-board .game__board {
		z-index: 5;
	}
	.game--drag-from-board .game__pool {
		z-index: 0;
	}

	/*
	 * Real border + overflow clip — spread box-shadow borders often gap at border-radius
	 * on some GPUs. 1px border + border-box keeps pool width on the same grid track.
	 */
	.game__pool--viewer {
		box-sizing: border-box;
		border-radius: 0.5rem;
		background: rgb(255 255 255);
		/* visible so dragged pieces aren’t clipped over the board; border-radius still frames the pool */
		overflow: visible;
		box-shadow: 0 1px 2px rgb(15 23 42 / 0.06);
	}

	.game__pool--viewer.game__pool--turn {
		box-shadow: 0 1px 3px rgb(124 58 237 / 0.2);
	}

	/* Opponent pool: open layout, no box */
	.game__pool--opponent {
		padding: 0.25rem 0;
	}

	.game__pool--opponent.game__pool--turn {
		filter: drop-shadow(0 0 0.35rem rgb(245 158 11 / 0.35));
	}

	/* vsSelf uses the open pool style on both sides (no boxed border around active pool). */
	.game--vs-self .game__pool--viewer {
		border-radius: 0;
		background: transparent;
		box-shadow: none;
	}
</style>
