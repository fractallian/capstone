import { createAuthClient } from 'better-auth/svelte';

/** Client-only: call from browser event handlers (e.g. click). */
export function getAuthClient() {
	return createAuthClient({
		baseURL: typeof window !== 'undefined' ? window.location.origin : ''
	});
}
