import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './+server';

const {
	findFirstMock,
	insertValuesMock,
	insertMock,
	boardStateFindFirstMock,
	returningMock,
	whereMock,
	setMock,
	updateMock
} = vi.hoisted(() => {
	const findFirst = vi.fn();
	const insertValues = vi.fn();
	const insertFn = vi.fn(() => ({ values: insertValues }));
	const boardStateFindFirst = vi.fn();
	const returning = vi.fn();
	const where = vi.fn(() => ({ returning }));
	const set = vi.fn(() => ({ where }));
	const update = vi.fn(() => ({ set }));

	return {
		findFirstMock: findFirst,
		insertValuesMock: insertValues,
		insertMock: insertFn,
		boardStateFindFirstMock: boardStateFindFirst,
		returningMock: returning,
		whereMock: where,
		setMock: set,
		updateMock: update
	};
});

vi.mock('$lib/server/db', () => ({
	db: {
		query: {
			game: {
				findFirst: findFirstMock
			},
			boardState: {
				findFirst: boardStateFindFirstMock
			}
		},
		insert: insertMock,
		update: updateMock
	}
}));

vi.mock('$lib/server/db/schema', () => ({
	game: {
		id: 'id',
		player1Id: 'player1Id',
		player2Id: 'player2Id',
		vsAi: 'vsAi',
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
	});

	it('returns 401 when user is unauthorized', async () => {
		const response = await POST({
			locals: { session: null, user: null }
		} as Parameters<typeof POST>[0]);

		expect(response.status).toBe(401);
		await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
		expect(findFirstMock).not.toHaveBeenCalled();
	});

	it('returns null when no waiting game exists', async () => {
		findFirstMock.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
		insertValuesMock.mockResolvedValue(undefined);

		const response = await POST({
			locals: { session: { id: 's1' }, user: { id: 'u2' } }
		} as Parameters<typeof POST>[0]);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({ gameId: null });
		expect(updateMock).not.toHaveBeenCalled();
	});

	it('claims and returns a waiting game id', async () => {
		findFirstMock.mockResolvedValueOnce({ id: 'game-1' });
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
	});

	it('retries when first claim loses race and then succeeds', async () => {
		findFirstMock
			.mockResolvedValueOnce({ id: 'game-1' })
			.mockResolvedValueOnce({ id: 'game-2' });
		returningMock.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: 'game-2' }]);

		const response = await POST({
			locals: { session: { id: 's1' }, user: { id: 'u2' } }
		} as Parameters<typeof POST>[0]);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({ gameId: 'game-2' });
		expect(findFirstMock).toHaveBeenCalledTimes(2);
		expect(updateMock).toHaveBeenCalledTimes(2);
	});

	it('returns null when all claim retries fail', async () => {
		findFirstMock
			.mockResolvedValueOnce({ id: 'game-1' })
			.mockResolvedValueOnce({ id: 'game-2' })
			.mockResolvedValueOnce({ id: 'game-3' });
		returningMock.mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([]);

		const response = await POST({
			locals: { session: { id: 's1' }, user: { id: 'u2' } }
		} as Parameters<typeof POST>[0]);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({ gameId: null });
		expect(findFirstMock).toHaveBeenCalledTimes(4);
		expect(updateMock).toHaveBeenCalledTimes(3);
	});
});
