import { gameCommandSchema, type GameSnapshot } from '@capstone/contracts';
import { Game } from '@capstone/game-logic';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import colyseusPkg from 'colyseus';
import type { Client } from 'colyseus';
import { db } from '$lib/server/db';
import { boardState, game } from '$lib/server/db/schema';
import { applyHumanMakeMoveCommand } from '$lib/server/game/apply-human-make-move-command';
import { buildCapstoneSnapshot } from '$lib/server/game/build-capstone-snapshot';
import { loadCapstoneSnapshotFromDb } from '$lib/server/game/load-capstone-snapshot-from-db';
import { persistCapstoneSnapshot } from '$lib/server/game/persist-capstone-snapshot';
import { clearCurrentGameForUser } from '$lib/server/game/clear-current-game-for-user';
import { setCurrentGameForUser } from '$lib/server/game/set-current-game-for-user';
import type { SnapshotMeta } from '$lib/server/game/snapshot-meta';
import { realtimePresence } from '$lib/server/realtime/online-presence';
const { Room } = colyseusPkg;

type JoinOptions = {
	userId?: string;
	gameId?: string;
};

export class CapstoneRoom extends Room {
	maxClients = 2;
	private game = new Game();
	private gameId: string = randomUUID();
	private gamePersisted = false;
	private gameEnded = false;
	private winnerPlayerId: string | null = null;
	private winnerSeatIndex: 0 | 1 | null = null;
	private endedAt: Date | null = null;
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

	private async initializeFromPersistedGame(): Promise<void> {
		const persistedGame = await db.query.game.findFirst({
			where: eq(game.id, this.gameId)
		});
		if (!persistedGame) return;

		const latestBoardState = await db.query.boardState.findFirst({
			where: eq(boardState.gameId, this.gameId),
			orderBy: [desc(boardState.createdAt)]
		});
		const parsed = latestBoardState
			? await loadCapstoneSnapshotFromDb(
					this.gameId,
					buildCapstoneSnapshot(this.game, this.getSnapshotMeta())
				)
			: null;
		if (parsed) {
			this.game = Game.deserialize(parsed.moves);
			this.game.currentTurn = parsed.currentTurnIndex === 1 ? this.game.player2 : this.game.player1;
			this.winnerSeatIndex = parsed.winnerSeatIndex ?? null;
			this.winnerPlayerId = parsed.winnerPlayerId ?? null;
			this.endedAt = parsed.endedAt ? new Date(parsed.endedAt) : (persistedGame.endedAt ?? null);
		}

		this.playerUserIdByIndex.set(0, persistedGame.player1Id);
		if (persistedGame.player2Id) this.playerUserIdByIndex.set(1, persistedGame.player2Id);
		this.gamePersisted = true;
		this.gameEnded = Boolean(persistedGame.endedAt);
		this.winnerPlayerId = persistedGame.winnerPlayerId ?? this.winnerPlayerId;
		this.endedAt = persistedGame.endedAt ?? this.endedAt;
	}

	private getConnectedPlayerIndexes(): Array<0 | 1> {
		return Array.from(new Set(this.playerIndexBySessionId.values())).sort();
	}

	private broadcastPresence(): void {
		this.broadcast('event', {
			type: 'presence_update',
			gameId: this.gameId,
			connectedPlayerIndexes: this.getConnectedPlayerIndexes()
		});
	}

	private async ensurePersistedWaitingGameForHost(hostUserId: string): Promise<void> {
		if (this.gamePersisted) return;
		await db.insert(game).values({
			id: this.gameId,
			player1Id: hostUserId,
			player2Id: null,
			vsAi: false,
			vsSelf: false,
			startedAt: new Date()
		});
		await persistCapstoneSnapshot(
			this.gameId,
			buildCapstoneSnapshot(this.game, this.getSnapshotMeta())
		);
		this.playerUserIdByIndex.set(0, hostUserId);
		this.gamePersisted = true;
	}

