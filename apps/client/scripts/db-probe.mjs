import 'dotenv/config';
import postgres from 'postgres';

const url = process.env.DATABASE_URL;
if (!url) {
	console.error('DATABASE_URL is not set');
	process.exit(1);
}

const isRemote =
	/supabase\.co|pooler\.supabase\.com|neon\.tech|render\.com|amazonaws\.com/.test(url);
const sql = postgres(url, {
	max: 1,
	...(isRemote ? { ssl: 'require' } : {})
});

try {
	await sql`select 1 as ok`;
	console.log('Database connection OK');
} catch (err) {
	const msg = String(err.message || err);
	console.error('Database connection failed:', msg);
	if (msg.includes('ENOTFOUND') || msg.includes('getaddrinfo')) {
		console.error(
			'Hint: If the host is db.*.supabase.co, many networks are IPv4-only while that host is IPv6-only — use the Session pooler URI from Supabase (Connect → Database, “IPv4 compatible”), e.g. aws-0-*.pooler.supabase.com:5432. See https://supabase.com/docs/guides/troubleshooting/supabase--your-network-ipv4-and-ipv6-compatibility'
		);
	}
	if (msg.includes('password authentication failed')) {
		console.error(
			'Hint: Use the database password from Supabase → Project Settings → Database (reset it if unsure). For pooler URIs the username is often postgres.<project_ref>, not just postgres. If the password has @ # : etc., paste the full URI from the dashboard or URL-encode those characters.'
		);
	}
	process.exitCode = 1;
} finally {
	await sql.end({ timeout: 5 });
}
