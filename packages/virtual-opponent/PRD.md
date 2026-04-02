# Virtual Opponent — Product Requirements

## Purpose

Provide a **deterministic, heuristic-based** move chooser for Capstone: given full game state, return the strongest legal move for the current player without ML or external APIs. The implementation is TypeScript, runs in a **modern browser**, and depends on **`@capstone/game-logic`**.

## Public API

Export a **move provider** (same conceptual contract as other providers): **input** = board / game state; **output** = one legal move that maximizes a fixed scoring policy.

## Quality bar

The package should be **heavily tested**. Tests exist both to prevent regressions and to **tune and validate playing strength** over time.

## Move selection algorithm

1. Enumerate all **legal** moves for the current player.
2. For each move, **simulate** it and analyze the resulting position.
3. Assign the move a **score vector**: one **numeric** value per criterion below (booleans use **1 / 0**).
4. **Lexicographic ordering** on the **effective** scores: for each criterion, `effective = sign × raw`, where **sign** is **+1** or **−1** per the table. Compare moves by largest effective first; on tie, next criterion; **stop at the first non-tie**.

**Sign:** **+** means higher raw is better. **−** means smaller raw is better; use **−1 × raw** (or equivalently negate the raw value) when comparing.

### Evaluation criteria (highest → lowest priority)

| Order | Id               | Sign | Meaning |
|-------|------------------|------|---------|
| 1     | `winner`         | +    | **1** if this move **wins the game** for the current player; else **0**. |
| 2     | `wouldLose`      | −    | **1** if the position loses immediately for the current player, **or** the opponent can **force a win on their next turn**; else **0**. |
| 3     | `leap`           | +    | **1** if the move takes a piece from the **current player’s pool** onto the board and **covers an opponent’s piece**; else **0**. |
| 4     | `threeInRow`     | +    | Count of **three-in-a-row** (for the current player)—exact line definition per game rules / analyzer. |
| 5     | `oppThreeInRow`  | −    | Opponent’s three-in-a-row count. |
| 6     | `twoInRow`       | +    | Count of **two-in-a-row** for the current player. |
| 7     | `oppTwoInRow`    | −    | Opponent’s two-in-a-row count. |
| 8     | `spaceDiff`      | +    | Board cells occupied by the current player **minus** opponent (encourages covering and territory). |
| 9     | `centerSpaces`   | +    | Count of **center** cells occupied by the current player. |
| 10    | `cornerSpaces`   | +    | Count of **corner** cells occupied by the current player. |
| 11    | `pieceWeight`    | +    | Sum of **sizes** of the current player’s **visible** pieces on the board. |
| 12    | `poolWeight`     | −    | Sum of **sizes** of pieces still in the current player’s **pool**. |

## Board analyzer

Introduce a **board analyzer** class that, given a **board state** (after simulation), can answer each metric needed for ranking. The analyzer **caches** computed values per instance so repeated queries on the same position do not repeat work.

## Non-goals (for this package)

- Training models, reinforcement learning, or paid inference APIs.
- Guaranteeing optimality (perfect play); strength comes from **clear heuristics + tests + iteration**.
