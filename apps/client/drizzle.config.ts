import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

const rawUrl = process.env.DATABASE_URL;

/** For hosts where TLS is required; appended when using URL-based credentials only. */
function withSslModeInUrl(url: string): string {
	const needsSsl =
		url.includes('supabase.co') ||
		url.includes('pooler.supabase.com') ||
		url.includes('neon.tech') ||
		url.includes('render.com') ||
		url.includes('amazonaws.com');
	if (!needsSsl || /[?&]sslmode=/i.test(url)) return url;
	const joiner = url.includes('?') ? '&' : '?';
	return `${url}${joiner}sslmode=require`;
}

function parsePostgresUrl(connectionString: string): {
	host: string;
	port: number;
	user: string;
	password: string;
	database: string;
} {
	const normalized = connectionString.replace(/^postgres(ql)?:\/\//i, 'http://');
	const u = new URL(normalized);
	const database = u.pathname.replace(/^\//, '') || 'postgres';
	return {
		host: u.hostname,
		port: u.port ? Number(u.port) : 5432,
		user: u.username ? decodeURIComponent(u.username) : '',
		password: u.password ? decodeURIComponent(u.password) : '',
		database
	};
}

/**
 * drizzle-kit + `pg`: when `dbCredentials` is only `{ url }`, it uses
 * `new Pool({ connectionString })` and never applies `ssl` from config — TLS breaks for Supabase.
 * Discrete host/user/password + `ssl` uses the branch that passes `ssl` into `Pool`.
 */
const useDiscreteCredentialsWithSsl =
	rawUrl.includes('supabase.co') ||
	rawUrl.includes('pooler.supabase.com') ||
	rawUrl.includes('neon.tech');

const dbCredentials = useDiscreteCredentialsWithSsl
	? { ...parsePostgresUrl(rawUrl), ssl: 'require' as const }
	: { url: withSslModeInUrl(rawUrl) };

export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	dialect: 'postgresql',
	dbCredentials,
	verbose: true,
	strict: false
});
