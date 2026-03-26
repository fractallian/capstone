import { pgTable, serial, integer, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { user } from './auth.schema';

export const task = pgTable('task', {
	id: serial('id').primaryKey(),
	title: text('title').notNull(),
	priority: integer('priority').notNull().default(1)
});

export const game = pgTable(
	'game',
	{
		id: text('id').primaryKey(),
		player1Id: text('player1_id')
			.notNull()
			.references(() => user.id, { onDelete: 'restrict' }),
		player2Id: text('player2_id')
			.notNull()
			.references(() => user.id, { onDelete: 'restrict' }),
		startedAt: timestamp('started_at').notNull(),
		endedAt: timestamp('ended_at')
	},
	(table) => [index('game_player1_id_idx').on(table.player1Id), index('game_player2_id_idx').on(table.player2Id)]
);

export const boardState = pgTable(
	'board_state',
	{
		id: text('id').primaryKey(),
		gameId: text('game_id')
			.notNull()
			.references(() => game.id, { onDelete: 'cascade' }),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		board: jsonb('board').notNull()
	},
	(table) => [index('board_state_game_id_idx').on(table.gameId)]
);

export * from './auth.schema';
