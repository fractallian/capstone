import { Game } from '@capstone/game-logic';
import { chooseMove } from '@capstone/virtual-opponent';
import type { ChosenMove, GameBoardStateInput, GameMoveProvider } from './game-move-provider';

/** Local heuristic opponent (no network). */
export class VirtualOpponentGameMoveProvider implements GameMoveProvider {
	async chooseMove(state: GameBoardStateInput): Promise<ChosenMove> {
		const game = Game.deserialize(state.moves);
		if (game.currentTurnIndex() !== state.currentTurnIndex) {
			game.currentTurn = state.currentTurnIndex === 0 ? game.player1 : game.player2;
		}
		const move = chooseMove(game);
		return { from: move.from, to: move.to };
	}
}
