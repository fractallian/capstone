import { describe, expect, it } from 'vitest';
import { Game } from './Game';
import { describeGameStateForPrompt } from './game-state-prompt';

describe('describeGameStateForPrompt', () => {
	it('describes the start position without throwing', () => {
		const game = new Game();
		const text = describeGameStateForPrompt(game);
		expect(text).toContain('[0]..');
		expect(text).toContain('Player 1');
		expect(text).toContain('currentTurnIndex=0');
	});
});
