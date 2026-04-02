import { BoardLine, Player } from '@capstone/game-logic';

export function analyzeLine(line: BoardLine, player: Player) {
	const results = {
		winner: 0,
		loser: 0,
		threeInRow: {
			player: 0,
			opponent: 0
		},
		twoInRow: {
			player: 0,
			opponent: 0
		}
	};
	const opponent = player === player.game.player1 ? player.game.player2 : player.game.player1;
	const tops = line.stacks.map((stack) => stack.topPiece()?.player ?? null);

	results.winner = tops.every((top) => top === player) ? 1 : 0;
	if (results.winner) return results;

	results.loser = tops.every((top) => top === opponent) ? 1 : 0;
	if (results.loser) return results;

	for (let start = 0; start <= 1; start++) {
		const a = tops[start];
		const b = tops[start + 1];
		const c = tops[start + 2];
		if (a !== null && a === b && b === c) {
			if (a === player) results.threeInRow.player += 1;
			else if (a === opponent) results.threeInRow.opponent += 1;
		}
	}

	for (let start = 0; start <= 2; start++) {
		const a = tops[start];
		const b = tops[start + 1];
		if (a !== null && a === b) {
			if (a === player) results.twoInRow.player += 1;
			else if (a === opponent) results.twoInRow.opponent += 1;
		}
	}

	return results;
}
