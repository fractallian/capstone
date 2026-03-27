import { Stack, StackLocation } from './Stack';
const INDEXES = [0, 1, 2, 3];
export class Board {
    constructor(game) {
        this.game = game;
        this.stacks = [];
        for (let r = 0; r < 4; r++) {
            const row = [];
            this.stacks.push(row);
            for (let c = 0; c < 4; c++) {
                row.push(new Stack(this.game, StackLocation.board));
            }
        }
    }
    horizontalLines() {
        return INDEXES.map((row) => {
            const type = row > 0 && row < 3 ? BoardLineType.inner : BoardLineType.outer;
            return new BoardLine(this.stacks[row], type);
        });
    }
    verticalLines() {
        return INDEXES.map((col) => {
            const stacks = INDEXES.map((row) => {
                return this.stacks[row][col];
            });
            const type = col > 0 && col < 3 ? BoardLineType.inner : BoardLineType.outer;
            return new BoardLine(stacks, type);
        });
    }
    diagonalLines() {
        return [
            new BoardLine(INDEXES.map((i) => {
                return this.stacks[i][i];
            }), BoardLineType.diagonal),
            new BoardLine(INDEXES.map((i) => {
                return this.stacks[3 - i][i];
            }), BoardLineType.diagonal)
        ];
    }
    lines() {
        return this.horizontalLines().concat(this.verticalLines()).concat(this.diagonalLines());
    }
    winner() {
        const lines = this.lines();
        for (const line of lines) {
            const player = line.winningPlayer();
            if (player) {
                return player;
            }
        }
        return undefined;
    }
}
export var BoardLineType;
(function (BoardLineType) {
    BoardLineType["diagonal"] = "D";
    BoardLineType["inner"] = "I";
    BoardLineType["outer"] = "O";
})(BoardLineType || (BoardLineType = {}));
export class BoardLine {
    constructor(stacks, type) {
        this.stacks = stacks;
        this.type = type;
    }
    winningPlayer() {
        const topPlayers = this.stacks.map((stack) => { var _a; return (_a = stack.topPiece()) === null || _a === void 0 ? void 0 : _a.player; });
        return topPlayers.every((player) => player === topPlayers[0]) ? topPlayers[0] : undefined;
    }
    coversOneOfThree(toStack) {
        const stackIndex = this.stacks.indexOf(toStack);
        if (stackIndex < 0)
            return false;
        const player = toStack.game.currentTurn;
        const coveredPiece = toStack.topPiece();
        if (!coveredPiece || coveredPiece.player === player)
            return false;
        // does the piece on the stack at this index have my opponent's piece
        const check = (index) => {
            const stack = this.stacks[index];
            const topPiece = stack.topPiece();
            return !!(topPiece && (topPiece === null || topPiece === void 0 ? void 0 : topPiece.player) !== player);
        };
        // 0,1,2,3
        switch (stackIndex) {
            case 0:
            case 3:
                // 1,2
                return check(1) && check(2);
            case 1:
                // 0,2 or 2,3
                return (check(0) && check(2)) || (check(2) && check(3));
            case 2:
                // 0,1 or 1,3
                return (check(0) && check(1)) || (check(1) && check(3));
        }
        return false;
    }
}
