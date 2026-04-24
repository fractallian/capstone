<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import capstoneLogo from '$lib/assets/capstone-logo.svg';
	import Rules from '$lib/components/Rules.svelte';
	import Avatar from '$lib/components/Avatar.svelte';
	import { dev } from '$app/environment';
	import { getAuthClient } from '$lib/auth-client';

	let {
		children,
		data
	}: {
		children: import('svelte').Snippet;
		data: {
			hasSession: boolean;
			user: { id: string; name: string | null; email: string | null; image: string | null } | null;
		};
	} = $props();

	let isSigningOut = $state(false);
	let rulesOpen = $state(false);

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

	async function signOut() {
		isSigningOut = true;
		try {
			await getAuthClient().signOut();
			window.location.reload();
		} finally {
			isSigningOut = false;
		}
	}
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<div class="flex min-h-screen flex-col bg-slate-50">
	<header class="border-b border-slate-200 bg-white">
		<div class="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3">
			<a href="/" class="inline-flex shrink-0 items-center" aria-label="Go to lobby">
				<img src={capstoneLogo} alt="Capstone" class="h-16 w-auto" />
			</a>
			{#if data.hasSession && data.user}
				<div class="flex items-center gap-3">
					<Avatar
						id={data.user.id}
						image={data.user.image}
						label={data.user.name ?? data.user.email ?? 'User avatar'}
						sizeClass="h-9 w-9"
						textClass="text-xs"
					/>
					<div class="text-right">
						<p class="text-sm font-medium text-slate-900">
							{data.user.name ?? data.user.email ?? 'Signed in'}
						</p>
						<button
							type="button"
							class="text-xs text-slate-600 underline-offset-2 hover:underline disabled:opacity-60"
							disabled={isSigningOut}
							onclick={signOut}
						>
							{isSigningOut ? 'Signing out…' : 'Log out'}
						</button>
					</div>
				</div>
			{/if}
		</div>
	</header>

	<main class="flex min-h-0 flex-1 flex-col">
		{@render children()}
	</main>

	<footer class="border-t border-slate-200 bg-white">
		<div class="mx-auto flex max-w-6xl justify-center px-4 py-4">
			<button
				type="button"
				class="text-sm font-medium text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline"
				onclick={() => (rulesOpen = true)}
			>
				Rules
			</button>
		</div>
	</footer>

	<Rules bind:open={rulesOpen} />
</div>
