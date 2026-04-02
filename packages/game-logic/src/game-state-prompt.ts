import type { Game } from './Game';

/**
 * Human-readable snapshot for LLM prompts: board tops, pool tops, whose turn.
 * Indices match Game (0–15 board row-major; P1 pools 16–18; P2 pools 19–21).
 */
export function describeGameStateForPrompt(game: Game): string {
	const lines: string[] = [];

	lines.push(
		'Board (indices 0–15, row-major). Each cell: [idx] and top piece as P1/P2 + size 0–3, or .. if empty.'
	);
	for (let r = 0; r < 4; r++) {
		const cells: string[] = [];
		for (let c = 0; c < 4; c++) {
			const idx = r * 4 + c;
			const top = game.stacks[idx].topPiece();
			if (!top) cells.push(`[${idx}]..`);
			else {
				const p = top.player === game.player1 ? '1' : '2';
				cells.push(`[${idx}]P${p}${top.size}`);
			}
		}
		lines.push(cells.join('  '));
	}

	lines.push('');
	lines.push('Pools — top piece only (sizes 0 smallest, 3 largest):');
	const p1Parts: string[] = [];
	for (let i = 0; i < 3; i++) {
		const idx = 16 + i;
		const top = game.stacks[idx].topPiece();
		p1Parts.push(`${idx}:${top ? `P1 sz${top.size}` : 'empty'}`);
	}
	const p2Parts: string[] = [];
	for (let i = 0; i < 3; i++) {
		const idx = 19 + i;
		const top = game.stacks[idx].topPiece();
		p2Parts.push(`${idx}:${top ? `P2 sz${top.size}` : 'empty'}`);
	}
	lines.push(`  Player 1 (Black): ${p1Parts.join(' | ')}`);
	lines.push(`  Player 2 (White): ${p2Parts.join(' | ')}`);

	const turn = game.currentTurnIndex();
	lines.push('');
	lines.push(
		`Turn: Player ${turn + 1} (currentTurnIndex=${turn}). Only that player may move; "from" must be a stack where they own the top piece.`
	);

	return lines.join('\n');
}
