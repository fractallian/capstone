import { env } from '$env/dynamic/private';

export const load = async ({ locals }) => ({
	githubLoginEnabled: Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET),
	hasSession: Boolean(locals.session),
	user: locals.user
		? {
				name: locals.user.name ?? null,
				email: locals.user.email ?? null
			}
		: null
});
