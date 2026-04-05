import { gameCommandSchema, type GameSnapshot } from '@capstone/contracts';
import { eq } from 'drizzle-orm';
import { Room, type Client } from 'colyseus';
import { Game } from '@capstone/game-logic';
import { randomUUID } from 'node:crypto';
import {
	applyHumanMakeMoveCommand,
	buildCapstoneSnapshot,
	loadCapstoneSnapshotFromDb,
	persistCapstoneSnapshot,
	type SnapshotMeta
} from '$lib/server/game/capstone-move-pipeline';
import { db } from '$lib/server/db';
import { boardState, game } from '$lib/server/db/schema';
import { setCurrentGameForUser } from './current-game-for-user';

interface JoinOptions {
	userId?: string;
	gameId?: `${string}-${string}-${string}-${string}-${string}`;
	needsOpponent?: boolean;
	vsAi?: boolean;
}

export class CapstoneRoom extends Room {
	maxClients = 2;
	private game = new Game();
	private gameId = randomUUID();
	private gamePersisted = false;
	private gameEnded = false;
	private winnerPlayerId: string | null = null;
	private winnerSeatIndex: 0 | 1 | null = null;
	private endedAt: Date | null = null;
	private vsAi = false;
	private joinOptionsVsAi = false;
	private userIdBySessionId = new Map<string, string>();
	private playerIndexBySessionId = new Map<string, 0 | 1>();
	private playerUserIdByIndex = new Map<0 | 1, string>();

	private getSnapshotMeta(): SnapshotMeta {
		return {
			gameEnded: this.gameEnded,
			winnerPlayerId: this.winnerPlayerId,
			winnerSeatIndex: this.winnerSeatIndex,
			endedAt: this.endedAt
		};
	}

	private applySnapshotMetaPatch(patch: Partial<SnapshotMeta>): void {
		if (patch.gameEnded !== undefined) this.gameEnded = patch.gameEnded;
		if (patch.winnerPlayerId !== undefined) this.winnerPlayerId = patch.winnerPlayerId;
		if (patch.winnerSeatIndex !== undefined) this.winnerSeatIndex = patch.winnerSeatIndex;
		if (patch.endedAt !== undefined) this.endedAt = patch.endedAt;
	}

	private async loadLatestSnapshot(): Promise<GameSnapshot> {
		const fallback = buildCapstoneSnapshot(this.game, this.getSnapshotMeta());
		return loadCapstoneSnapshotFromDb(this.gameId, fallback);
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

		if (!player1Id) {
			throw new Error('Cannot persist game without player 1.');
		}

		this.playerUserIdByIndex.set(0, player1Id);
		if (player2Id) {
			this.playerUserIdByIndex.set(1, player2Id);
		}

		await db.insert(game).values({
			id: this.gameId,
			player1Id,
			player2Id,
			vsAi: this.vsAi,
			startedAt: new Date()
		});

		await persistCapstoneSnapshot(
			this.gameId,
			buildCapstoneSnapshot(this.game, this.getSnapshotMeta())
		);
		this.gamePersisted = true;
		await this.setMetadata({ gameId: this.gameId, needsOpponent: !player2Id && !this.vsAi });
	}

	private async assignSecondPlayerIfNeeded() {
		if (!this.gamePersisted) return;
		if (this.getOccupiedSeatCount() < this.maxClients) return;
		if (this.playerUserIdByIndex.get(1)) return;

		const player2Client = this.clients.find(
			(client) => this.playerIndexBySessionId.get(client.sessionId) === 1
		);
		const player2Id = player2Client
			? this.userIdBySessionId.get(player2Client.sessionId)
			: undefined;
		if (!player2Id) return;

		this.playerUserIdByIndex.set(1, player2Id);
		await db
			.update(game)
			.set({ player2Id })
			.where(eq(game.id, this.gameId));

		await this.setMetadata({ gameId: this.gameId, needsOpponent: false });
	}

	private getConnectedPlayerIndexes(): Array<0 | 1> {
		return Array.from(new Set(this.playerIndexBySessionId.values())).sort();
	}

	private getOccupiedSeatCount(): number {
		return new Set(this.playerIndexBySessionId.values()).size;
	}

	private broadcastPresence() {
		const connectedPlayerIndexes = this.vsAi
			? ([0, 1] as Array<0 | 1>)
			: this.getConnectedPlayerIndexes();
		this.broadcast('event', {
			type: 'presence_update',
			gameId: this.gameId,
			connectedPlayerIndexes
		});
	}

	private async initializePersistedGame() {
		const persistedGame = await db.query.game.findFirst({
			where: (table, { eq }) => eq(table.id, this.gameId)
		});

		if (!persistedGame) {
			this.vsAi = this.joinOptionsVsAi;
			return;
		}

		const latestSnapshot = await this.loadLatestSnapshot();
		this.game = Game.deserialize(latestSnapshot.moves);
		if (latestSnapshot.currentTurnIndex === 1) {
			this.game.currentTurn = this.game.player2;
		}

		this.playerUserIdByIndex.set(0, persistedGame.player1Id);
		if (persistedGame.player2Id) {
			this.playerUserIdByIndex.set(1, persistedGame.player2Id);
		}
		this.gamePersisted = true;
		this.vsAi = Boolean(persistedGame.vsAi);
		this.gameEnded = Boolean(persistedGame.endedAt) || Boolean(this.game.board.winner());
		this.winnerPlayerId = persistedGame.winnerPlayerId ?? null;
		this.endedAt = persistedGame.endedAt ?? null;
		this.winnerSeatIndex = null;
		if (this.gameEnded) {
			const fromSnapshot = latestSnapshot.winnerSeatIndex;
			if (fromSnapshot === 0 || fromSnapshot === 1) {
				this.winnerSeatIndex = fromSnapshot;
			} else if (this.winnerPlayerId) {
				if (this.winnerPlayerId === persistedGame.player1Id) this.winnerSeatIndex = 0;
				else if (
					persistedGame.player2Id &&
					this.winnerPlayerId === persistedGame.player2Id
				) {
					this.winnerSeatIndex = 1;
				}
			}
		}
		await this.setMetadata({
			gameId: this.gameId,
			needsOpponent: !persistedGame.player2Id && !this.vsAi
		});
	}

