<script lang="ts">
	let { open = $bindable(false) }: { open?: boolean } = $props();

	let panelEl = $state<HTMLDivElement | undefined>();

	$effect(() => {
		if (!open || !panelEl) return;
		const prev = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			document.body.style.overflow = prev;
		};
	});
</script>

<svelte:window onkeydown={(e) => open && e.key === 'Escape' && (open = false)} />

{#if open}
	<div
		class="fixed inset-0 z-100 flex items-center justify-center p-2 sm:p-3 md:p-4"
		role="presentation"
	>
		<button
			type="button"
			class="absolute inset-0 bg-slate-900/50"
			onclick={() => (open = false)}
			aria-label="Close rules"
		></button>
		<div
			bind:this={panelEl}
			role="dialog"
			aria-modal="true"
			aria-labelledby="rules-title"
			tabindex="-1"
			class="relative flex h-[min(92dvh,calc(100dvh-1rem))] w-[min(72rem,calc(100vw-1rem))] flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white/95 shadow-2xl ring-1 ring-black/5 backdrop-blur-md sm:rounded-3xl"
		>
			<div
				class="flex shrink-0 items-start justify-between gap-4 bg-transparent px-5 pt-5 pb-3 sm:px-8 sm:pt-6 sm:pb-4"
			>
				<h2 id="rules-title" class="text-lg font-semibold text-slate-900">How to play</h2>
				<button
					type="button"
					class="shrink-0 rounded-full p-1.5 text-slate-500 transition-colors hover:bg-slate-900/6 hover:text-slate-800"
					onclick={() => (open = false)}
					aria-label="Close"
				>
					<svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
						<path
							d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"
						/>
					</svg>
				</button>
			</div>

			<div
				class="min-h-0 flex-1 overflow-x-hidden overflow-y-auto bg-transparent px-5 pb-6 sm:px-8 sm:pb-8"
			>
				<div
					class="prose max-w-none pb-1 prose-slate prose-headings:text-slate-900 prose-p:text-slate-700 prose-li:text-slate-700"
				>
					<p class="lead mt-0 text-slate-600">
						Capstone follows the spirit of classic stacking tic-tac-toe: get four in a row while
						pieces can cover smaller ones on the board.
					</p>

					<h3 class="text-base font-semibold">Goal</h3>
					<p>
						Be the first to line up four of your pieces in a row—across, down, or diagonally. Only
						the <em>top</em> piece on each square counts toward a line.
					</p>

					<h3 class="text-base font-semibold">Setup</h3>
					<p>
						Each side has twelve pieces in three off-board stacks. In each stack, the smallest piece
						sits at the bottom and the largest is on top—you must play from the top of a stack
						first, so you always use the largest remaining piece in that stack before the smaller
						ones beneath it.
					</p>

					<h3 class="text-base font-semibold">On your turn</h3>
					<p>Do exactly one of the following:</p>
					<ul>
						<li>
							<strong>Place from a stack</strong> onto an <strong>empty</strong> board square, using the
							next piece from one of your three stacks.
						</li>
						<li>
							<strong>Move on the board</strong> by moving one of your visible pieces to any empty square
							(moves are not limited to adjacent spaces).
						</li>
						<li>
							<strong>Cover a smaller piece</strong> by moving one of your larger pieces onto a
							square that holds any smaller piece—yours or your opponent’s. You may not place a
							piece on another piece of the <em>same</em> size.
						</li>
					</ul>

					<h3 class="text-base font-semibold">Placing from a stack onto occupied squares</h3>
					<p>
						Normally, a piece brought from your stacks must go on an empty square. The exception: if
						your opponent already has <strong>three in a row</strong> showing on top, you may use a
						larger piece from your stack to cover <strong>one</strong> of those three—interrupting the
						threat directly from your reserve.
					</p>

					<h3 class="text-base font-semibold">End of the game</h3>
					<p>
						The first player to show four in a row wins. If every piece is on the board and no one
						has won yet, play continues by moving pieces already in play. A draw is possible when
						the same sequence of moves repeats three times in a row, or by agreement—online, games
						typically end on a clear win or when players stop.
					</p>

					<p class="mb-0 text-sm text-slate-500">
						Rules summarized and reworded from the Gobblet&nbsp;X4 style of play (stacking
						four-in-a-row).
					</p>
				</div>
			</div>
		</div>
	</div>
{/if}