	async onCreate(options?: JoinOptions): Promise<void> {
		if (options?.gameId) this.gameId = options.gameId;
		await this.initializeFromPersistedGame();

		this.onMessage('command', async (client, payload) => {
			const parsed = gameCommandSchema.safeParse(payload);
			if (!parsed.success || parsed.data.type !== 'make_move') {
				client.send('event', {
					type: 'invalid_move',
					message: 'Malformed command payload.',
					errors: ['malformed command payload']
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
				from: parsed.data.from,
				to: parsed.data.to,
				gamePersisted: this.gamePersisted,
				gameEnded: this.gameEnded,
				playerIndex,
				playerUserIdByIndex: this.playerUserIdByIndex,
				lockRoom: () => this.lock(),
				getSnapshotMeta: () => this.getSnapshotMeta(),
				setSnapshotMeta: (patch) => this.applySnapshotMetaPatch(patch),
				broadcastStateSync: (snapshot) => {
					this.broadcast('event', { type: 'state_sync', gameId: this.gameId, snapshot });
				}
			});

			if (result.ok) return;
			if (result.error.kind === 'invalid_move') {
				client.send('event', {
					type: 'invalid_move',
					message: result.error.message,
					errors: result.error.errors
				});
				return;
			}
			if (result.error.kind === 'game_not_started') {
				client.send('event', {
					type: 'invalid_move',
					message: 'Game has not started yet.',
					errors: ['game not started']
				});
				return;
			}
			if (result.error.kind === 'game_ended') {
				client.send('event', {
					type: 'invalid_move',
					message: 'Game has already ended.',
					errors: ['game ended']
				});
				return;
			}
			client.send('event', {
				type: 'invalid_move',
				message: "It's not your turn.",
				errors: ['not your turn']
			});
		});
	}

	async onJoin(client: Client, options: JoinOptions): Promise<void> {
		const userId = options.userId;
		if (!userId) {
			client.leave();
			return;
		}

		if (this.gameEnded) {
			client.send('event', {
				type: 'invalid_move',
				message: 'Game has already ended.',
				errors: ['game ended']
			});
			client.leave();
			return;
		}

		this.userIdBySessionId.set(client.sessionId, userId);
		realtimePresence.markRealtimeConnected(userId);

		let seat: 0 | 1 | undefined;
		const player1Id = this.playerUserIdByIndex.get(0);
		const player2Id = this.playerUserIdByIndex.get(1);
		if (player1Id && userId === player1Id) seat = 0;
		if (player2Id && userId === player2Id) seat = 1;

		if (seat === undefined && this.gamePersisted && player2Id && userId !== player2Id) {
			client.send('event', {
				type: 'invalid_move',
				message: 'You are not a player in this game.',
				errors: ['not a player']
			});
			client.leave();
			return;
		}

		if (
			seat === undefined &&
			this.gamePersisted &&
			!player2Id &&
			player1Id &&
			userId !== player1Id
		) {
			const claimed = await db
				.update(game)
				.set({ player2Id: userId })
				.where(and(eq(game.id, this.gameId), isNull(game.player2Id)))
				.returning({ id: game.id });
			if (claimed.length === 0) {
				client.send('event', {
					type: 'invalid_move',
					message: 'Game is full.',
					errors: ['game full']
				});
				client.leave();
				return;
			}
			this.playerUserIdByIndex.set(1, userId);
			seat = 1;
		}

		if (seat === undefined) {
			if (!player1Id) {
				seat = 0;
			} else if (!player2Id) {
				seat = 1;
			}
		}

		if (seat === undefined) {
			client.send('event', {
				type: 'invalid_move',
				message: 'Game is full.',
				errors: ['game full']
			});
			client.leave();
			return;
		}

		this.playerIndexBySessionId.set(client.sessionId, seat);
		if (seat === 0 && !this.playerUserIdByIndex.get(0)) this.playerUserIdByIndex.set(0, userId);
		if (seat === 1 && !this.playerUserIdByIndex.get(1)) this.playerUserIdByIndex.set(1, userId);
		setCurrentGameForUser(userId, this.gameId);
		await this.ensurePersistedWaitingGameForHost(this.playerUserIdByIndex.get(0) ?? userId);

		const hasSecondPlayer = Boolean(this.playerUserIdByIndex.get(1));
		if (!hasSecondPlayer) {
			client.send('event', { type: 'waiting_for_player', gameId: this.gameId });
			client.send('event', {
				type: 'state_sync',
				gameId: this.gameId,
				snapshot: await this.loadLatestSnapshot()
			});
			this.broadcastPresence();
			return;
		}

		this.broadcast('event', { type: 'game_started', gameId: this.gameId });
		this.broadcast('event', {
			type: 'state_sync',
			gameId: this.gameId,
			snapshot: await this.loadLatestSnapshot()
		});
		this.broadcastPresence();
	}

	onLeave(client: Client): void {
		const userId = this.userIdBySessionId.get(client.sessionId);
		if (userId) {
			realtimePresence.markRealtimeDisconnected(userId);
			clearCurrentGameForUser(userId);
		}
		this.userIdBySessionId.delete(client.sessionId);
		this.playerIndexBySessionId.delete(client.sessionId);
		this.broadcastPresence();
	}
}
