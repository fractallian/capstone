# Capstone Virtual Opponent

This is a package is a game move provider for Capstone
It is written in Typescript, targeting modern browser runtime
It depends on the game-logic package
It exports a move provider function that takes game state as input and outputs the most advantageous move for the current player.
This package is heavily tested to determine and enhance strength of playing ability.

The process by which the move is chosen is as follows:
Loop over all potential moves. For each move:

The move is simulated and the resulting board state is analyzed.

The move is assigned a score based on a series of criteria, ranked by importance. Scores are all numeric (booleans are 1/0). The criteria are:
- winner: Does this move win the game for the current player?
- wouldLose: Does the move result in a win for the opponent? Or would this move allow the opponent to win on their next turn? (invert)
- leap: Does the move cause a piece to move from the current player's pool to the board, covering an opponent's piece?
- threeInRow: How many 3 in a row does the current player have?
- oppThreeInRow: How many 3 in a row does the opponent have (invert)
- twoInRow: How many 2 in a row does the current player have?
- oppTwoInRow: How many 2 in a row does the opponent have? (invert)
- spaceDiff: What is the total number of board spaces the current player occupies minus the opponent's? (this encourages covering opponent's pieces)
- centerSpaces: How many center spaces does the current player occupy?
- cornerSpaces: How many corner spaces does the current player occupy?
- pieceWeight: What is the sum of the sizes of the current player's visible pieces on board?
- poolWeight: What is the sum of the sizes of the pieces in the current player's pool? (invert)

When comparing moves, we start at the beginning of this list and compare the same criteria. If it is a tie, move to the next criteria and compare. If it is ever not a tie, the rest of the criteria is not evaluated.

There is a board analyzer class that can answer any of the ranking questions given a board state. We instantiate an instance with a board state. The instance caches the results of queries so it only has to perform them once. 