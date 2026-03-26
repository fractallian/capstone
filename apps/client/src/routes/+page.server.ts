import { env } from '$env/dynamic/private';
import { getColyseusPublicUrl } from '$lib/server/realtime/server';

export const load = async ({ locals, url }) => ({
	githubLoginEnabled: Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET),
	colyseusUrl: getColyseusPublicUrl(url),
	currentGameId: locals.currentGameId ?? null,
	hasSession: Boolean(locals.session),
	user: locals.user
		? {
				id: locals.user.id,
				name: locals.user.name ?? null,
				email: locals.user.email ?? null
			}
		: null
});
