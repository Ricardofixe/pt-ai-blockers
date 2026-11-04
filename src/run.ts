// one scheduled run syncs the lists, checking up to batchSize sites that
// haven't been checked today, and saves the results

import { syncReferenceData } from './sync';
import { checkSite } from './checker';
import { latestStates, saveResults } from './store';

export async function runBatch(db: D1Database, today: string, batchSize: number): Promise<void> {
	await syncReferenceData(db);

	// pick sites with no period seen today
	const { results: sites } = await db
		.prepare(
			`SELECT id, domain FROM sites
			 WHERE id NOT IN (SELECT site_id FROM site_states WHERE last_seen = ?)
			 ORDER BY id
			 LIMIT ?`,
		)
		.bind(today, batchSize)
		.all<{ id: number; domain: string }>();

	if (sites.length === 0) {
		console.log(`${today}: all sites already checked`);
		return;
	}

	// read the latest periods before checking
	const latest = await latestStates(db);

	// check all sites at the same time
	const items = await Promise.all(sites.map(async (site) => ({ siteId: site.id, result: await checkSite(site.domain) })));

	// save everything in one transaction
	await saveResults(db, items, latest, today);

	// one-line summary for the logs
	const counts: Record<string, number> = {};
	for (const { result } of items) counts[result.outcome] = (counts[result.outcome] ?? 0) + 1;
	const summary = Object.entries(counts)
		.map(([outcome, n]) => `${outcome} ${n}`)
		.join(', ');
	console.log(`${today}: checked ${items.length} (${summary})`);
}
