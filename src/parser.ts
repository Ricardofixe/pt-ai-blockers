// parseRobots turns robots.txt text into a list of groups
// verdictFor decides blocked / partial / allowed for one bot

export interface Rule {
	type: 'allow' | 'disallow';
	path: string;
}

export interface Group {
	agents: string[]; // lowercased bot names
	rules: Rule[];
}

export function parseRobots(text: string): Group[] {
	const groups: Group[] = [];
	let current: Group | null = null; // the group we're currently filling
	let lastLineWasUserAgent = false; // add to the current or start a new group

	for (const rawLine of text.split(/\r?\n/)) {
		// remove comments and surrounding spaces
		const hashIndex = rawLine.indexOf('#');
		const line = (hashIndex === -1 ? rawLine : rawLine.slice(0, hashIndex)).trim();
		if (line === '') continue;

		// split at the first colon into field and value
		const colonIndex = line.indexOf(':');
		if (colonIndex === -1) continue;
		const field = line.slice(0, colonIndex).trim().toLowerCase();
		const value = line.slice(colonIndex + 1).trim();

		if (field === 'user-agent') {
			if (current === null || !lastLineWasUserAgent) {
				current = { agents: [], rules: [] };
				groups.push(current);
			}
			if (value !== '') current.agents.push(value.toLowerCase());
			lastLineWasUserAgent = true;
		} else if (field === 'allow' || field === 'disallow') {
			if (current === null) continue; // rule before any user-agent means ignore
			if (value !== '') current.rules.push({ type: field, path: value });
			lastLineWasUserAgent = false;
		} else if (field === 'crawl-delay') {
			if (current !== null) lastLineWasUserAgent = false;
		}
	}

	return groups;
}

export type Verdict = 'blocked' | 'partial' | 'allowed';

// bot names may only contain letters, "-" and "_"
// so anything like a version number is dropped.
function productToken(agent: string): string {
	if (agent === '*') return '*';
	const match = agent.match(/^[a-z_-]+/);
	return match ? match[0] : '';
}

// True if the rule covers the whole site
// "/*" and "*" are treated like "/"
function isRootPath(path: string): boolean {
	return path === '/' || path === '/*' || path === '*';
}

export function verdictFor(groups: Group[], botName: string): Verdict {
	const bot = botName.toLowerCase();

	// finds the rules that apply to this bot
	const named = groups.filter((g) => g.agents.some((a) => productToken(a) === bot));
	const isNamed = named.length > 0;
	const applicable = isNamed ? named : groups.filter((g) => g.agents.includes('*'));
	const rules = applicable.flatMap((g) => g.rules);

	const blocksRoot = rules.some((r) => r.type === 'disallow' && isRootPath(r.path));
	const allowsRoot = rules.some((r) => r.type === 'allow' && isRootPath(r.path));

	if (blocksRoot && !allowsRoot) {
		// the whole site is blocked, unless some paths are allowed back
		const allowsSome = rules.some((r) => r.type === 'allow');
		return allowsSome ? 'partial' : 'blocked';
	}

	// when a bot's group restricts a specific path
	// while the rest have generic * housekeeping rules.
	if (isNamed && rules.some((r) => r.type === 'disallow' && !isRootPath(r.path))) {
		return 'partial';
	}

	return 'allowed';
}

// True if the file contains Cloudflare's managed robots.txt section
export function hasManagedBlock(text: string): boolean {
	return /#\s*BEGIN Cloudflare Managed content/i.test(text);
}

// the value of the first Content-Signal line, or null.
export function contentSignal(text: string): string | null {
	for (const rawLine of text.split(/\r?\n/)) {
		const hashIndex = rawLine.indexOf('#');
		const line = (hashIndex === -1 ? rawLine : rawLine.slice(0, hashIndex)).trim();
		const colonIndex = line.indexOf(':');
		if (colonIndex === -1) continue;
		const field = line.slice(0, colonIndex).trim().toLowerCase();
		if (field === 'content-signal') return line.slice(colonIndex + 1).trim();
	}
	return null;
}
