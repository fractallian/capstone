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
	/** Per-line sums of top-piece counts (player vs opponent); `twoInRow()` score derives from opponent total. */
	threeInRow?: PlayerScores;
	/** Top-piece counts: player cells minus opponent cells on the 4×4 board. */
	spaceDiff?: number;
	/** Board cells among the inner 2×2 where the current player's piece is on top. */
	centerSpaces?: number;
	/** Corner cells where the current player's piece is on top. */
	cornerSpaces?: number;
	/** Sum of sizes (0–3) of the current player's top pieces on the board. */
	pieceWeight?: number;
	/** Negated sum of pool piece sizes so lexicographic compare (higher = better) prefers deploying pieces. */
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
type AnalyzedCache = WithRequired<Cache, 'winner' | 'wouldLose' | 'threeInRow'>;

const isAnalyzedCache = (cache: Cache): cache is AnalyzedCache => {
	return (
		cache.winner !== undefined &&
		cache.wouldLose !== undefined &&
		cache.threeInRow !== undefined
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
		let corners = 0;
		let topSizeSum = 0;

		for (let r = 0; r < 4; r++) {
			for (let c = 0; c < 4; c++) {
				const top = board.stacks[r][c].topPiece();
				if (!top) continue;
				if (top.player === this.player) {
					playerTops++;
					topSizeSum += top.size;
					if (r >= 1 && r <= 2 && c >= 1 && c <= 2) center++;
					if (
						(r === 0 || r === 3) &&
						(c === 0 || c === 3)
					) {
						corners++;
					}
				} else if (top.player === this.opponent) {
					oppTops++;
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
		this.cache.centerSpaces = center;
		this.cache.cornerSpaces = corners;
		this.cache.pieceWeight = topSizeSum;
		// PRD: pool weight sign −; compareScores treats higher as better → store −sum.
		this.cache.poolWeight = -poolSizeSum;
		this.materialMetricsCached = true;
	}

	public score(): MoveScore {
		return {
			winner: this.winner(),
			wouldLose: this.wouldLose(),
			threeInRow: this.threeInRow(),
			twoInRow: this.twoInRow(),
			spaceDiff: this.spaceDiff(),
			centerSpaces: this.centerSpaces(),
			cornerSpaces: this.cornerSpaces(),
			pieceWeight: this.pieceWeight(),
			poolWeight: this.poolWeight()
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

	/** Negated sum of opponent top counts over lines (higher = fewer opponent tops; aligns with lexicographic “higher is better”). */
	public twoInRow() {
		const cache = throwIfNotAnalyzed(this.cache);
		const o = cache.threeInRow.opponent;
		return o === 0 ? 0 : -o;
	}

	public spaceDiff() {
		this.ensureMaterialMetrics();
		return this.cache.spaceDiff!;
	}

	public centerSpaces() {
		this.ensureMaterialMetrics();
		return this.cache.centerSpaces!;
	}

	public cornerSpaces() {
		this.ensureMaterialMetrics();
		return this.cache.cornerSpaces!;
	}

	public pieceWeight() {
		this.ensureMaterialMetrics();
		return this.cache.pieceWeight!;
	}

	/** Negated pool size sum (higher = fewer / smaller pieces left in pool). */
	public poolWeight() {
		this.ensureMaterialMetrics();
		return this.cache.poolWeight!;
	}
}
