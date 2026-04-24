# Long term vision for game in it's completed state

## Splash page (logged out)

- welcome message
- login button

## Lobby

- list of all the user's games in two groups: in progress, completed
- there is a "New Game" button present if the user does not have a game with status: waiting
- if there is a status: waiting game, the user sees "Finding opponent..."

## Game

- route: /game/:gameId
- When a user clicks "New Game" and an opponent is found, a new game is created in the database and both users are redirected to /game/<gameId>
- clicking any started game in the lobby will take you to that game page
- when game is loaded we ensure both players are in the same room and that room has the current game state
- server is authoritative for game state:
  - client sends `command` events (for example `make_move`) to server
  - server validates and applies the move using shared `@capstone/game-logic`
  - server broadcasts `state_sync` events with `{ gameId, snapshot }` to all connected clients
- client also uses shared `@capstone/game-logic` to maintain local game state for rendering and interaction
- client local state is updated/reconciled whenever `state_sync` arrives from server (server snapshot is source of truth)
- persistence and replayability:
  - save one `board_state` record per accepted move
  - each record stores `game_id`, `created_at`, and board snapshot JSON
  - this move-by-move history enables replaying games in order
