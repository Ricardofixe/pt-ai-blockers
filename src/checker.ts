// fetches each site's robots.txt and records what it found.

// helpers

// matches site_states.outcome in migrations/0001_initial.sql
export type Outcome = 'ok' | 'not_found' | 'server_error' | 'unreachable' | 'challenge';

// turns a response into an outcome
export function classifyResponse(status: number, body: string): Outcome {
	if (status >= 500) return 'server_error'; // treat as unknown
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
	const bytes = new TextEncoder().encode(text); // text becomes bytes
	const digest = await crypto.subtle.digest('SHA-256', bytes); // bytes become a 32-byte hash
	return [...new Uint8Array(digest)]
		.map((b) => b.toString(16).padStart(2, '0')) // each byte becomes 2 hex characters
		.join('');
}

// checking a site

const USER_AGENT = 'pt-ai-blockers'; // identifies us
const TIMEOUT_MS = 10_000; // give up on a site after 10 seconds
const MAX_CHARS = 500 * 1024; // standard minimum for crawlers

export interface CheckResult {
	outcome: Outcome;
	httpStatus: number | null; // null if we got no response
	isCloudflare: boolean | null; // null if the DNS lookup failed
	body: string | null; // the cleaned robots.txt
}

// Cloudflare detection

// Cloudflare's published IPv4 ranges https://www.cloudflare.com/ips/
const CLOUDFLARE_RANGES = [
	'173.245.48.0/20',
	'103.21.244.0/22',
	'103.22.200.0/22',
	'103.31.4.0/22',
	'141.101.64.0/18',
	'108.162.192.0/18',
	'190.93.240.0/20',
	'188.114.96.0/20',
	'197.234.240.0/22',
	'198.41.128.0/17',
	'162.158.0.0/15',
	'104.16.0.0/13',
	'104.24.0.0/14',
	'172.64.0.0/13',
	'131.0.72.0/22',
];

// "104.16.1.1" becomes one 32-bit number, null if it isn't a valid IPv4 address
function ipToNumber(ip: string): number | null {
	const parts = ip.split('.').map(Number);
	if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) return null;
	return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

// true if the IPv4 address is inside one of Cloudflare's ranges
export function isCloudflareIp(ip: string): boolean {
	const n = ipToNumber(ip);
	if (n === null) return false;
	return CLOUDFLARE_RANGES.some((range) => {
		const [base, bits] = range.split('/');
		const mask = (~0 << (32 - Number(bits))) >>> 0; // e.g. /13 keeps the first 13 bits
		return (n & mask) >>> 0 === (ipToNumber(base)! & mask) >>> 0;
	});
}

// true / false if the site's addresses are / aren't Cloudflare's, null if we couldn't tell
export function cloudflareFromIps(ips: string[] | null): boolean | null {
	if (ips === null || ips.length === 0) return null;
	return ips.some(isCloudflareIp);
}

// looks up a hostname's IPv4 addresses with DNS-over-HTTPS
export async function resolveIPv4(domain: string): Promise<string[] | null> {
	try {
		const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=A`, {
			headers: { accept: 'application/dns-json' },
			signal: AbortSignal.timeout(TIMEOUT_MS),
		});
		if (!res.ok) return null;
		const data = (await res.json()) as {
			Status: number;
			Answer?: { type: number; data: string }[];
		};
		if (data.Status !== 0) return null; // 0 = the lookup succeeded
		return (data.Answer ?? []).filter((a) => a.type === 1).map((a) => a.data); // type 1 = an IPv4 (A) record
	} catch {
		return null;
	}
}

// fetches https://<domain>/robots.txt and describes what came back
export async function checkSite(domain: string): Promise<CheckResult> {
	// look up the site's addresses at the same time as fetching robots.txt
	const cloudflare = resolveIPv4(domain).then(cloudflareFromIps);

	let response: Response;
	try {
		response = await fetch(`https://${domain}/robots.txt`, {
			headers: { 'User-Agent': USER_AGENT },
			redirect: 'follow', // RFC 9309: follow redirects
			signal: AbortSignal.timeout(TIMEOUT_MS),
		});
	} catch {
		// timeout, DNS failure, refused connection...
		return {
			outcome: 'unreachable',
			httpStatus: null,
			isCloudflare: await cloudflare,
			body: null,
		};
	}

	const httpStatus = response.status;
	const isCloudflare = await cloudflare;

	let text: string;
	try {
		text = (await response.text()).slice(0, MAX_CHARS);
	} catch {
		return { outcome: 'unreachable', httpStatus, isCloudflare, body: null };
	}

	const outcome = classifyResponse(httpStatus, text);
	return {
		outcome,
		httpStatus,
		isCloudflare,
		body: outcome === 'ok' ? cleanRobots(text) : null,
	};
}
