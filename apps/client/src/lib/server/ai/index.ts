import { env } from '$env/dynamic/private';
import type { GameMoveProvider } from './game-move-provider';
import { OpenAiGameMoveProvider } from './openai-move-provider';
import { VirtualOpponentGameMoveProvider } from './virtual-opponent-move-provider';

/**
 * Returns a move provider for vs-AI games when CPU opponents are not disabled.
 * Uses the bundled heuristic by default; set `AI_USE_OPENAI=true` and `OPENAI_API_KEY` for OpenAI.
 */
export function getGameMoveProvider(): GameMoveProvider | null {
	if (env.AI_OPPONENT_ENABLED === 'false') {
		return null;
	}
	const useOpenAi = env.AI_USE_OPENAI === 'true' && Boolean(env.OPENAI_API_KEY?.trim());
	if (useOpenAi) {
		return new OpenAiGameMoveProvider({
			apiKey: env.OPENAI_API_KEY!.trim(),
			model: env.OPENAI_MODEL?.trim() || undefined
		});
	}
	return new VirtualOpponentGameMoveProvider();
}
