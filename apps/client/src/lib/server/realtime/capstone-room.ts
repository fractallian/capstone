import { gameCommandSchema, type GameSnapshot } from '@capstone/contracts';
import { Room, type Client } from 'colyseus';
import { Game, InvalidMoveError } from '@capstone/game-logic';
import { randomUUID } from 'node:crypto';
import { clearCurrentGameForUser, setCurrentGameForUser } from './server';

interface JoinOptions {
	userId?: string;
}

function buildSnapshot(game: Game): GameSnapshot {
	return {
		moves: game.serialize(),
		currentTurnIndex: game.currentTurnIndex()
	};
}

export class CapstoneRoom extends Room {
	maxClients = 2;
	private game = new Game();
	private readonly gameId = randomUUID();
	private userIdBySessionId = new Map<string, string>();
	private playerIndexBySessionId = new Map<string, 0 | 1>();

	onCreate() {
		this.onMessage('command', (client, rawMessage) => {
			const parsed = gameCommandSchema.safeParse(rawMessage);
			if (!parsed.success) {
				client.send('event', {
					type: 'invalid_move',
					message: 'Malformed command payload.',
					errors: ['malformed command payload']
				});
				return;
			}

			const command = parsed.data;
			if (command.type !== 'make_move') {
				client.send('event', {
					type: 'invalid_move',
					message: 'Unsupported command.',
					errors: ['unsupported command']
				});
				return;
			}

			try {
				const playerIndex = this.playerIndexBySessionId.get(client.sessionId);
				if (playerIndex === undefined) {
					client.send('event', {
						type: 'invalid_move',
						message: 'You are not seated in this game.',
						errors: ['not seated']
					});
					return;
				}

				const expectedPlayer = playerIndex === 0 ? this.game.player1 : this.game.player2;
				if (this.game.currentTurn !== expectedPlayer) {
					client.send('event', {
						type: 'invalid_move',
						message: "It's not your turn.",
						errors: ['not your turn']
					});
					return;
				}

				this.game.makeMove(this.game.stacks[command.from], this.game.stacks[command.to]);
				this.broadcast('event', {
					type: 'state_sync',
					gameId: this.gameId,
					snapshot: buildSnapshot(this.game)
				});
			} catch (error) {
				const message = error instanceof InvalidMoveError ? error.message : 'Move failed.';
				const errors = error instanceof InvalidMoveError ? error.errors : ['move failed'];
				client.send('event', {
					type: 'invalid_move',
					message,
					errors
				});
			}
		});
	}

	onJoin(client: Client, options: JoinOptions) {
		if (options.userId) {
			this.userIdBySessionId.set(client.sessionId, options.userId);
		}

		if (!this.playerIndexBySessionId.has(client.sessionId)) {
			if (this.playerIndexBySessionId.size >= this.maxClients) {
				client.send('event', {
					type: 'invalid_move',
					message: 'Game is full.',
					errors: ['game full']
				});
				client.leave();
				return;
			}
			this.playerIndexBySessionId.set(
				client.sessionId,
				this.playerIndexBySessionId.size === 0 ? 0 : 1
			);
		}

		if (this.clients.length < this.maxClients) {
			client.send('event', {
				type: 'waiting_for_player'
			});
			// For dev/early UI work: send an initial snapshot immediately so
			// a single client can inspect state and send commands.
			client.send('event', {
				type: 'state_sync',
				gameId: this.gameId,
				snapshot: buildSnapshot(this.game)
			});
			return;
		}

		for (const joinedClient of this.clients) {
			const joinedUserId = this.userIdBySessionId.get(joinedClient.sessionId);
			if (joinedUserId) {
				setCurrentGameForUser(joinedUserId, this.gameId);
			}
		}

		this.broadcast('event', {
			type: 'game_started',
			gameId: this.gameId
		});

		this.broadcast('event', {
			type: 'state_sync',
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
		this.playerIndexBySessionId.delete(client.sessionId);
	}
}
