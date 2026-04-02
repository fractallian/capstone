import { Move } from './Move';
/** All legal moves for the current player on this game state (stack indices 0–21). */
export function listLegalMoves(game) {
    const moves = [];
    for (let from = 0; from < game.stacks.length; from++) {
        for (let to = 0; to < game.stacks.length; to++) {
            if (from === to)
                continue;
            const move = new Move(game.currentTurn, game.stacks[from], game.stacks[to]);
            if (move.isValid().isValid) {
                moves.push({ from, to });
            }
        }
    }
    return moves;
}
