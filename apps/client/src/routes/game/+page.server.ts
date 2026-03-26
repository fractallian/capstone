import { redirect } from '@sveltejs/kit';

export const load = async ({ locals }) => {
	if (!locals.session) {
		throw redirect(302, '/');
	}

	if (!locals.currentGameId) {
		throw redirect(302, '/');
	}

	return {
		gameId: locals.currentGameId
	};
};
