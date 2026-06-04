import { getRandomRecord, insertRecord } from './records';
import { scrapeRnz } from './scrapers/rnz';

function isAllowedOrigin(origin: string | null): origin is string {
	if (!origin) return false;
	try {
		const host = new URL(origin).hostname.toLowerCase();
		return (
			host === 'jamescmacey.com' ||
			host === 'macey.nz' ||
			host.endsWith('.jamescmacey.com') ||
			host.endsWith('.macey.nz')
		);
	} catch {
		return false;
	}
}

function corsHeaders(origin: string): HeadersInit {
	return {
		'Access-Control-Allow-Origin': origin,
		'Access-Control-Allow-Methods': 'GET, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type',
		Vary: 'Origin',
	};
}

function withCors(response: Response, origin: string | null): Response {
	if (!isAllowedOrigin(origin)) {
		return response;
	}

	const headers = new Headers(response.headers);
	for (const [key, value] of Object.entries(corsHeaders(origin))) {
		headers.set(key, value);
	}
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}

export default {
	async fetch(req, env) {
		const origin = req.headers.get('Origin');

		if (req.method === 'OPTIONS') {
			if (!isAllowedOrigin(origin)) {
				return new Response(null, { status: 403 });
			}
			return new Response(null, { status: 204, headers: corsHeaders(origin) });
		}

		const record = await getRandomRecord(env.HEADLICE);
		if (!record) {
			return withCors(new Response('No records found', { status: 404 }), origin);
		}
		return withCors(Response.json(record), origin);
	},

	async scheduled(event, env): Promise<void> {
		try {
			const record = await scrapeRnz();
			if (!record) {
				console.error(`cron ${event.cron}: RNZ scrape failed`);
				await fetch(env.HEARTBEAT_URL + '/fail')
				return;
			}

			await insertRecord(env.HEADLICE, record);
			console.log(
				`cron ${event.cron}: saved RNZ headline "${record.headline}"`,
			);
			await fetch(env.HEARTBEAT_URL)
		} catch (err) {
			console.error(`cron ${event.cron}:`, err);
			await fetch(env.HEARTBEAT_URL + '/fail')
		}
	},
} satisfies ExportedHandler<Env>;
