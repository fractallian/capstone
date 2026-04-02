import { describeGameStateForPrompt, Game } from '@capstone/game-logic';
import type { ChosenMove, GameBoardStateInput, GameMoveProvider } from './game-move-provider';

/** Instructions aligned with packages/game-logic (Board, Move, Pool, stacks 0–21). */
const SYSTEM_PROMPT = `You are a strong Capstone player. Capstone is a two-player perfect-information stacking game on a 4×4 board.

## Goal (win condition)
You win if you are the **owner of the top piece** on **all four cells** of any single line:
- one of the 4 horizontal rows,
- one of the 4 vertical columns,
- or one of the 2 main diagonals (corner-to-corner).
There are 10 such lines. The four "tops" in that line must all show **your** pieces (same player on top of each stack).

## Board geometry (stack indices 0–15, row-major)
Row 0: 0, 1, 2, 3
Row 1: 4, 5, 6, 7
Row 2: 8, 9, 10, 11
Row 3: 12, 13, 14, 15

## Pieces and sizes
Each player has a **pool** of pieces off the board. Pieces come in **four sizes** 0, 1, 2, 3 (0 = smallest, 3 = largest).
You may place a piece on an **empty** cell, or **on top of** another piece **only if** your piece is **strictly larger** than the piece currently on top there. Equal sizes cannot stack on each other.

## Pools (where new pieces enter from)
- **Player 1** (moves first; Black): pool stacks **16, 17, 18** (three stacks; take only the **top** piece from one of them when "dropping" from reserve).
- **Player 2** (White): pool stacks **19, 20, 21**.
You can also move a piece that is **already on the board** by picking it up from its stack (it must be **your** top piece on that stack) and moving it to a legal destination.

## Turn
currentTurnIndex 0 = Player 1 to move; 1 = Player 2 to move. You must choose a move legal for **that** player only.

## How to answer
You will get a text diagram of the position plus a JSON block with \`legalMoves\`. You **must** output one move that appears **exactly** in \`legalMoves\`: copy \`from\` and \`to\` stack indices from that list.
Pick the move that **best balances**: (1) progressing your own threats to complete a winning line of four tops, (2) **blocking** the opponent if they are one move away from completing a line, (3) contesting central and diagonal pressure. Prefer blocking when the opponent has a forced or near-forced line next turn.

Reply with **only** this JSON and nothing else: {"from": <number>, "to": <number>}`;

type OpenAiChatChoice = {
	message?: { content?: string | null };
};

type OpenAiChatResponse = {
	choices?: OpenAiChatChoice[];
	error?: { message?: string };
};

function extractJsonObject(text: string): string | null {
	const start = text.indexOf('{');
	const end = text.lastIndexOf('}');
	if (start === -1 || end === -1 || end <= start) return null;
	return text.slice(start, end + 1);
}

export type OpenAiMoveProviderOptions = {
	apiKey: string;
	model?: string;
	fetchImpl?: typeof fetch;
};

const LOG_PREFIX = '[capstone:openai-move]';

export class OpenAiGameMoveProvider implements GameMoveProvider {
	private readonly apiKey: string;
	private readonly model: string;
	private readonly fetchImpl: typeof fetch;

	constructor(options: OpenAiMoveProviderOptions) {
		this.apiKey = options.apiKey;
		this.model = options.model ?? 'gpt-4o-mini';
		this.fetchImpl = options.fetchImpl ?? fetch;
	}

	async chooseMove(state: GameBoardStateInput): Promise<ChosenMove> {
		const game = Game.deserialize(state.moves);
		if (game.currentTurnIndex() !== state.currentTurnIndex) {
			console.warn(`${LOG_PREFIX} currentTurnIndex mismatch: game=${game.currentTurnIndex()} state=${state.currentTurnIndex}`);
		}

		const payload = {
			moves: state.moves,
			currentTurnIndex: state.currentTurnIndex,
			legalMoves: state.legalMoves
		};

		const positionText = describeGameStateForPrompt(game);
		const userContent = `## Current position\n${positionText}\n\n## Data (choose exactly one pair from legalMoves)\n${JSON.stringify(payload, null, 2)}`;

		const requestBody = {
			model: this.model,
			temperature: 0.2,
			max_tokens: 220,
			messages: [
				{
					role: 'system' as const,
					content: SYSTEM_PROMPT
				},
				{
					role: 'user' as const,
					content: userContent
				}
			]
		};

		console.log(`${LOG_PREFIX} POST https://api.openai.com/v1/chat/completions`);
		console.log(`${LOG_PREFIX} request (no secrets):`, JSON.stringify(requestBody, null, 2));

		const res = await this.fetchImpl('https://api.openai.com/v1/chat/completions', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${this.apiKey}`
			},
			body: JSON.stringify(requestBody)
		});

		const body = (await res.json()) as OpenAiChatResponse & Record<string, unknown>;
		console.log(`${LOG_PREFIX} HTTP ${res.status}`);
		console.log(`${LOG_PREFIX} response JSON:`, JSON.stringify(body, null, 2));

		if (!res.ok) {
			throw new Error(body.error?.message ?? `OpenAI request failed (${res.status})`);
		}

		const raw = body.choices?.[0]?.message?.content?.trim();
		console.log(`${LOG_PREFIX} assistant content (raw):`, raw ?? '(empty)');
		if (!raw) {
			throw new Error('OpenAI returned empty content.');
		}

		const jsonText = extractJsonObject(raw);
		if (!jsonText) {
			throw new Error('Could not parse JSON from model output.');
		}

		const parsed = JSON.parse(jsonText) as { from?: unknown; to?: unknown };
		const from = Number(parsed.from);
		const to = Number(parsed.to);
		if (!Number.isInteger(from) || !Number.isInteger(to)) {
			throw new Error('Model returned non-integer from/to.');
		}

		const legal = state.legalMoves.some((m) => m.from === from && m.to === to);
		if (!legal) {
			console.warn(`${LOG_PREFIX} rejected move (not in legalMoves):`, { from, to });
			throw new Error('Model chose a move outside legalMoves.');
		}

		console.log(`${LOG_PREFIX} chosen move:`, { from, to });
		return { from, to };
	}
}
