import type { NewRecord } from '../records';

const BASE_URL = 'https://www.rnz.co.nz';
const TOP_STORIES_MARKER = '<h2 class="sr-only">Top stories</h2>';

function decodeHtmlEntities(text: string): string {
	const named: Record<string, string> = {
		amp: '&',
		lt: '<',
		gt: '>',
		quot: '"',
		apos: "'",
		nbsp: ' ',
	};

	return text.replace(
		/&(#(\d+)|#x([0-9a-f]+)|(\w+));/gi,
		(match, _full, dec, hex, name) => {
			if (dec) return String.fromCharCode(Number(dec));
			if (hex) return String.fromCharCode(parseInt(hex, 16));
			if (name && name in named) return named[name]!;
			return match;
		},
	);
}

function htmlText(raw: string): string {
	return decodeHtmlEntities(raw.replace(/<[^>]*>/g, ''))
		.replace(/\s+/g, ' ')
		.trim();
}

function extractLeadArticle(html: string): string | null {
	const marker = html.indexOf(TOP_STORIES_MARKER);
	if (marker === -1) return null;

	const articleStart = html.indexOf('<article', marker);
	const articleEnd = html.indexOf('</article>', articleStart);
	if (articleStart === -1 || articleEnd === -1) return null;

	return html.slice(articleStart, articleEnd + '</article>'.length);
}

function resolveUrl(baseUrl: string, href: string): string {
	return new URL(href, baseUrl).href;
}

function parseLeadArticle(
	block: string,
	baseUrl: string,
): Pick<NewRecord, 'story_url' | 'headline' | 'image_url'> {
	const linkMatch = block.match(
		/<h3[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/,
	);
	const imgMatch = block.match(/<img[^>]+src="([^"]+)"/);

	if (!linkMatch) {
		throw new Error('RNZ lead story is missing a link');
	}

	return {
		story_url: resolveUrl(baseUrl, linkMatch[1]!),
		headline: htmlText(linkMatch[2]!),
		image_url: imgMatch ? resolveUrl(baseUrl, imgMatch[1]!) : null,
	};
}

function parseMetaDescription(html: string): string | null {
	const match =
		html.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/) ??
		html.match(/<meta[^>]+content="([^"]+)"[^>]+name="description"/) ??
		html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/) ??
		html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:description"/);

	return match ? htmlText(match[1]!) : null;
}

async function fetchSummary(storyUrl: string): Promise<string> {
	const response = await fetch(storyUrl);
	if (!response.ok) {
		throw new Error(`RNZ article fetch failed (${response.status})`);
	}

	const summary = parseMetaDescription(await response.text());
	if (!summary) {
		throw new Error('RNZ article is missing a summary');
	}

	return summary;
}

export async function scrapeRnz(): Promise<NewRecord | null> {
	const response = await fetch(BASE_URL);
	if (!response.ok) {
		return null;
	}

	const html = await response.text();
	const leadArticle = extractLeadArticle(html);
	if (!leadArticle) {
		return null;
	}

	const lead = parseLeadArticle(leadArticle, BASE_URL);

	return {
		...lead,
		summary: await fetchSummary(lead.story_url),
		site: 'rnz',
		retrieved: new Date().toISOString(),
	};
}
