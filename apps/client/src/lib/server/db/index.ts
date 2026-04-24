import { building } from '$app/environment';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { env } from '$env/dynamic/private';

const databaseUrl =
	env.DATABASE_URL ?? (building ? 'postgresql://build:build@127.0.0.1:5432/build' : undefined);

if (!databaseUrl) throw new Error('DATABASE_URL is not set');

/** Transaction pool (port 6543) does not support prepared statements; session pool on 5432 does. */
function isSupabaseTransactionPooler(url: string): boolean {
	try {
		const u = new URL(url.replace(/^postgres:/, 'http:'));
		return u.port === '6543';
	} catch {
		return false;
	}
}

const client = postgres(databaseUrl, {
	prepare: !isSupabaseTransactionPooler(databaseUrl)
});

export const db = drizzle(client, { schema });
