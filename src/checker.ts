// fetches each site's robots.txt and records what it found.

// helpers

// matches site_states.outcome in migrations/0001_initial.sql
export type Outcome = 'ok' | 'not_found' | 'server_error' | 'unreachable' | 'challenge';

// turns a response into an outcome
export function classifyResponse(status: number, body: string): Outcome {
	if (status >= 500) return 'server_error'; // treat as unkown
	if (status === 401 || status === 403 || status === 429) return 'challenge'; // access refused to our checker
	if (status >= 400) return 'not_found'; // no robots.txt means everything allowed
	if (status >= 200 && status < 300) {
		// a 200 can still be something other than a robots.txt
		// HTML, JSON, a plain-text message...
		return looksLikeRobots(body) ? 'ok' : 'challenge';
	}
	return 'unreachable';
}

// fields that only appear in robots.txt files
const ROBOTS_FIELD = /^(user-agent|allow|disallow|sitemap|crawl-delay|host|content-signal)\s*:/i;

// True if the body is a robots.txt
function looksLikeRobots(body: string): boolean {
	const lines = body
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => line !== '');
	if (lines.length === 0) return true; // empty file means valid, allows everything
	if (lines[0].startsWith('<')) return false; // HTML or XML
	// valid if it has a robots.txt field, or if it is nothing but comments
	return lines.some((line) => ROBOTS_FIELD.test(line)) || lines.every((line) => line.startsWith('#'));
}

// normalizes a robots.txt before hashing so little differences don't count as changes
// comments are kept since Cloudflare's managed block lives in comments
export function cleanRobots(text: string): string {
	return text
		.replace(/^\uFEFF/, '') // byte order mark at the start
		.replace(/\r\n?/g, '\n') // Windows (\r\n) and old Mac (\r) line endings become \n
		.split('\n')
		.map((line) => line.trim()) // spaces and tabs at the start and end of each line
		.join('\n')
		.trimEnd(); // blank lines at the end of the file after the join
}

// SHA-256 fingerprint of a text as 64 hex characters
export async function sha256(text: string): Promise<string> {
	const bytes = new TextEncoder().encode(text); // text becomrs bytes
	const digest = await crypto.subtle.digest('SHA-256', bytes); // bytes become a 32-byte hash
	return [...new Uint8Array(digest)]
		.map((b) => b.toString(16).padStart(2, '0')) // each byte becomes 2 hex characters
		.join('');
}

// checking a site

const USER_AGENT = 'pt-ai-blockers'; // identifies us
const TIMEOUT_MS = 10_000; // give up on a site after 10 seconds
const MAX_CHARS = 500 * 1024; // standart minnimum for crawlers

export interface CheckResult {
	outcome: Outcome;
	httpStatus: number | null; // null if we got no response
	isCloudflare: boolean | null; // null if we had no headers to check
	body: string | null; // the cleaned robots.txt
}

// fetches https://<domain>/robots.txt and describes what came back
export async function checkSite(domain: string): Promise<CheckResult> {
	let response: Response;
	try {
		response = await fetch(`https://${domain}/robots.txt`, {
			headers: { 'User-Agent': USER_AGENT },
			redirect: 'follow', // RFC 9309: follow redirects
			signal: AbortSignal.timeout(TIMEOUT_MS),
		});
	} catch {
		// timeout, DNS failure, refused connection...
		return { outcome: 'unreachable', httpStatus: null, isCloudflare: null, body: null };
	}

	const httpStatus = response.status;
	const isCloudflare = response.headers.has('cf-ray');

	let text: string;
	try {
		text = (await response.text()).slice(0, MAX_CHARS);
	} catch {
		return { outcome: 'unreachable', httpStatus, isCloudflare, body: null };
	}

	const outcome = classifyResponse(httpStatus, text);
	return { outcome, httpStatus, isCloudflare, body: outcome === 'ok' ? cleanRobots(text) : null };
}
