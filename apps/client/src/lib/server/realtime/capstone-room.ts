import { gameCommandSchema, type GameSnapshot } from "@capstone/contracts";
import { Room, type Client } from "colyseus";
import { Game, InvalidMoveError } from "@capstone/game-logic";

function buildSnapshot(game: Game): GameSnapshot {
	return {
		moves: game.serialize(),
		currentTurnIndex: game.currentTurnIndex(),
	};
}

export class CapstoneRoom extends Room {
	maxClients = 2;
	private game = new Game();

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

	onJoin(client: Client) {
		client.send("event", {
			type: "state_sync",
			snapshot: buildSnapshot(this.game)
		});
	}
}
