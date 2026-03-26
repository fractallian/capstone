<script lang="ts">
	let { data }: { data: { gameId: string } } = $props();
</script>

<main class="flex min-h-screen items-center justify-center px-4">
	<section class="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
		<h1 class="text-2xl font-semibold text-slate-900">Game</h1>
		<p class="mt-2 text-sm text-slate-600">
			Current game id:
			<code class="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs">{data.gameId}</code>
		</p>
	</section>
</main>
