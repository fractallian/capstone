import { gameCommandSchema, type GameSnapshot } from "@capstone/contracts";
import { Room, type Client } from "colyseus";
import { Game, InvalidMoveError } from "@capstone/game-logic";
import { randomUUID } from "node:crypto";
import { clearCurrentGameForUser, setCurrentGameForUser } from "./server";

interface JoinOptions {
	userId?: string;
}

function buildSnapshot(game: Game): GameSnapshot {
	return {
		moves: game.serialize(),
		currentTurnIndex: game.currentTurnIndex(),
	};
}

export class CapstoneRoom extends Room {
	maxClients = 2;
	private game = new Game();
	private readonly gameId = randomUUID();
	private userIdBySessionId = new Map<string, string>();

	onCreate() {
		this.onMessage("command", (client, rawMessage) => {
			const parsed = gameCommandSchema.safeParse(rawMessage);
			if (!parsed.success) {
				client.send("event", {
					type: "invalid_move",
					message: "Malformed command payload."
				});
				return;
			}

			const command = parsed.data;
			if (command.type !== "make_move") {
				client.send("event", {
					type: "invalid_move",
					message: "Unsupported command."
				});
				return;
			}

			try {
				this.game.makeMove(this.game.stacks[command.from], this.game.stacks[command.to]);
				this.broadcast("event", {
					type: "state_sync",
					gameId: this.gameId,
					snapshot: buildSnapshot(this.game)
				});
			} catch (error) {
				const message =
					error instanceof InvalidMoveError ? "Move rejected by game rules." : "Move failed.";
				client.send("event", {
					type: "invalid_move",
					message
				});
			}
		});
	}

	onJoin(client: Client, options: JoinOptions) {
		if (options.userId) {
			this.userIdBySessionId.set(client.sessionId, options.userId);
		}

		if (this.clients.length < this.maxClients) {
			client.send("event", {
				type: "waiting_for_player"
			});
			return;
		}

		for (const joinedClient of this.clients) {
			const joinedUserId = this.userIdBySessionId.get(joinedClient.sessionId);
			if (joinedUserId) {
				setCurrentGameForUser(joinedUserId, this.gameId);
			}
		}

		this.broadcast("event", {
			type: "game_started",
			gameId: this.gameId
		});

		this.broadcast("event", {
			type: "state_sync",
			gameId: this.gameId,
			snapshot: buildSnapshot(this.game)
		});
	}

	onLeave(client: Client) {
		const userId = this.userIdBySessionId.get(client.sessionId);
		if (userId) {
			clearCurrentGameForUser(userId);
		}
		this.userIdBySessionId.delete(client.sessionId);
	}
}
