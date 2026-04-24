import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';

const MAX_SIZE = 256;
const MIN_SIZE = 16;
const DEFAULT_SIZE = 96;

function normalizeSize(input: string | null): number {
	const parsed = Number.parseInt(input ?? '', 10);
	if (!Number.isFinite(parsed)) return DEFAULT_SIZE;
	return Math.min(MAX_SIZE, Math.max(MIN_SIZE, parsed));
}

function withGoogleSize(url: string, size: number): string {
	try {
		const parsed = new URL(url);
		if (!parsed.hostname.includes('googleusercontent.com')) return url;
		if (parsed.searchParams.has('sz')) {
			parsed.searchParams.set('sz', String(size));
			return parsed.toString();
		}
		parsed.searchParams.set('sz', String(size));
		return parsed.toString();
	} catch {
		return url;
	}
}

export const GET: RequestHandler = async ({ params, url, fetch }) => {
	const size = normalizeSize(url.searchParams.get('size'));
	const [avatarOwner] = await db
		.select({ image: user.image })
		.from(user)
		.where(eq(user.id, params.userId))
		.limit(1);

	if (!avatarOwner?.image) {
		throw error(404, 'Avatar not found');
	}

	const upstreamUrl = withGoogleSize(avatarOwner.image, size);
	const upstream = await fetch(upstreamUrl, {
		headers: {
			accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8'
		}
	});

	if (!upstream.ok) {
		throw error(404, 'Avatar unavailable');
	}

	return new Response(upstream.body, {
		headers: {
			'content-type': upstream.headers.get('content-type') ?? 'image/jpeg',
			'cache-control': 'public, max-age=86400, stale-while-revalidate=604800'
		}
	});
};
