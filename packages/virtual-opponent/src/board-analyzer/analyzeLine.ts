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

	let playerTops = 0;
	let opponentTops = 0;
	for (const top of tops) {
		if (top === null) continue;
		if (top === player) playerTops += 1;
		else if (top === opponent) opponentTops += 1;
	}
	const counts = { player: playerTops, opponent: opponentTops };
	results.threeInRow = counts;
	results.twoInRow = counts;

	return results;
}
