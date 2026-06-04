import type { NewRecord } from '../records';

const BASE_URL = 'https://www.rnz.co.nz';
const LEAD_CLASSES = ['lead-story--standard', 'lead-story--defcon'] as const;
const TOP_STORIES_MARKER = '<ul class="c-top-stories__list">';

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

function extractLeadBlock(html: string, className: string): string | null {
	const marker = html.indexOf(className);
	if (marker === -1) return null;

	const divStart = html.lastIndexOf('<div', marker);
	const end = html.indexOf(TOP_STORIES_MARKER, marker);
	if (divStart === -1 || end === -1) return null;

	return html.slice(divStart, end);
}

function resolveUrl(baseUrl: string, href: string): string {
	return new URL(href, baseUrl).href;
}

function parseLeadBlock(block: string, baseUrl: string): Omit<NewRecord, 'site' | 'retrieved'> {
	const imgMatch = block.match(/<img[^>]+src="([^"]+)"/);
	const linkMatch = block.match(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
	const summaryMatch = block.match(
		/<div class="o-digest__summary">\s*<p[^>]*>([\s\S]*?)<\/p>/,
	);

	if (!linkMatch) {
		throw new Error('RNZ lead story is missing a link');
	}
	if (!summaryMatch) {
		throw new Error('RNZ lead story is missing a summary');
	}

	return {
		story_url: resolveUrl(baseUrl, linkMatch[1]!),
		headline: htmlText(linkMatch[2]!),
		summary: htmlText(summaryMatch[1]!),
		image_url: imgMatch ? resolveUrl(baseUrl, imgMatch[1]!) : null,
	};
}

export async function scrapeRnz(): Promise<NewRecord | null> {
	const response = await fetch(BASE_URL);
	if (!response.ok) {
		return null;
	}

	const html = await response.text();
	const leadBlock =
		LEAD_CLASSES.map((className) => extractLeadBlock(html, className)).find(
			Boolean,
		) ?? null;

	if (!leadBlock) {
		return null;
	}

	return {
		...parseLeadBlock(leadBlock, BASE_URL),
		site: 'rnz',
		retrieved: new Date().toISOString(),
	};
}
