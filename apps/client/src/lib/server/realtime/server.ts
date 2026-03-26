import { Server } from "colyseus";
import { env } from "$env/dynamic/private";
import { CapstoneRoom } from "./capstone-room";

let serverReady: Promise<void> | null = null;
const currentGameByUserId = new Map<string, string>();

export function getColyseusPort(): number {
	return Number(env.COLYSEUS_PORT ?? 2567);
}

export function getColyseusPublicUrl(requestUrl?: URL): string {
	if (env.PUBLIC_COLYSEUS_URL) {
		return env.PUBLIC_COLYSEUS_URL;
	}

	if (requestUrl) {
		const wsProtocol = requestUrl.protocol === "https:" ? "wss:" : "ws:";
		return `${wsProtocol}//${requestUrl.hostname}:${getColyseusPort()}`;
	}

	return `ws://localhost:${getColyseusPort()}`;
}

export function setCurrentGameForUser(userId: string, gameId: string): void {
	currentGameByUserId.set(userId, gameId);
}

export function clearCurrentGameForUser(userId: string): void {
	currentGameByUserId.delete(userId);
}

export function getCurrentGameForUser(userId: string): string | null {
	return currentGameByUserId.get(userId) ?? null;
}

export function ensureRealtimeServer(): Promise<void> {
	if (serverReady) {
		return serverReady;
	}

	serverReady = (async () => {
		const port = getColyseusPort();
		const gameServer = new Server();

		gameServer.define("capstone", CapstoneRoom);
		try {
			await gameServer.listen(port);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			if (message.includes("EADDRINUSE")) {
				// Another local dev process already owns the realtime port.
				// Treat this as healthy and let requests continue.
				return;
			}
			throw error;
		}
	})();

	return serverReady;
}
