import { env } from '$env/dynamic/private';
import type { GameMoveProvider } from './game-move-provider';
import { OpenAiGameMoveProvider } from './openai-move-provider';

/**
 * Returns a move provider when AI opponent features are enabled and configured.
 * Swap `OpenAiGameMoveProvider` for any other `GameMoveProvider` implementation.
 */
export function getGameMoveProvider(): GameMoveProvider | null {
	if (env.AI_OPPONENT_ENABLED !== 'true') {
		return null;
	}
	if (!env.OPENAI_API_KEY?.trim()) {
		return null;
	}
	return new OpenAiGameMoveProvider({
		apiKey: env.OPENAI_API_KEY.trim(),
		model: env.OPENAI_MODEL?.trim() || undefined
	});
}
