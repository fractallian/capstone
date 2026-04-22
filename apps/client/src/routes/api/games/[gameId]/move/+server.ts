import { json } from '@sveltejs/kit';
import { gameCommandSchema } from '@capstone/contracts';
import { applyHttpGameMove } from '$lib/server/game/http-game-move';

export const POST = async ({ locals, params, request }) => {
	if (!locals.session || !locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON' }, { status: 400 });
	}

	const parsed = gameCommandSchema.safeParse(body);
	if (!parsed.success || parsed.data.type !== 'make_move') {
		return json({ error: 'Malformed command payload' }, { status: 400 });
	}

	const command = parsed.data;
	const result = await applyHttpGameMove({
		gameId: params.gameId,
		userId: locals.user.id,
		from: command.from,
		to: command.to
	});

	if (!result.ok) {
		const b = result.body;
		return json({ error: b.error, errors: 'errors' in b ? b.errors : undefined }, { status: b.status });
	}

	return json({ snapshot: result.snapshot });
};
