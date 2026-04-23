import type { Handle } from '@sveltejs/kit';
import { building } from '$app/environment';
import { auth } from '$lib/server/auth';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { realtimePresence } from '$lib/server/realtime/online-presence';
import { realtimeServer } from '$lib/server/realtime/server';

const handleBetterAuth: Handle = async ({ event, resolve }) => {
	if (!building) {
		void realtimeServer.ensureStarted();
	}
	const session = await auth.api.getSession({ headers: event.request.headers });

	if (session) {
		event.locals.session = session.session;
		event.locals.user = session.user;
		realtimePresence.noteActivity(session.user.id);
	}

	return svelteKitHandler({ event, resolve, auth, building });
};

export const handle: Handle = handleBetterAuth;
