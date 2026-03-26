import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

declare const process: { env: Record<string, string | undefined> };

function getRequiredEnv(name: string): string {
	const value = process.env[name];
	if (!value) {
		throw new Error(`${name} is not set`);
	}
	return value;
}

const rawUrl = getRequiredEnv('DATABASE_URL');

export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	dialect: 'postgresql',
	dbCredentials: { url: rawUrl },
	verbose: true,
	strict: false
});
