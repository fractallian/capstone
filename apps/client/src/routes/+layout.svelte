<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { dev } from '$app/environment';

	let { children } = $props();

	type CapstoneDebugStub = {
		room: unknown;
		info: string;
	};

	if (dev && typeof window !== 'undefined') {
		const w = window as Window & { __capstoneDebug?: unknown };
		if (!w.__capstoneDebug) {
			const stub: CapstoneDebugStub = {
				room: null,
				info: 'Debug helpers not attached yet. Join a room from / to populate __capstoneDebug.'
			};
			w.__capstoneDebug = stub;
		}
	}
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
{@render children()}
