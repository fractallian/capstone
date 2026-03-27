/**
 * given a Game object
 * return a text-based visual representation of the board
 * for testing purposes
 *
 * e.g.:
 *
 * X3||  |X3|  |  ||O2
 * X1||  |O3|X2|  ||O3
 * X2||X3|O2|  |  ||O1
 *    |  |  |O3|  |
 */
export function viewGameState(game) {
    const stackLayout = [
        [16, '', 0, 1, 2, 3, '', 19],
        [17, '', 4, 5, 6, 7, '', 20],
        [18, '', 8, 9, 10, 11, '', 21],
        ['   ', 12, 13, 14, 15, '   ']
    ];
    const rows = stackLayout.map((row) => {
        return row
            .map((item) => {
            if (typeof item === 'string') {
                return item;
            }
            return stackToText(game.stacks[item]);
        })
            .join('|');
    });
    return `\n${rows.join('\n')}\n`;
}
function stackToText(stack) {
    const piece = stack.topPiece();
    if (!piece)
        return '  ';
    if (piece.player === stack.game.player1)
        return `X${piece.size}`;
    return `O${piece.size}`;
}
