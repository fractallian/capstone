import { gameCommandSchema, gameSnapshotSchema, type GameSnapshot } from '@capstone/contracts';
import { eq } from 'drizzle-orm';
import { Room, type Client } from 'colyseus';
import { Game, InvalidMoveError } from '@capstone/game-logic';
import { randomUUID } from 'node:crypto';
import { db } from '$lib/server/db';
import { boardState, game } from '$lib/server/db/schema';
import { clearCurrentGameForUser, setCurrentGameForUser } from './server';

interface JoinOptions {
	userId?: string;
	gameId?: `${string}-${string}-${string}-${string}-${string}`;
	needsOpponent?: boolean;
}

export class CapstoneRoom extends Room {
	maxClients = 2;
	private game = new Game();
	private gameId = randomUUID();
	private gamePersisted = false;
	private gameEnded = false;
	private winnerPlayerId: string | null = null;
	private endedAt: Date | null = null;
	private userIdBySessionId = new Map<string, string>();
	private playerIndexBySessionId = new Map<string, 0 | 1>();
	private playerUserIdByIndex = new Map<0 | 1, string>();

	private buildSnapshot(): GameSnapshot {
		return {
			moves: this.game.serialize(),
			currentTurnIndex: this.game.currentTurnIndex(),
			winnerPlayerId: this.winnerPlayerId,
			endedAt: this.endedAt ? this.endedAt.toISOString() : null
		};
	}

	private async persistSnapshot(snapshot: GameSnapshot) {
		await db.insert(boardState).values({
			id: randomUUID(),
			gameId: this.gameId,
			board: snapshot
		});
	}

	private async loadLatestSnapshot(): Promise<GameSnapshot> {
		const latestBoardState = await db.query.boardState.findFirst({
			where: (table, { eq }) => eq(table.gameId, this.gameId),
			orderBy: (table, { desc }) => [desc(table.createdAt)]
		});

		const parsed = gameSnapshotSchema.safeParse(latestBoardState?.board);
		return parsed.success ? parsed.data : this.buildSnapshot();
	}

	private async ensurePersistedGame() {
		if (this.gamePersisted) return;

		const player1Client = this.clients.find(
			(client) => this.playerIndexBySessionId.get(client.sessionId) === 0
		);
		const player2Client = this.clients.find(
			(client) => this.playerIndexBySessionId.get(client.sessionId) === 1
		);
		const player1Id = player1Client
			? this.userIdBySessionId.get(player1Client.sessionId)
			: undefined;
		const player2Id = player2Client
			? this.userIdBySessionId.get(player2Client.sessionId)
			: undefined;

		if (!player1Id || !player2Id) {
			throw new Error('Cannot persist game without both players.');
		}

		this.playerUserIdByIndex.set(0, player1Id);
		this.playerUserIdByIndex.set(1, player2Id);

		await db.insert(game).values({
			id: this.gameId,
			player1Id,
			player2Id,
			startedAt: new Date()
		});

		await this.persistSnapshot(this.buildSnapshot());
		this.gamePersisted = true;
		await this.setMetadata({ gameId: this.gameId, needsOpponent: false });
	}

	private getConnectedPlayerIndexes(): Array<0 | 1> {
		return Array.from(new Set(this.playerIndexBySessionId.values())).sort();
	}

	private broadcastPresence() {
		this.broadcast('event', {
			type: 'presence_update',
			gameId: this.gameId,
			connectedPlayerIndexes: this.getConnectedPlayerIndexes()
		});
	}

	private async initializePersistedGame() {
		const persistedGame = await db.query.game.findFirst({
			where: (table, { eq }) => eq(table.id, this.gameId)
		});

		if (!persistedGame) {
			return;
		}

		const latestSnapshot = await this.loadLatestSnapshot();
		this.game = Game.deserialize(latestSnapshot.moves);
		if (latestSnapshot.currentTurnIndex === 1) {
			this.game.currentTurn = this.game.player2;
		}

		this.playerUserIdByIndex.set(0, persistedGame.player1Id);
		this.playerUserIdByIndex.set(1, persistedGame.player2Id);
		this.gamePersisted = true;
		this.gameEnded = Boolean(persistedGame.endedAt) || Boolean(this.game.board.winner());
		this.winnerPlayerId = persistedGame.winnerPlayerId ?? null;
		this.endedAt = persistedGame.endedAt ?? null;
		await this.setMetadata({ gameId: this.gameId, needsOpponent: false });
	}

