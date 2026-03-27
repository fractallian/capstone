export const load = async ({ locals }) => {
	return {
		hasSession: Boolean(locals.session),
		user: locals.user
			? {
					id: locals.user.id,
					name: locals.user.name ?? null,
					email: locals.user.email ?? null,
					image: locals.user.image ?? null
				}
			: null
	};
};
