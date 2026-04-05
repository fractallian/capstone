import { Server } from "colyseus";
import { env } from "$env/dynamic/private";
import { env as publicEnv } from "$env/dynamic/public";
import { CapstoneRoom } from "./capstone-room";

export {
	clearCurrentGameForUser,
	getCurrentGameForUser,
	setCurrentGameForUser
} from "./current-game-for-user";

let serverReady: Promise<void> | null = null;

export function getColyseusPort(): number {
	return Number(env.COLYSEUS_PORT ?? 2567);
}

export function getColyseusPublicUrl(requestUrl?: URL): string {
	// PUBLIC_* vars live in $env/dynamic/public only; private env excludes them.
	if (publicEnv.PUBLIC_COLYSEUS_URL) {
		return publicEnv.PUBLIC_COLYSEUS_URL;
	}

	if (requestUrl) {
		const wsProtocol = requestUrl.protocol === "https:" ? "wss:" : "ws:";
		return `${wsProtocol}//${requestUrl.hostname}:${getColyseusPort()}`;
	}

	return `ws://localhost:${getColyseusPort()}`;
}

export function ensureRealtimeServer(): Promise<void> {
	if (serverReady) {
		return serverReady;
	}

	serverReady = (async () => {
		const port = getColyseusPort();
		const gameServer = new Server();

		// Match rooms by canonical game id only. Filtering by needsOpponent can
		// cause join requests with missing/different flags to create duplicate rooms.
		gameServer.define("capstone", CapstoneRoom).filterBy(["gameId"]);
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
