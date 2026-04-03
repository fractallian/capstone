import { Game, listLegalMoves, SerializedMove } from '@capstone/game-logic';
import { BoardAnalyzer, type MoveScore } from './board-analyzer/BoardAnalyzer';
import { isLeapMove } from './isLeapMove';

export function chooseMove(game: Game) {
	const legalMoves = listLegalMoves(game);
	let bestMove: { move: SerializedMove; score: MoveScore } | null = null;
	for (const move of legalMoves) {
		const mover = game.currentTurn;
		const gameState = game.clone();
		gameState.makeMove(gameState.stacks[move.from], gameState.stacks[move.to]);
		// Score from the mover's perspective. After makeMove, currentTurn is the opponent — using that
		// would invert player/opponent and break defense (wouldLose blocks human wins).
		const moverInClone = mover === game.player1 ? gameState.player1 : gameState.player2;
		const analyzer = new BoardAnalyzer(gameState, moverInClone);
		analyzer.analyze();
		if (analyzer.winner()) return move;
		const score: MoveScore = {
			...analyzer.score(),
			leap: isLeapMove(game, move) ? 1 : 0
		};
		if (!bestMove) bestMove = { move, score };
		if (compareScores(score, bestMove.score) > 0) bestMove = { move, score };
	}
	return bestMove?.move ?? legalMoves[0];
}

const scoreCriteria: (keyof MoveScore)[] = [
	'winner',
	'wouldLose',
	'leap',
	'threeInRow',
	'oppThreeInRow',
	'twoInRow',
	'oppTwoInRow',
	'spaceDiff',
	'betterSpaces',
	'oppBetterSpaces'
];

function compareScores(score1: MoveScore, score2: MoveScore) {
	for (const criterion of scoreCriteria) {
		if (score1[criterion] > score2[criterion]) return 1;
		if (score1[criterion] < score2[criterion]) return -1;
	}
	return 0;
}
