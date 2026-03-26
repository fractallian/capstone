# game-logic boundary

`packages/game-logic` contains deterministic Capstone rules only.

Boundary rules:

- No framework imports (SvelteKit, Colyseus, database clients, auth clients).
- No transport concerns (HTTP, WebSocket, room/session lifecycle).
- Expose pure domain primitives that can run in any runtime.
