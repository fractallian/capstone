import { z } from "zod";

export const stackIndexSchema = z.int().min(0).max(21);

export const serializedMoveSchema = z.object({
	from: stackIndexSchema,
	to: stackIndexSchema,
});

export const gameSnapshotSchema = z.object({
	moves: z.array(serializedMoveSchema),
	currentTurnIndex: z.union([z.literal(0), z.literal(1)]),
});

export const makeMoveCommandSchema = z.object({
	type: z.literal("make_move"),
	from: stackIndexSchema,
	to: stackIndexSchema,
});

export const gameCommandSchema = z.discriminatedUnion("type", [makeMoveCommandSchema]);

export const gameStateSyncEventSchema = z.object({
	type: z.literal("state_sync"),
	snapshot: gameSnapshotSchema,
});

export const gameInvalidMoveEventSchema = z.object({
	type: z.literal("invalid_move"),
	message: z.string(),
});

export const gameServerEventSchema = z.discriminatedUnion("type", [
	gameStateSyncEventSchema,
	gameInvalidMoveEventSchema,
]);

export type StackIndex = z.infer<typeof stackIndexSchema>;
export type SerializedMoveContract = z.infer<typeof serializedMoveSchema>;
export type GameSnapshot = z.infer<typeof gameSnapshotSchema>;
export type MakeMoveCommand = z.infer<typeof makeMoveCommandSchema>;
export type GameCommand = z.infer<typeof gameCommandSchema>;
export type GameStateSyncEvent = z.infer<typeof gameStateSyncEventSchema>;
export type GameInvalidMoveEvent = z.infer<typeof gameInvalidMoveEventSchema>;
export type GameServerEvent = z.infer<typeof gameServerEventSchema>;
