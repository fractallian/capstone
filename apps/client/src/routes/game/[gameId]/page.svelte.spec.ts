import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import GamePage from './+page.svelte';

type TestGameState = {
	moves: Array<{ from: number; to: number }>;
	startingTurnIndex: 0 | 1;
	currentTurnIndex: 0 | 1;
	winnerPlayerId: string | null;
	winnerSeatIndex: 0 | 1 | null;
	endedAt: string | null;
};

function renderGamePage(gameState: TestGameState) {
	render(GamePage, {
		data: {
			colyseusUrl: 'ws://localhost:2567',
			gameId: 'test-game-id',
			gameState,
			vsAi: false,
			vsSelf: true,
			viewerPlayerIndex: 1,
			viewerUserId: 'viewer-id',
			player1: { id: 'viewer-id', name: 'You', image: null },
			player2: { id: null, name: 'You (Seat 2)', image: null }
		}
	});
}

describe('game page turn state', () => {
	it('maps purple/gold labels from startingTurnIndex when seat 2 starts', async () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

		renderGamePage({
			moves: [],
			startingTurnIndex: 1,
			currentTurnIndex: 1,
			winnerPlayerId: null,
			winnerSeatIndex: null,
			endedAt: null
		});

		await expect.element(page.getByText("Purple's Turn")).toBeInTheDocument();
		expect(warnSpy).not.toHaveBeenCalled();

		warnSpy.mockRestore();
	});

	it('accepts string currentTurnIndex values from snapshots', async () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

		renderGamePage({
			moves: [{ from: 19, to: 0 }],
			startingTurnIndex: 0,
			currentTurnIndex: '1' as unknown as 0 | 1,
			winnerPlayerId: null,
			winnerSeatIndex: null,
			endedAt: null
		});

		await expect.element(page.getByText("Gold's Turn")).toBeInTheDocument();
		expect(warnSpy).not.toHaveBeenCalled();

		warnSpy.mockRestore();
	});
});
