## Monorepo Guidance

- **Workspace**: pnpm + turbo monorepo
- **Projects**:
  - `apps/client` (SvelteKit app)
  - `packages/game-logic` (shared TS package)

## Code Style

- Use the root `.prettierrc` for all Prettier-based formatting.
- Keep project-specific lint/format tooling where it makes sense (for example, Biome in `packages/game-logic`).

## Agent Instruction Scope

- This file defines default guidance for the whole repository.
- If a subproject has its own `AGENTS.md`, treat it as additional, project-specific instructions that refine these defaults.
