import { BoardLine, Game, listLegalMoves, Player } from '@capstone/game-logic';
import { analyzeLine } from './analyzeLine';

type PlayerScores = {
	player: number;
	opponent: number;
};

type Cache = {
	lines: BoardLine[];
	winner: boolean;
	wouldLose: boolean;
	spaceDiff: number;
	threeInRow: PlayerScores;
	twoInRow: PlayerScores;
	betterSpaces: PlayerScores;
};

const INITIAL_CACHE: Omit<Cache, 'lines'> = {
	winner: false,
	wouldLose: false,
	spaceDiff: 0,
	threeInRow: { player: 0, opponent: 0 },
	twoInRow: { player: 0, opponent: 0 },
	betterSpaces: { player: 0, opponent: 0 }
};

// Flat map of of scores. Bigger is always better.
export type MoveScore = {
	winner: number;
	wouldLose: number;
	threeInRow: number;
	oppThreeInRow: number;
	twoInRow: number;
	oppTwoInRow: number;
	spaceDiff: number;
	betterSpaces: number;
	oppBetterSpaces: number;
};

type WithRequired<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;
type AnalyzedCache = WithRequired<Cache, 'winner' | 'wouldLose' | 'threeInRow' | 'twoInRow'>;

const isAnalyzedCache = (cache: Cache): cache is AnalyzedCache => {
	return (
		cache.winner !== undefined && cache.wouldLose !== undefined && cache.threeInRow !== undefined
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
	/** Territory / pool metrics: computed on first request, independent of line `analyze()`. */
	private materialMetricsCached = false;

	constructor(game: Game, player: Player) {
		this.game = game;
		this.player = player;
		this.opponent = player === game.player1 ? game.player2 : game.player1;
		this.cache = {
			...INITIAL_CACHE,
			threeInRow: { ...INITIAL_CACHE.threeInRow },
			twoInRow: { ...INITIAL_CACHE.twoInRow },
			betterSpaces: { ...INITIAL_CACHE.betterSpaces },
			lines: game.board.lines()
		};
		this.analyzed = false;
	}

	public analyze() {
		this.analyzed = true;
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

	/** From raw board + pool only (no line threat aggregation). Called once, lazily. */
	private ensureMaterialMetrics() {
		if (this.materialMetricsCached) return;

		const board = this.game.board;
		let playerTops = 0;
		let oppTops = 0;
		let center = 0;
		let oppCenter = 0;
		let corners = 0;
		let oppCorners = 0;
		let topSizeSum = 0;

		for (let r = 0; r < 4; r++) {
			for (let c = 0; c < 4; c++) {
				const top = board.stacks[r][c].topPiece();
				if (!top) continue;
				if (top.player === this.player) {
					playerTops++;
					topSizeSum += top.size;
					if (r >= 1 && r <= 2 && c >= 1 && c <= 2) center++;
					if ((r === 0 || r === 3) && (c === 0 || c === 3)) {
						corners++;
					}
				} else if (top.player === this.opponent) {
					oppTops++;
					if (r >= 1 && r <= 2 && c >= 1 && c <= 2) oppCenter++;
					if ((r === 0 || r === 3) && (c === 0 || c === 3)) {
						oppCorners++;
					}
				}
			}
		}

		let poolSizeSum = 0;
		for (const stack of this.player.pool.stacks) {
			for (const piece of stack.pieces) {
				poolSizeSum += piece.size;
			}
		}

		this.cache.spaceDiff = playerTops - oppTops;
		this.cache.betterSpaces = {
			player: center + corners,
			opponent: oppCenter + oppCorners
		};
		this.materialMetricsCached = true;
	}

	public score(): MoveScore {
		return {
			winner: this.winner(),
			wouldLose: this.wouldLose(),
			threeInRow: this.threeInRow().player,
			oppThreeInRow: this.threeInRow().opponent,
			twoInRow: this.twoInRow().player,
			oppTwoInRow: this.twoInRow().opponent,
			spaceDiff: this.spaceDiff(),
			betterSpaces: this.betterSpaces().player,
			oppBetterSpaces: this.betterSpaces().opponent
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
		return cache.threeInRow;
	}

	public twoInRow() {
		const cache = throwIfNotAnalyzed(this.cache);
		return cache.twoInRow;
	}

	public spaceDiff() {
		this.ensureMaterialMetrics();
		return this.cache.spaceDiff;
	}

	public betterSpaces() {
		this.ensureMaterialMetrics();
		return this.cache.betterSpaces;
	}
}
