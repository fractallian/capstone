import { describe, it, expect, beforeEach } from 'vitest';
import { Game } from './Game';
import { Stack, StackLocation } from './Stack';
import { Piece, PieceSize } from './Piece';
describe('Stack', () => {
    let game;
    let boardStack;
    let poolStack;
    beforeEach(() => {
        game = new Game();
        boardStack = new Stack(game, StackLocation.board);
        poolStack = new Stack(game, StackLocation.pool);
    });
    describe('construction', () => {
        it('creates an empty stack', () => {
            expect(boardStack.isEmpty()).toBe(true);
            expect(boardStack.pieces.length).toBe(0);
            expect(boardStack.topPiece()).toBeUndefined();
        });
        it('assigns correct location', () => {
            expect(boardStack.location).toBe(StackLocation.board);
            expect(poolStack.location).toBe(StackLocation.pool);
        });
        it('registers itself with the game', () => {
            const initialStackCount = game.stacks.length;
            const newStack = new Stack(game, StackLocation.board);
            expect(game.stacks.length).toBe(initialStackCount + 1);
            expect(game.stacks[game.stacks.length - 1]).toBe(newStack);
        });
        it('assigns sequential indexes', () => {
            const stack1 = new Stack(game, StackLocation.board);
            const stack2 = new Stack(game, StackLocation.board);
            expect(stack2.index).toBe(stack1.index + 1);
        });
    });
    describe('piece management', () => {
        it('can add a piece to empty stack', () => {
            const piece = new Piece(game.player1, PieceSize.One, boardStack);
            expect(boardStack.canAddPiece(piece)).toBe(true);
            expect(boardStack.addPiece(piece)).toBe(true);
            expect(boardStack.isEmpty()).toBe(false);
            expect(boardStack.topPiece()).toBe(piece);
            expect(boardStack.pieces.length).toBe(1);
        });
        it('can add larger piece on top of smaller', () => {
            const smallPiece = new Piece(game.player1, PieceSize.One, boardStack);
            const largePiece = new Piece(game.player2, PieceSize.Two, boardStack);
            boardStack.addPiece(smallPiece);
            expect(boardStack.canAddPiece(largePiece)).toBe(true);
            expect(boardStack.addPiece(largePiece)).toBe(true);
            expect(boardStack.topPiece()).toBe(largePiece);
            expect(boardStack.pieces.length).toBe(2);
        });
        it('cannot add smaller piece on top of larger', () => {
            const largePiece = new Piece(game.player1, PieceSize.Three, boardStack);
            const smallPiece = new Piece(game.player2, PieceSize.One, boardStack);
            boardStack.addPiece(largePiece);
            expect(boardStack.canAddPiece(smallPiece)).toBe(false);
            expect(boardStack.addPiece(smallPiece)).toBe(false);
            expect(boardStack.topPiece()).toBe(largePiece);
            expect(boardStack.pieces.length).toBe(1);
        });
        it('cannot add same size piece on top', () => {
            const piece1 = new Piece(game.player1, PieceSize.Two, boardStack);
            const piece2 = new Piece(game.player2, PieceSize.Two, boardStack);
            boardStack.addPiece(piece1);
            expect(boardStack.canAddPiece(piece2)).toBe(false);
            expect(boardStack.addPiece(piece2)).toBe(false);
            expect(boardStack.topPiece()).toBe(piece1);
            expect(boardStack.pieces.length).toBe(1);
        });
        it('maintains correct stacking order', () => {
            const piece1 = new Piece(game.player1, PieceSize.One, boardStack);
            const piece2 = new Piece(game.player2, PieceSize.Two, boardStack);
            const piece3 = new Piece(game.player1, PieceSize.Three, boardStack);
            const piece4 = new Piece(game.player2, PieceSize.Four, boardStack);
            boardStack.addPiece(piece1);
            boardStack.addPiece(piece2);
            boardStack.addPiece(piece3);
            boardStack.addPiece(piece4);
            expect(boardStack.pieces).toEqual([piece1, piece2, piece3, piece4]);
            expect(boardStack.topPiece()).toBe(piece4);
        });
    });
    describe('edge cases', () => {
        it('handles multiple pieces of incrementing sizes', () => {
            const pieces = [
                new Piece(game.player1, PieceSize.One, boardStack),
                new Piece(game.player2, PieceSize.Two, boardStack),
                new Piece(game.player1, PieceSize.Three, boardStack),
                new Piece(game.player2, PieceSize.Four, boardStack)
            ];
            pieces.forEach(piece => {
                expect(boardStack.addPiece(piece)).toBe(true);
            });
            expect(boardStack.pieces.length).toBe(4);
            expect(boardStack.topPiece()).toBe(pieces[3]);
        });
        it('rejects invalid size sequences', () => {
            const largePiece = new Piece(game.player1, PieceSize.Four, boardStack);
            const mediumPiece = new Piece(game.player2, PieceSize.Two, boardStack);
            boardStack.addPiece(largePiece);
            expect(boardStack.addPiece(mediumPiece)).toBe(false);
            expect(boardStack.pieces.length).toBe(1);
        });
    });
    describe('stack location behavior', () => {
        it('board and pool stacks behave identically for piece rules', () => {
            const boardPiece = new Piece(game.player1, PieceSize.One, boardStack);
            const poolPiece = new Piece(game.player1, PieceSize.One, poolStack);
            expect(boardStack.canAddPiece(boardPiece)).toBe(true);
            expect(poolStack.canAddPiece(poolPiece)).toBe(true);
            boardStack.addPiece(boardPiece);
            poolStack.addPiece(poolPiece);
            const largePiece1 = new Piece(game.player2, PieceSize.Two, boardStack);
            const largePiece2 = new Piece(game.player2, PieceSize.Two, poolStack);
            expect(boardStack.canAddPiece(largePiece1)).toBe(true);
            expect(poolStack.canAddPiece(largePiece2)).toBe(true);
        });
    });
});
