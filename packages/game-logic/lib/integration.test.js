import { describe, it, expect } from 'vitest';
import { Game } from './Game';
import { InvalidMoveError } from './Move';
import { viewGameState } from './viewGameState';
import { PieceSize } from './Piece';
describe('Capstone Game Integration Tests', () => {
    describe('Complete game scenarios', () => {
        it('handles a complete winning game scenario', () => {
            const game = new Game();
            // Player 1 strategy: try to get 4 in a row horizontally
            game.makeMove(game.player1.pool.stacks[0], game.board.stacks[0][0]); // (0,0)
            game.makeMove(game.player2.pool.stacks[0], game.board.stacks[1][0]); // Block
            game.makeMove(game.player1.pool.stacks[0], game.board.stacks[0][1]); // (0,1)
            game.makeMove(game.player2.pool.stacks[0], game.board.stacks[1][1]); // Block
            game.makeMove(game.player1.pool.stacks[0], game.board.stacks[0][2]); // (0,2)
            game.makeMove(game.player2.pool.stacks[0], game.board.stacks[1][2]); // Block
            game.makeMove(game.player1.pool.stacks[0], game.board.stacks[0][3]); // (0,3) - Win!
            // Check if player1 has winning line
            const winner = game.board.winner();
            expect(winner).toBe(game.player1);
        });
        it('handles complex piece stacking and movement', () => {
            var _a, _b;
            const game = new Game();
            // Build up complex stacks - need to place smaller pieces first
            // First place pieces to get different sizes on board
            game.makeMove(game.player1.pool.stacks[0], game.board.stacks[0][0]); // Size 3
            game.makeMove(game.player2.pool.stacks[0], game.board.stacks[2][2]); // P2 move
            game.makeMove(game.player1.pool.stacks[0], game.board.stacks[0][1]); // Size 2
            game.makeMove(game.player2.pool.stacks[0], game.board.stacks[2][1]); // P2 move
            game.makeMove(game.player1.pool.stacks[0], game.board.stacks[0][2]); // Size 1
            game.makeMove(game.player2.pool.stacks[0], game.board.stacks[2][0]); // P2 move
            // Now create stacks by moving board pieces
            game.makeMove(game.board.stacks[0][1], game.board.stacks[0][2]); // Size 2 on Size 1
            game.makeMove(game.player2.pool.stacks[0], game.board.stacks[3][0]); // P2 move
            game.makeMove(game.board.stacks[0][0], game.board.stacks[0][2]); // Size 3 on Size 2
            game.makeMove(game.player2.pool.stacks[1], game.board.stacks[3][1]); // P2 move
            // Now move the top piece somewhere else
            game.makeMove(game.board.stacks[0][2], game.board.stacks[3][3]);
            // The size 2 piece should now be on top at (0,2)
            expect((_a = game.board.stacks[0][2].topPiece()) === null || _a === void 0 ? void 0 : _a.size).toBe(PieceSize.Three);
            expect((_b = game.board.stacks[3][3].topPiece()) === null || _b === void 0 ? void 0 : _b.size).toBe(PieceSize.Four);
        });
        it('handles three-in-a-row covering rules correctly', () => {
            // Create a specific scenario where player2 gets 3 in a row
            const moves = [
                { from: 16, to: 0 },
                { from: 19, to: 4 },
                { from: 16, to: 1 },
                { from: 19, to: 5 },
                { from: 16, to: 2 },
                { from: 19, to: 6 }, // P2 (1,2) - now P2 has 3 in a row horizontally
            ];
            const game = Game.deserialize(moves);
            // P1 should be able to cover one of P2's pieces from pool
            expect(() => {
                game.makeMove(game.player1.pool.stacks[1], game.board.stacks[1][1]); // Cover middle piece
            }).not.toThrow();
            // But P2 should not be able to cover P1's random pieces
            expect(() => {
                game.makeMove(game.player2.pool.stacks[1], game.board.stacks[0][0]);
            }).toThrow(InvalidMoveError);
        });
        it('handles winner detection across different line types', () => {
            const game = new Game();
            // Test horizontal win
            for (let col = 0; col < 4; col++) {
                game.makeMove(game.player1.pool.stacks[0], game.board.stacks[0][col]);
                if (col < 3) {
                    game.makeMove(game.player2.pool.stacks[0], game.board.stacks[1][col]);
                }
            }
            expect(game.board.winner()).toBe(game.player1);
        });
        it('handles diagonal winner detection', () => {
            const game = new Game();
            // Create diagonal win for player1
            game.makeMove(game.player1.pool.stacks[0], game.board.stacks[0][0]); // (0,0)
            game.makeMove(game.player2.pool.stacks[0], game.board.stacks[0][1]); // P2 block
            game.makeMove(game.player1.pool.stacks[0], game.board.stacks[1][1]); // (1,1)
            game.makeMove(game.player2.pool.stacks[0], game.board.stacks[0][2]); // P2 block
            game.makeMove(game.player1.pool.stacks[0], game.board.stacks[2][2]); // (2,2)
            game.makeMove(game.player2.pool.stacks[0], game.board.stacks[0][3]); // P2 block
            game.makeMove(game.player1.pool.stacks[0], game.board.stacks[3][3]); // (3,3) - Diagonal win!
            expect(game.board.winner()).toBe(game.player1);
        });
    });
    describe('Serialization and deserialization edge cases', () => {
        it('handles complex game serialization roundtrip', () => {
            const game = new Game();
            // Create complex game state with moves and stacking
            const originalMoves = [
                { from: 16, to: 5 },
                { from: 19, to: 9 },
                { from: 16, to: 6 },
                { from: 19, to: 10 },
                { from: 5, to: 10 },
                { from: 19, to: 5 }, // P2 pool to now-empty board space
            ];
            const gameFromMoves = Game.deserialize(originalMoves);
            const reserializedMoves = gameFromMoves.serialize();
            expect(reserializedMoves).toEqual(originalMoves);
            // Double-check by deserializing again
            const gameFromReserialized = Game.deserialize(reserializedMoves);
            expect(viewGameState(gameFromReserialized)).toEqual(viewGameState(gameFromMoves));
        });
        it('handles edge case of empty and single-move games', () => {
            // Empty game
            const emptyGame = Game.deserialize([]);
            expect(emptyGame.moves.length).toBe(0);
            expect(emptyGame.currentTurn).toBe(emptyGame.player1);
            // Single move game
            const singleMoveGame = Game.deserialize([{ from: 16, to: 0 }]);
            expect(singleMoveGame.moves.length).toBe(1);
            expect(singleMoveGame.currentTurn).toBe(singleMoveGame.player2);
        });
        it('handles invalid move sequences in deserialization', () => {
            const invalidMoves = [
                { from: 16, to: 0 },
                { from: 16, to: 1 }, // Same player moving twice - logically invalid but structurally valid
            ];
            // Should not throw during deserialization (validation is disabled)
            expect(() => Game.deserialize(invalidMoves)).not.toThrow();
        });
    });
    describe('Boundary and stress tests', () => {
        it('handles maximum piece stacking correctly', () => {
            var _a;
            const game = new Game();
            const targetStack = game.board.stacks[2][2];
            // Get different sized pieces on the board first
            game.makeMove(game.player1.pool.stacks[0], game.board.stacks[0][0]); // Size 3
            game.makeMove(game.player2.pool.stacks[0], game.board.stacks[1][0]); // P2 move
            game.makeMove(game.player1.pool.stacks[0], game.board.stacks[0][1]); // Size 2
            game.makeMove(game.player2.pool.stacks[0], game.board.stacks[1][1]); // P2 move
            game.makeMove(game.player1.pool.stacks[0], game.board.stacks[0][2]); // Size 1
            game.makeMove(game.player2.pool.stacks[0], game.board.stacks[1][2]); // P2 move
            game.makeMove(game.player1.pool.stacks[0], targetStack); // Size 0 to target (smallest)
            game.makeMove(game.player2.pool.stacks[0], game.board.stacks[1][3]); // P2 move
            // Now stack larger pieces on top
            game.makeMove(game.board.stacks[0][2], targetStack); // Size 1 on Size 0
            game.makeMove(game.player2.pool.stacks[1], game.board.stacks[3][0]); // P2 move
            game.makeMove(game.board.stacks[0][1], targetStack); // Size 2 on Size 1
            expect(targetStack.pieces.length).toBe(3);
            expect((_a = targetStack.topPiece()) === null || _a === void 0 ? void 0 : _a.size).toBe(PieceSize.Three); // Size 2 on top
        });
        it('handles all pool pieces being used', () => {
            const game = new Game();
            // Simplified approach: use pieces from pool until they're exhausted
            let movesCount = 0;
            const maxMoves = 20; // Safety limit
            // Alternate between players while they have pieces available
            while (movesCount < maxMoves) {
                const currentPlayer = game.currentTurn;
                let foundValidMove = false;
                // Try to find a stack with pieces
                for (let stackIdx = 0; stackIdx < 3; stackIdx++) {
                    if (currentPlayer.pool.stacks[stackIdx].pieces.length > 0) {
                        // Find an empty board position
                        for (let row = 0; row < 4; row++) {
                            for (let col = 0; col < 4; col++) {
                                if (game.board.stacks[row][col].isEmpty()) {
                                    game.makeMove(currentPlayer.pool.stacks[stackIdx], game.board.stacks[row][col]);
                                    foundValidMove = true;
                                    movesCount++;
                                    break;
                                }
                            }
                            if (foundValidMove)
                                break;
                        }
                        if (foundValidMove)
                            break;
                    }
                }
                if (!foundValidMove)
                    break; // No more valid moves
            }
            // Some pieces should have been moved to the board
            const totalP1Pieces = game.player1.pool.stacks.reduce((sum, stack) => sum + stack.pieces.length, 0);
            expect(totalP1Pieces).toBeLessThan(12); // Some pieces should be on the board
        });
        it('handles complex covering scenarios', () => {
            const game = new Game();
            // Set up scenario where covering is allowed due to three-in-a-row
            // We need to create a scenario where P1 has 3 in a row with smaller pieces that P2 can cover
            const setupMoves = [
                { from: 16, to: 0 },
                { from: 19, to: 4 },
                { from: 16, to: 1 },
                { from: 19, to: 5 },
                { from: 16, to: 2 }, // P1 size 1 to (0,2) - now has 3 in row with mixed sizes
            ];
            const setupGame = Game.deserialize(setupMoves);
            // P2 should be able to cover P1's middle piece (size 2) with a larger piece (size 3)
            expect(() => {
                setupGame.makeMove(setupGame.player2.pool.stacks[1], setupGame.board.stacks[0][1]);
            }).not.toThrow();
        });
    });
    describe('Game state consistency', () => {
        it('maintains consistent game state through complex operations', () => {
            const game = new Game();
            // Track initial state
            const initialStackCount = game.stacks.length;
            const initialP1Pieces = game.player1.pool.stacks.reduce((sum, stack) => sum + stack.pieces.length, 0);
            const initialP2Pieces = game.player2.pool.stacks.reduce((sum, stack) => sum + stack.pieces.length, 0);
            // Make several moves
            game.makeMove(game.player1.pool.stacks[0], game.board.stacks[1][1]); // Size 3
            game.makeMove(game.player2.pool.stacks[0], game.board.stacks[2][2]); // Size 3
            // Use up some pieces to get smaller ones
            game.makeMove(game.player1.pool.stacks[0], game.board.stacks[0][0]); // Size 2
            game.makeMove(game.player2.pool.stacks[0], game.board.stacks[3][3]); // Size 2
            // Stack larger piece on smaller piece
            game.makeMove(game.board.stacks[1][1], game.board.stacks[0][0]); // Size 3 on Size 2
            // Verify consistency
            expect(game.stacks.length).toBe(initialStackCount); // No stacks created/destroyed
            // Total pieces should be conserved
            const finalP1Pieces = game.player1.pool.stacks.reduce((sum, stack) => sum + stack.pieces.length, 0);
            const finalP2Pieces = game.player2.pool.stacks.reduce((sum, stack) => sum + stack.pieces.length, 0);
            const boardPieces = game.board.stacks.flat().reduce((sum, stack) => sum + stack.pieces.length, 0);
            expect(finalP1Pieces + finalP2Pieces + boardPieces).toBe(initialP1Pieces + initialP2Pieces);
        });
        it('ensures turn order is always correct', () => {
            const game = new Game();
            expect(game.currentTurn).toBe(game.player1);
            for (let i = 0; i < 10; i++) {
                const expectedPlayer = i % 2 === 0 ? game.player1 : game.player2;
                expect(game.currentTurn).toBe(expectedPlayer);
                // Make a valid move
                const sourceStack = game.currentTurn.pool.stacks[0];
                const targetStack = game.board.stacks[i % 4][Math.floor(i / 4)];
                if (sourceStack.pieces.length > 0) {
                    game.makeMove(sourceStack, targetStack);
                }
                else {
                    break;
                }
            }
        });
    });
});
