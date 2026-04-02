import { Game, listLegalMoves, SerializedMove } from '@capstone/game-logic';
import { BoardAnalyzer, type MoveScore } from './board-analyzer/BoardAnalyzer';

export function chooseMove(game: Game) {
	const legalMoves = listLegalMoves(game);
	let bestMove: { move: SerializedMove; score: MoveScore } | null = null;
	for (const move of legalMoves) {
		const gameState = game.clone();
		gameState.makeMove(gameState.stacks[move.from], gameState.stacks[move.to]);
		const analyzer = new BoardAnalyzer(gameState, gameState.currentTurn);
		analyzer.analyze();
		if (analyzer.winner()) return move;
		if (!bestMove) bestMove = { move, score: analyzer.score() };
		const score = analyzer.score();
		if (compareScores(score, bestMove.score) > 0) bestMove = { move, score };
	}
	return bestMove?.move ?? legalMoves[0];
}

const scoreCriteria: (keyof MoveScore)[] = [
	'winner',
	'wouldLose',
	'threeInRow',
	'twoInRow',
	'spaceDiff',
	'centerSpaces',
	'cornerSpaces',
	'pieceWeight',
	'poolWeight'
];

function compareScores(score1: MoveScore, score2: MoveScore) {
	for (const criterion of scoreCriteria) {
		if (score1[criterion] > score2[criterion]) return 1;
		if (score1[criterion] < score2[criterion]) return -1;
	}
	return 0;
}
