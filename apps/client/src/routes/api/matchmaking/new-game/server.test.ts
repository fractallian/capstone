import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './+server';

const {
	findFirstMock,
	findManyMock,
	insertValuesMock,
	insertMock,
	boardStateFindFirstMock,
	returningMock,
	whereMock,
	setMock,
	updateMock
} = vi.hoisted(() => {
	const findFirst = vi.fn();
	const findMany = vi.fn();
	const insertValues = vi.fn();
	const insertFn = vi.fn(() => ({ values: insertValues }));
	const boardStateFindFirst = vi.fn();
	const returning = vi.fn();
	const where = vi.fn(() => ({ returning }));
	const set = vi.fn(() => ({ where }));
	const update = vi.fn(() => ({ set }));

	return {
		findFirstMock: findFirst,
		findManyMock: findMany,
		insertValuesMock: insertValues,
		insertMock: insertFn,
		boardStateFindFirstMock: boardStateFindFirst,
		returningMock: returning,
		whereMock: where,
		setMock: set,
		updateMock: update
	};
});

const { isOnlineMock } = vi.hoisted(() => ({
	isOnlineMock: vi.fn()
}));

vi.mock('$lib/server/db', () => ({
	db: {
		query: {
			game: {
				findFirst: findFirstMock,
				findMany: findManyMock
			},
			boardState: {
				findFirst: boardStateFindFirstMock
			}
		},
		insert: insertMock,
		update: updateMock
	}
}));

vi.mock('$lib/server/realtime/online-presence', () => ({
	realtimePresence: {
		isOnline: isOnlineMock
	}
}));

vi.mock('$lib/server/db/schema', () => ({
	game: {
		id: 'id',
		player1Id: 'player1Id',
		player2Id: 'player2Id',
		vsAi: 'vsAi',
		vsSelf: 'vsSelf',
		endedAt: 'endedAt'
	},
	boardState: {
		id: 'id',
		gameId: 'gameId',
		createdAt: 'createdAt'
	}
}));

describe('POST /api/matchmaking/new-game', () => {
	beforeEach(() => {
		vi.resetAllMocks();
		whereMock.mockImplementation(() => ({ returning: returningMock }));
		setMock.mockImplementation(() => ({ where: whereMock }));
		updateMock.mockImplementation(() => ({ set: setMock }));
		insertMock.mockImplementation(() => ({ values: insertValuesMock }));
		findManyMock.mockResolvedValue([]);
		isOnlineMock.mockReturnValue(false);
	});

	it('returns 401 when user is unauthorized', async () => {
		const response = await POST({
			locals: { session: null, user: null }
		} as Parameters<typeof POST>[0]);

		expect(response.status).toBe(401);
		await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
		expect(findManyMock).not.toHaveBeenCalled();
	});

	it('returns null when no waiting game exists', async () => {
		findManyMock.mockResolvedValueOnce([]);
		findFirstMock.mockResolvedValueOnce(null);
		insertValuesMock.mockResolvedValue(undefined);

		const response = await POST({
			locals: { session: { id: 's1' }, user: { id: 'u2' } }
		} as Parameters<typeof POST>[0]);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({ gameId: null });
		expect(updateMock).not.toHaveBeenCalled();
	});

	it('prefers online-hosted candidates before offline-hosted ones', async () => {
		findManyMock.mockResolvedValueOnce([
			{ id: 'older-offline', player1Id: 'offline-1' },
			{ id: 'newer-online', player1Id: 'online-1' }
		]);
		isOnlineMock.mockImplementation((userId: string) => userId === 'online-1');
		returningMock.mockResolvedValueOnce([{ id: 'newer-online' }]);

		const response = await POST({
			locals: { session: { id: 's1' }, user: { id: 'u2' } }
		} as Parameters<typeof POST>[0]);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({ gameId: 'newer-online' });
		expect(updateMock).toHaveBeenCalledTimes(1);
	});

	it('claims and returns the oldest waiting game with an online host', async () => {
		findManyMock.mockResolvedValueOnce([
			{ id: 'game-offline', player1Id: 'offline-host' },
			{ id: 'game-1', player1Id: 'online-host' }
		]);
		isOnlineMock.mockImplementation((userId: string) => userId === 'online-host');
		returningMock.mockResolvedValueOnce([{ id: 'game-1' }]);
		boardStateFindFirstMock.mockResolvedValueOnce({
			board: {
				moves: [],
				currentTurnIndex: 0,
				winnerPlayerId: null,
				winnerSeatIndex: null,
				endedAt: null
			}
		});
		insertValuesMock.mockResolvedValue(undefined);

		const response = await POST({
			locals: { session: { id: 's1' }, user: { id: 'u2' } }
		} as Parameters<typeof POST>[0]);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({ gameId: 'game-1' });
		expect(updateMock).toHaveBeenCalledTimes(1);
		expect(setMock).toHaveBeenCalledWith({ player2Id: 'u2' });
		expect(whereMock).toHaveBeenCalledTimes(1);
		expect(insertMock).toHaveBeenCalled();
		expect(isOnlineMock).toHaveBeenCalledWith('offline-host');
		expect(isOnlineMock).toHaveBeenCalledWith('online-host');
	});

	it('continues to next online candidate when first claim loses race and then succeeds', async () => {
		findManyMock.mockResolvedValueOnce([
			{ id: 'game-1', player1Id: 'online-host-1' },
			{ id: 'game-2', player1Id: 'online-host-2' }
		]);
		isOnlineMock.mockReturnValue(true);
		returningMock.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: 'game-2' }]);

		const response = await POST({
			locals: { session: { id: 's1' }, user: { id: 'u2' } }
		} as Parameters<typeof POST>[0]);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({ gameId: 'game-2' });
		expect(updateMock).toHaveBeenCalledTimes(2);
	});

	it('claims an offline-hosted candidate when no host is online', async () => {
		findManyMock.mockResolvedValueOnce([
			{ id: 'game-1', player1Id: 'offline-1' },
			{ id: 'game-2', player1Id: 'offline-2' }
		]);
		isOnlineMock.mockReturnValue(false);
		returningMock.mockResolvedValueOnce([{ id: 'game-1' }]);

		const response = await POST({
			locals: { session: { id: 's1' }, user: { id: 'u2' } }
		} as Parameters<typeof POST>[0]);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({ gameId: 'game-1' });
		expect(updateMock).toHaveBeenCalledTimes(1);
	});

	it('does not return until waiting-game persistence finishes', async () => {
		findManyMock.mockResolvedValueOnce([]);
		findFirstMock.mockResolvedValueOnce(null);

		let resolveInsert: (() => void) | null = null;
		const insertBarrier = new Promise<void>((resolve) => {
			resolveInsert = resolve;
		});
		insertValuesMock.mockImplementationOnce(() => insertBarrier);

		const responsePromise = POST({
			locals: { session: { id: 's1' }, user: { id: 'u2' } }
		} as Parameters<typeof POST>[0]);

		let settled = false;
		void responsePromise.then(() => {
			settled = true;
		});
		await Promise.resolve();
		await Promise.resolve();
		expect(settled).toBe(false);

		resolveInsert?.();
		insertValuesMock.mockResolvedValue(undefined);

		const response = await responsePromise;
		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({ gameId: null });
	});
});
