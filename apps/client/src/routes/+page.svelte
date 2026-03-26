<script lang="ts">
	import { getAuthClient } from '$lib/auth-client';
	let { data }: {
		data: {
			githubLoginEnabled: boolean;
			hasSession: boolean;
			user: { name: string | null; email: string | null } | null;
		};
	} = $props();

	let busy = $state(false);

	async function signInWithGitHub() {
		busy = true;
		try {
			await getAuthClient().signIn.social({
				provider: 'github',
				callbackURL: '/'
			});
		} finally {
			busy = false;
		}
	}

	async function signOut() {
		busy = true;
		try {
			await getAuthClient().signOut();
			window.location.reload();
		} finally {
			busy = false;
		}
	}
</script>

<main class="flex min-h-screen flex-col items-center justify-center gap-8 px-4">
	<div class="max-w-lg text-center">
		<h1 class="text-3xl font-semibold tracking-tight text-slate-900">Welcome</h1>
		<p class="mt-3 text-slate-600">
			Visit <a class="text-emerald-700 underline hover:text-emerald-800" href="https://svelte.dev/docs/kit"
				>svelte.dev/docs/kit</a
			> for SvelteKit documentation.
		</p>
	</div>

	{#if data.hasSession}
		<div class="flex flex-col items-center gap-3">
			<p class="max-w-md text-center text-sm text-emerald-800">
				Logged in as
				<strong>{data.user?.name ?? data.user?.email ?? 'your account'}</strong>.
			</p>
			<button
				type="button"
				class="inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
				disabled={busy}
				onclick={signOut}
			>
				{busy ? 'Signing out…' : 'Log out'}
			</button>
		</div>
	{:else if data.githubLoginEnabled}
		<button
			type="button"
			class="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
			disabled={busy}
			onclick={signInWithGitHub}
		>
			<svg class="h-5 w-5" viewBox="0 0 98 96" aria-hidden="true">
				<path
					fill="currentColor"
					fill-rule="evenodd"
					clip-rule="evenodd"
					d="M48.854 0C21.839 0 0 22 0 49.217c0 21.756 13.993 40.172 33.405 46.69 2.427.49 3.316-1.059 3.316-2.362 0-1.141-.08-5.052-.08-9.127-13.59 2.934-16.42-5.867-16.42-5.867-2.184-5.704-5.42-7.17-5.42-7.17-4.448-3.015.324-3.015.324-3.015 4.934.326 7.523 5.052 7.523 5.052 4.367 7.496 11.404 5.378 14.235 4.074.404-3.178 1.699-5.378 3.074-6.6-10.839-1.141-22.243-5.378-22.243-24.283 0-5.378 1.94-9.778 5.014-13.2-.485-1.222-2.184-6.275.486-13.038 0 0 4.125-1.304 13.426 5.052a46.97 46.97 0 0 1 12.214-1.63c4.125 0 8.33.571 12.213 1.63 9.302-6.356 13.427-5.052 13.427-5.052 2.67 6.763.97 11.816.485 13.038 3.155 3.422 5.015 7.822 5.015 13.2 0 18.905-11.404 23.06-22.324 24.283 1.78 1.548 3.316 4.481 3.316 9.126 0 6.6-.08 11.897-.08 13.526 0 1.304.89 2.853 3.316 2.364 19.412-6.52 33.405-24.934 33.405-46.691C97.707 22 75.788 0 48.854 0z"
				/>
			</svg>
			{busy ? 'Redirecting…' : 'Log in with GitHub'}
		</button>
	{:else}
		<p class="max-w-md text-center text-sm text-amber-800">
			GitHub login is not configured. Add <code class="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs"
				>GITHUB_CLIENT_ID</code
			>
			and
			<code class="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">GITHUB_CLIENT_SECRET</code> to your
			<code class="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">.env</code> (see
			<code class="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">.env.example</code>).
		</p>
	{/if}
</main>
