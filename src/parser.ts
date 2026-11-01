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
