# Sync / transport refactor plan

This document describes moving **Colyseus** to an optional **realtime layer** for online PvP, while **HTTP + shared server logic** becomes the authority for all persisted moves. **No feature flags** (pre-users).

---

## Product model

### One remote game type: online PvP

- Same DB row, same rules, same two human players.
- **While realtime is available** (Colyseus room + clients connected): moves propagate **live** over WebSocket so both see updates quickly when the game is open.
- **When realtime is not in use**: the player whose turn it is still **submits moves via HTTP**; persistence is the source of truth. WebSocket is not required for a legal move.
- **Continuity**: play can move between **sync ↔ disconnect ↔ async**; behavior is “best-effort realtime when connected,” not a separate game type in the data model.

### Local and vs CPU

- **Same client** drives both sides from the server’s perspective (hotseat: two humans; CPU: human + browser AI).
- **Every move** is **validated server-side** and **persisted** the same way.

---

## Architecture direction

| Kind | Who moves | Realtime | Persistence |
|------|-----------|----------|-------------|
| Local / hotseat | Same client, both seats | None required | HTTP per move |
| vs CPU | Same client, human + browser AI | None required | HTTP per move (human then AI POST) |
| Online PvP | Two clients | WS when connected for push | HTTP always sufficient; WS is optimization |

**Colyseus** = implementation detail for **online PvP realtime** only (broadcast / subscribe on top of the same apply path as HTTP).

---

## Phases

### Phase 0 — Invariants

- **Authority**: all legal moves go through **shared server logic** + DB writes.
- **Online PvP**: sync vs async is **connection state**, not a forked game type.

### Phase 1 — Extract headless game command service ✅ (see `apps/client/src/lib/server/game/capstone-move-pipeline.ts`)

- Shared **persist / load snapshot**, **build snapshot**, **finish game + DB + lock**, **server AI follow-up** live in `capstone-move-pipeline.ts`.
- `CapstoneRoom` delegates `make_move` to `applyHumanMakeMoveCommand` and uses the same helpers for initial snapshot persistence / reload; **HTTP handlers** (Phase 2) will call the same module.
- `setCurrentGameForUser` / `clearCurrentGameForUser` live in `realtime/current-game-for-user.ts` so the pipeline does not import `realtime/server.ts` (avoids a circular dependency with `CapstoneRoom`).

### Phase 2 — HTTP API for all persisted moves

- e.g. `POST /api/games/[gameId]/move` calling the same pipeline as the room.
- CPU bootstrap via `POST /api/games/vs-ai` (no transient Colyseus `create` on lobby).

### Phase 3 — Online PvP: Colyseus as realtime layer

- **POST** applies move (authoritative); Colyseus **broadcasts** `state_sync` when connected; avoid dual apply paths; handle ordering / idempotency.

### Phase 4 — Game client transport abstraction

- HTTP for submit; optional Colyseus subscribe for online games.

### Phase 5 — Lobby flows

- Remove CPU Colyseus bootstrap; optional lazy Colyseus connect on game page for online only.

### Phase 6 — Runtime: Colyseus optional

- Start realtime server only when configured; online PvP degrades to HTTP + refresh/poll without WS.

### Phase 7 — Cleanup

- Narrow client imports; update `.env.example` and deploy docs.

---

## Ordering

1. Phase 1 (done in repo as of this file).
2. Phase 2 + CPU HTTP create.
3. Phases 3–4 (game page).
4. Phases 5–6 (lobby + optional server).
5. Phase 7 (cleanup).

---

## Risks

- **Online PvP**: define behavior when one player uses POST and the other is on WS (single write path; WS as notify or refetch).
- **Browser AI**: server still validates every AI move POST.
- **Hotseat auth**: who may act as seat 2 on a shared link must be explicit.

---

## Messiness notes

- `CapstoneRoom` previously mixed transport, seating, persistence, and AI; extraction isolates **move + persist + win + server AI** for reuse.
- Animations and presence may need tweaks when HTTP is primary.
