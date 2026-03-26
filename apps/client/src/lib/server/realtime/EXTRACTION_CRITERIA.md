# Realtime service extraction criteria

Keep realtime hosted in `apps/client` while delivery speed and simplicity are more important than independent scaling.

Move to a standalone service when one or more become true:

- Active rooms and socket concurrency require independent horizontal scaling.
- Deployment environment cannot keep long-lived websocket processes healthy.
- You need independent deploy cadence for realtime logic vs web/auth/database code.
- You need hard failure isolation so web app incidents do not impact live matches.
- Another consumer (mobile app, external client) must connect without SvelteKit coupling.

Extraction path:

1. Keep `packages/game-logic` unchanged as the deterministic domain core.
2. Keep `@capstone/contracts` as the wire contract source of truth.
3. Move only Colyseus room lifecycle and process bootstrapping to a new `apps/realtime` workspace app.
4. Reuse the same command/event schemas, and keep client connection code pointed at the new URL.
