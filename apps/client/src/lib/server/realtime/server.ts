import { WebSocketTransport } from "@colyseus/ws-transport";
import { Server } from "colyseus";
import { createServer, type Server as HttpServer } from "node:http";
import { env } from "$env/dynamic/private";
import { CapstoneRoom } from "./capstone-room";

let serverReady: Promise<void> | null = null;
let serverInstance: HttpServer | null = null;

export function getColyseusPort(): number {
	return Number(env.COLYSEUS_PORT ?? 2567);
}

export function getColyseusPublicUrl(): string {
	return env.PUBLIC_COLYSEUS_URL ?? `ws://localhost:${getColyseusPort()}`;
}

export function ensureRealtimeServer(): Promise<void> {
	if (serverReady) {
		return serverReady;
	}

	serverReady = (async () => {
		const port = getColyseusPort();
		serverInstance = createServer();
		const gameServer = new Server({
			transport: new WebSocketTransport({
				server: serverInstance
			})
		});

		gameServer.define("capstone", CapstoneRoom);

		await new Promise<void>((resolve, reject) => {
			serverInstance?.once("error", reject);
			serverInstance?.listen(port, () => resolve());
		});
	})();

	return serverReady;
}
