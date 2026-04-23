import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import colyseusPkg from 'colyseus';
import { CapstoneRoom } from '$lib/server/realtime/capstone-room';
const { Server } = colyseusPkg;

let serverReady: Promise<void> | null = null;

export const realtimeServer = {
	getPort(): number {
		return Number(env.COLYSEUS_PORT ?? 2567);
	},
	getPublicUrl(requestUrl?: URL): string {
		if (publicEnv.PUBLIC_COLYSEUS_URL) return publicEnv.PUBLIC_COLYSEUS_URL;
		if (requestUrl) {
			const wsProtocol = requestUrl.protocol === 'https:' ? 'wss:' : 'ws:';
			return `${wsProtocol}//${requestUrl.hostname}:${this.getPort()}`;
		}
		return `ws://localhost:${this.getPort()}`;
	},
	ensureStarted(): Promise<void> {
		if (serverReady) return serverReady;
		serverReady = (async () => {
			const gameServer = new Server();
			gameServer.define('capstone', CapstoneRoom).filterBy(['gameId']);
			try {
				await gameServer.listen(this.getPort());
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				if (!message.includes('EADDRINUSE')) throw error;
			}
		})();
		return serverReady;
	}
};