	async onCreate(options?: JoinOptions) {
		if (options?.gameId) {
			this.gameId = options.gameId;
		}
		this.joinOptionsVsAi = options?.vsAi === true;

		await this.setMetadata({
			gameId: options?.gameId ?? null,
			needsOpponent: options?.vsAi ? false : true
		});
		await this.initializePersistedGame();

		if (this.vsAi) {
			this.maxClients = 1;
		}

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

			const playerIndex = this.playerIndexBySessionId.get(client.sessionId);
			if (playerIndex === undefined) {
				client.send('event', {
					type: 'invalid_move',
					message: 'You are not seated in this game.',
					errors: ['not seated']
				});
				return;
			}

			const result = await applyHumanMakeMoveCommand({
				gameId: this.gameId,
				game: this.game,
				from: command.from,
				to: command.to,
				gamePersisted: this.gamePersisted,
				gameEnded: this.gameEnded,
				playerIndex,
				vsAi: this.vsAi,
				playerUserIdByIndex: this.playerUserIdByIndex,
				lockRoom: () => this.lock(),
				getSnapshotMeta: () => this.getSnapshotMeta(),
				setSnapshotMeta: (patch) => this.applySnapshotMetaPatch(patch),
				broadcastStateSync: (snapshot) =>
					this.broadcast('event', {
						type: 'state_sync',
						gameId: this.gameId,
						snapshot
					})
			});

			if (!result.ok) {
				const err = result.error;
				if (err.kind === 'invalid_move') {
					client.send('event', {
						type: 'invalid_move',
						message: err.message,
						errors: err.errors
					});
					return;
				}
				if (err.kind === 'game_not_started') {
					client.send('event', {
						type: 'invalid_move',
						message: 'Game has not started yet.',
						errors: ['game not started']
					});
					return;
				}
				if (err.kind === 'game_ended') {
					client.send('event', {
						type: 'invalid_move',
						message: 'This game has already ended.',
						errors: ['game ended']
					});
					return;
				}
				client.send('event', {
					type: 'invalid_move',
					message: "It's not your turn.",
					errors: ['not your turn']
				});
				return;
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

		if (!this.playerIndexBySessionId.has(client.sessionId)) {
			// If this user is already seated in this room (another tab/session),
			// reuse the same seat instead of trying to assign a second seat.
			if (options.userId) {
				const existingSessionEntry = Array.from(this.userIdBySessionId.entries()).find(
					([sessionId, userId]) => sessionId !== client.sessionId && userId === options.userId
				);
				const existingSeat = existingSessionEntry
					? this.playerIndexBySessionId.get(existingSessionEntry[0])
					: undefined;
				if (existingSeat !== undefined) {
					this.playerIndexBySessionId.set(client.sessionId, existingSeat);
				}
			}

			let matchedPersistedPlayer = false;

			if (this.gamePersisted && options.userId) {
				const player1Id = this.playerUserIdByIndex.get(0);
				const player2Id = this.playerUserIdByIndex.get(1);
				const matchedIndex =
					options.userId === player1Id ? 0 : options.userId === player2Id ? 1 : undefined;

				if (matchedIndex === undefined && player2Id) {
					client.send('event', {
						type: 'invalid_move',
						message: 'You are not a player in this game.',
						errors: ['not a player']
					});
					client.leave();
					return;
				}

				if (matchedIndex !== undefined) {
					this.playerIndexBySessionId.set(client.sessionId, matchedIndex);
					matchedPersistedPlayer = true;
				}
			}

			if (!matchedPersistedPlayer && this.getOccupiedSeatCount() >= this.maxClients) {
				client.send('event', {
					type: 'invalid_move',
					message: 'Game is full.',
					errors: ['game full']
				});
				client.leave();
				return;
			}

			if (!this.playerIndexBySessionId.has(client.sessionId)) {
				const occupiedSeats = new Set(this.playerIndexBySessionId.values());
				if (this.gamePersisted) {
					if (this.playerUserIdByIndex.get(0)) occupiedSeats.add(0);
					if (this.playerUserIdByIndex.get(1)) occupiedSeats.add(1);
				}
				this.playerIndexBySessionId.set(
					client.sessionId,
					occupiedSeats.has(0) ? 1 : 0
				);
			}
		}

		if (options.userId) {
			setCurrentGameForUser(options.userId, this.gameId);
		}

		if (!this.gamePersisted && this.getOccupiedSeatCount() < this.maxClients) {
			await this.ensurePersistedGame();
			client.send('event', {
				type: 'waiting_for_player',
				gameId: this.gameId
			});
			client.send('event', {
				type: 'state_sync',
				gameId: this.gameId,
				snapshot: buildCapstoneSnapshot(this.game, this.getSnapshotMeta())
			});
			this.broadcastPresence();
			return;
		}

		if (!this.gamePersisted) {
			await this.ensurePersistedGame();
		}
		await this.assignSecondPlayerIfNeeded();

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
		// Keep "current game" mapping on disconnect so waiting/async games
		// remain discoverable from the lobby after refresh/reconnect.
		this.userIdBySessionId.delete(client.sessionId);
		this.playerIndexBySessionId.delete(client.sessionId);
		this.broadcastPresence();
	}
}
