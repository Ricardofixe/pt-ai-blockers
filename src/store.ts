// saving check results to the database
// one read (latestStates) and one write (saveResults) per run

import { BOTS } from './bots';
import { parseRobots, verdictFor, hasManagedBlock, contentSignal } from './parser';
import { sha256, type CheckResult, type Outcome } from './checker';

// the latest period of a site as stored in site_states
export interface StateRow {
	id: number;
	site_id: number;
	last_seen: string; // 'YYYY-MM-DD'
	outcome: Outcome;
	http_status: number | null;
	robots_hash: string | null;
	is_cloudflare: number | null; // 1, 0, or NULL (no headers to check)
}

// today's check
export interface NewState {
	outcome: Outcome;
	http_status: number | null;
	robots_hash: string | null;
	is_cloudflare: number | null;
}

export function toFlag(value: boolean | null): number | null {
	return value === null ? null : value ? 1 : 0;
}

export function previousDay(day: string): string {
	const date = new Date(`${day}T00:00:00Z`);
	date.setUTCDate(date.getUTCDate() - 1);
	return date.toISOString().slice(0, 10);
}

// extends a period if nothing we record changed AND the period was seen yesterday
export function decideWrite(prev: StateRow | undefined, next: NewState, today: string): 'extend' | 'new' {
	if (prev === undefined) return 'new';
	const same =
		prev.outcome === next.outcome &&
		prev.http_status === next.http_status &&
		prev.robots_hash === next.robots_hash &&
		prev.is_cloudflare === next.is_cloudflare;
	return same && prev.last_seen === previousDay(today) ? 'extend' : 'new';
}

// reads the latest period of every site (keyed by site id in one query)
export async function latestStates(db: D1Database): Promise<Map<number, StateRow>> {
	const { results } = await db
		.prepare(
			`SELECT id, site_id, last_seen, outcome, http_status, robots_hash, is_cloudflare
			 FROM site_states
			 WHERE id IN (SELECT MAX(id) FROM site_states GROUP BY site_id)`,
		)
		.all<StateRow>();
	return new Map(results.map((row) => [row.site_id, row]));
}

// saves a batch of check results
export async function saveResults(
	db: D1Database,
	items: { siteId: number; result: CheckResult }[],
	latest: Map<number, StateRow>,
	today: string,
): Promise<void> {
	const statements: D1PreparedStatement[] = [];

	for (const { siteId, result } of items) {
		const robotsHash = result.body === null ? null : await sha256(result.body);

		// the file and its verdicts "INSERT OR IGNORE"
		// if we've seen this exact file before nothing is added
		if (result.body !== null && robotsHash !== null) {
			statements.push(
				db
					.prepare(
						`INSERT OR IGNORE INTO robots_files (hash, body, has_managed_block, content_signal)
						 VALUES (?, ?, ?, ?)`,
					)
					.bind(robotsHash, result.body, hasManagedBlock(result.body) ? 1 : 0, contentSignal(result.body)),
			);

			// one statement for all bots with VALUES (?, ?, ?), (?, ?, ?), ...
			const groups = parseRobots(result.body);
			const placeholders = BOTS.map(() => '(?, ?, ?)').join(', ');
			const values = BOTS.flatMap((bot) => [robotsHash, bot.name, verdictFor(groups, bot.name)]);
			statements.push(db.prepare(`INSERT OR IGNORE INTO verdicts (robots_hash, bot_name, verdict) VALUES ${placeholders}`).bind(...values));
		}

		// the period either extends the latest one, or starts a new one
		const next: NewState = {
			outcome: result.outcome,
			http_status: result.httpStatus,
			robots_hash: robotsHash,
			is_cloudflare: toFlag(result.isCloudflare),
		};
		const prev = latest.get(siteId);

		if (prev !== undefined && decideWrite(prev, next, today) === 'extend') {
			statements.push(db.prepare(`UPDATE site_states SET last_seen = ? WHERE id = ?`).bind(today, prev.id));
		} else {
			statements.push(
				db
					.prepare(
						`INSERT INTO site_states
						   (site_id, first_seen, last_seen, outcome, http_status, robots_hash, is_cloudflare)
						 VALUES (?, ?, ?, ?, ?, ?, ?)`,
					)
					.bind(siteId, today, today, next.outcome, next.http_status, next.robots_hash, next.is_cloudflare),
			);
		}
	}

	if (statements.length > 0) await db.batch(statements);
}