	private async finishGameIfWon(): Promise<void> {
		const winner = this.game.board.winner();
		if (!winner) return;

		const winnerPlayerId =
			winner === this.game.player1
				? this.playerUserIdByIndex.get(0)
				: this.playerUserIdByIndex.get(1);

		if (!winnerPlayerId) {
			throw new Error('Unable to resolve winner player id.');
		}

		this.gameEnded = true;
		this.winnerPlayerId = winnerPlayerId;
		this.endedAt = new Date();

		await db
			.update(game)
			.set({
				endedAt: this.endedAt,
				winnerPlayerId
			})
			.where(eq(game.id, this.gameId));

		// Prevent matchmaking from placing players back into completed rooms.
		this.lock();

		// Completed games should no longer be treated as each user's "current game".
		const player1Id = this.playerUserIdByIndex.get(0);
		const player2Id = this.playerUserIdByIndex.get(1);
		if (player1Id) clearCurrentGameForUser(player1Id);
		if (player2Id) clearCurrentGameForUser(player2Id);
	}

	async onCreate(options?: JoinOptions) {
		if (options?.gameId) {
			this.gameId = options.gameId;
		}

		await this.setMetadata({ gameId: options?.gameId ?? null, needsOpponent: true });
		await this.initializePersistedGame();

		this.onMessage('command', async (client, rawMessage) => {
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
				if (!this.gamePersisted) {
					client.send('event', {
						type: 'invalid_move',
						message: 'Game has not started yet.',
						errors: ['game not started']
					});
					return;
				}

				if (this.gameEnded) {
					client.send('event', {
						type: 'invalid_move',
						message: 'This game has already ended.',
						errors: ['game ended']
					});
					return;
				}

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
				await this.finishGameIfWon();
				await this.persistSnapshot(this.buildSnapshot());

				this.broadcast('event', {
					type: 'state_sync',
					gameId: this.gameId,
					snapshot: await this.loadLatestSnapshot()
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

	async onJoin(client: Client, options: JoinOptions) {
		if (this.gameEnded && !options.gameId) {
			// Keep ended rooms out of future lobby matchmaking.
			this.lock();
			client.send('event', {
				type: 'invalid_move',
				message: 'Game has already ended.',
				errors: ['game ended']
			});
			client.leave();
			return;
		}

		if (options.userId) {
			this.userIdBySessionId.set(client.sessionId, options.userId);
		}

		// Prevent the same authenticated user from occupying both player seats.
		if (options.userId) {
			const connectedUserIds = new Set(
				this.clients
					.filter((joinedClient) => joinedClient.sessionId !== client.sessionId)
					.map((joinedClient) => this.userIdBySessionId.get(joinedClient.sessionId))
					.filter((userId): userId is string => Boolean(userId))
			);
			if (
				connectedUserIds.has(options.userId) &&
				!this.playerIndexBySessionId.has(client.sessionId)
			) {
				// Reject join cleanly so client-side matchmaking can fall back to creating a new room.
				throw new Error('You are already seated in this game.');
			}
		}

		if (!this.playerIndexBySessionId.has(client.sessionId)) {
			let matchedPersistedPlayer = false;

			if (this.gamePersisted && options.userId) {
				const player1Id = this.playerUserIdByIndex.get(0);
				const player2Id = this.playerUserIdByIndex.get(1);
				const matchedIndex =
					options.userId === player1Id ? 0 : options.userId === player2Id ? 1 : undefined;

				if (matchedIndex === undefined) {
					client.send('event', {
						type: 'invalid_move',
						message: 'You are not a player in this game.',
						errors: ['not a player']
					});
					client.leave();
					return;
				}

				this.playerIndexBySessionId.set(client.sessionId, matchedIndex);
				matchedPersistedPlayer = true;
			}

			if (!matchedPersistedPlayer && this.playerIndexBySessionId.size >= this.maxClients) {
				client.send('event', {
					type: 'invalid_move',
					message: 'Game is full.',
					errors: ['game full']
				});
				client.leave();
				return;
			}

			if (!this.playerIndexBySessionId.has(client.sessionId)) {
				this.playerIndexBySessionId.set(
					client.sessionId,
					this.playerIndexBySessionId.size === 0 ? 0 : 1
				);
			}
		}

		if (options.userId) {
			setCurrentGameForUser(options.userId, this.gameId);
		}

		if (!this.gamePersisted && this.playerIndexBySessionId.size < this.maxClients) {
			client.send('event', {
				type: 'waiting_for_player',
				gameId: this.gameId
			});
			client.send('event', {
				type: 'state_sync',
				gameId: this.gameId,
				snapshot: this.buildSnapshot()
			});
			this.broadcastPresence();
			return;
		}

		if (!this.gamePersisted) {
			await this.ensurePersistedGame();
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
			snapshot: await this.loadLatestSnapshot()
		});
		this.broadcastPresence();
	}

	onLeave(client: Client) {
		const userId = this.userIdBySessionId.get(client.sessionId);
		if (userId) {
			clearCurrentGameForUser(userId);
		}
		this.userIdBySessionId.delete(client.sessionId);
		this.playerIndexBySessionId.delete(client.sessionId);
		this.broadcastPresence();
	}
}
