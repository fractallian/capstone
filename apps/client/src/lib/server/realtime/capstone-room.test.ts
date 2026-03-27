import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CapstoneRoom } from './capstone-room';

const {
	insertValuesMock,
	insertMock,
	updateSetMock,
	updateWhereMock,
	updateMock,
	gameFindFirstMock,
	boardStateFindFirstMock,
	setCurrentGameForUserMock,
	clearCurrentGameForUserMock
} = vi.hoisted(() => {
	const insertValues = vi.fn(async () => undefined);
	const insertFn = vi.fn(() => ({ values: insertValues }));

	const updateWhere = vi.fn(async () => undefined);
	const updateSet = vi.fn(() => ({ where: updateWhere }));
	const updateFn = vi.fn(() => ({ set: updateSet }));

	const gameFindFirst = vi.fn(async () => null);
	const boardStateFindFirst = vi.fn(async () => null);

	const setCurrentGameForUser = vi.fn();
	const clearCurrentGameForUser = vi.fn();

	return {
		insertValuesMock: insertValues,
		insertMock: insertFn,
		updateSetMock: updateSet,
		updateWhereMock: updateWhere,
		updateMock: updateFn,
		gameFindFirstMock: gameFindFirst,
		boardStateFindFirstMock: boardStateFindFirst,
		setCurrentGameForUserMock: setCurrentGameForUser,
		clearCurrentGameForUserMock: clearCurrentGameForUser
	};
});

vi.mock('$lib/server/db', () => ({
	db: {
		insert: insertMock,
		update: updateMock,
		query: {
			game: { findFirst: gameFindFirstMock },
			boardState: { findFirst: boardStateFindFirstMock }
		}
	}
}));

vi.mock('./server', () => ({
	setCurrentGameForUser: setCurrentGameForUserMock,
	clearCurrentGameForUser: clearCurrentGameForUserMock
}));

type TestClient = {
	sessionId: string;
	send: ReturnType<typeof vi.fn>;
	leave: ReturnType<typeof vi.fn>;
};

function createClient(sessionId: string): TestClient {
	return {
		sessionId,
		send: vi.fn(),
		leave: vi.fn()
	};
}

function createRoom() {
	const room = new CapstoneRoom() as CapstoneRoom & {
		clients: TestClient[];
		setMetadata: ReturnType<typeof vi.fn>;
		broadcast: ReturnType<typeof vi.fn>;
		onMessage: ReturnType<typeof vi.fn>;
		lock: ReturnType<typeof vi.fn>;
	};
	room.clients = [];
	room.setMetadata = vi.fn(async () => undefined);
	room.broadcast = vi.fn();
	room.onMessage = vi.fn();
	room.lock = vi.fn();
	return room;
}

describe('CapstoneRoom onJoin lifecycle', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		gameFindFirstMock.mockResolvedValue(null);
		boardStateFindFirstMock.mockResolvedValue(null);
	});

	it('first player join persists game and receives waiting event', async () => {
		const room = createRoom();
		await room.onCreate({
			gameId: '11111111-1111-1111-1111-111111111111'
		});

		const client1 = createClient('s1');
		room.clients = [client1];

		await room.onJoin(client1 as never, { userId: 'u1' });

		expect(insertMock).toHaveBeenCalledTimes(2);
		expect(setCurrentGameForUserMock).toHaveBeenCalledWith(
			'u1',
			'11111111-1111-1111-1111-111111111111'
		);
		expect(client1.send).toHaveBeenCalledWith('event', {
			type: 'waiting_for_player',
			gameId: '11111111-1111-1111-1111-111111111111'
		});
		expect(room.broadcast).toHaveBeenCalledWith('event', {
			type: 'presence_update',
			gameId: '11111111-1111-1111-1111-111111111111',
			connectedPlayerIndexes: [0]
		});
	});

	it('second player join assigns player2 and broadcasts game_started', async () => {
		const room = createRoom();
		await room.onCreate({
			gameId: '11111111-1111-1111-1111-111111111111'
		});

		const client1 = createClient('s1');
		room.clients = [client1];
		await room.onJoin(client1 as never, { userId: 'u1' });

		const client2 = createClient('s2');
		room.clients = [client1, client2];
		await room.onJoin(client2 as never, { userId: 'u2' });

		expect(updateMock).toHaveBeenCalledTimes(1);
		expect(updateSetMock).toHaveBeenCalledWith({ player2Id: 'u2' });
		expect(updateWhereMock).toHaveBeenCalledTimes(1);
		expect(setCurrentGameForUserMock).toHaveBeenCalledWith(
			'u2',
			'11111111-1111-1111-1111-111111111111'
		);
		expect(room.broadcast).toHaveBeenCalledWith('event', {
			type: 'game_started',
			gameId: '11111111-1111-1111-1111-111111111111'
		});
	});
});
