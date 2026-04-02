import { BoardLine, Game, listLegalMoves, Player } from '@capstone/game-logic';
import { analyzeLine } from './analyzeLine';

type PlayerScores = {
	player: number;
	opponent: number;
};

type Cache = {
	lines: BoardLine[];
	winner?: boolean;
	wouldLose?: boolean;
	threeInRow?: PlayerScores;
	twoInRow?: PlayerScores;
	spaceDiff?: number;
	centerSpaces?: PlayerScores;
	cornerSpaces?: PlayerScores;
	pieceWeight?: number;
	poolWeight?: number;
};

export type MoveScore = {
	winner: number;
	wouldLose: number;
	threeInRow: number;
	twoInRow: number;
	spaceDiff: number;
	centerSpaces: number;
	cornerSpaces: number;
	pieceWeight: number;
	poolWeight: number;
};

type WithRequired<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;
type AnalyzedCache = WithRequired<Cache, 'winner' | 'wouldLose' | 'threeInRow' | 'twoInRow'>;

const isAnalyzedCache = (cache: Cache): cache is AnalyzedCache => {
	return (
		cache.winner !== undefined &&
		cache.wouldLose !== undefined &&
		cache.threeInRow !== undefined &&
		cache.twoInRow !== undefined
	);
};

const NotAnalyzedError = new Error('Call analyze() first');

const throwIfNotAnalyzed = (cache: Cache): AnalyzedCache => {
	if (!isAnalyzedCache(cache)) throw NotAnalyzedError;
	return cache;
};

export class BoardAnalyzer {
	game: Game;
	player: Player;
	opponent: Player;
	cache: Cache;
	analyzed: boolean;

	constructor(game: Game, player: Player) {
		this.game = game;
		this.player = player;
		this.opponent = player === game.player1 ? game.player2 : game.player1;
		this.cache = {
			lines: game.board.lines()
		};
		this.analyzed = false;
	}

	public analyze() {
		this.analyzed = true;
		this.cache.threeInRow = {
			player: 0,
			opponent: 0
		};
		this.cache.twoInRow = {
			player: 0,
			opponent: 0
		};
		for (const line of this.cache.lines) {
			const analysis = analyzeLine(line, this.player);
			if (analysis.winner) {
				this.cache.winner = true;
				this.cache.wouldLose = false;
				return;
			}
			if (analysis.loser) {
				this.cache.wouldLose = true;
				this.cache.winner = false;
				return;
			}
			this.cache.threeInRow.player += analysis.threeInRow.player;
			this.cache.threeInRow.opponent += analysis.threeInRow.opponent;
			this.cache.twoInRow.player += analysis.twoInRow.player;
			this.cache.twoInRow.opponent += analysis.twoInRow.opponent;
		}
		this.cache.winner = false;
		this.cache.wouldLose = false;
	}

	public score(): MoveScore {
		return {
			winner: this.winner(),
			wouldLose: this.wouldLose(),
			threeInRow: this.threeInRow(),
			twoInRow: this.twoInRow(),
			spaceDiff: 0,
			centerSpaces: 0,
			cornerSpaces: 0,
			pieceWeight: 0,
			poolWeight: 0
		};
	}

	public winner() {
		const cache = throwIfNotAnalyzed(this.cache);
		return cache.winner ? 1 : 0;
	}

	public wouldLose() {
		const cache = throwIfNotAnalyzed(this.cache);
		// 1 is better, 0 is worse
		if (cache.wouldLose) return 0;
		// if this is the opponent's turn, evaluate all their potential moves and see if any of them cause the opponent to win
		if (this.game.currentTurn === this.player) return 1;
		for (const move of listLegalMoves(this.game)) {
			const gameState = this.game.clone();
			gameState.makeMove(gameState.stacks[move.from], gameState.stacks[move.to]);
			const opponentInClone =
				gameState.player1 === gameState.currentTurn ? gameState.player2 : gameState.player1;
			const analyzer = new BoardAnalyzer(gameState, opponentInClone);
			analyzer.analyze();
			if (analyzer.winner()) return 0; // opponent wins
		}
		return 1;
	}

	public threeInRow() {
		const cache = throwIfNotAnalyzed(this.cache);
		return cache.threeInRow.player;
	}

	public twoInRow() {
		const cache = throwIfNotAnalyzed(this.cache);
		return cache.twoInRow.player;
	}
}
