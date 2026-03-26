import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { env } from '$env/dynamic/private';

if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

/** Transaction pool (port 6543) does not support prepared statements; session pool on 5432 does. */
function isSupabaseTransactionPooler(url: string): boolean {
	try {
		const u = new URL(url.replace(/^postgres:/, 'http:'));
		return u.port === '6543';
	} catch {
		return false;
	}
}

const client = postgres(env.DATABASE_URL, {
	prepare: !isSupabaseTransactionPooler(env.DATABASE_URL)
});

export const db = drizzle(client, { schema });
