import type { Handle } from '@sveltejs/kit';
import { building } from '$app/environment';
import { auth } from '$lib/server/auth';
import { ensureRealtimeServer } from '$lib/server/realtime/server';
import { svelteKitHandler } from 'better-auth/svelte-kit';

const realtimeReady = building ? Promise.resolve() : ensureRealtimeServer();

const handleBetterAuth: Handle = async ({ event, resolve }) => {
	await realtimeReady;
	const session = await auth.api.getSession({ headers: event.request.headers });

	if (session) {
		event.locals.session = session.session;
		event.locals.user = session.user;
	}

	return svelteKitHandler({ event, resolve, auth, building });
};

export const handle: Handle = handleBetterAuth;
