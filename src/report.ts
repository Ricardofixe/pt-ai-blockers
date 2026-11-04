// builds the dashboard data from the database

import { BOTS, type Bot, type Purpose } from './bots';
import type { Outcome } from './checker';
import type { Verdict } from './parser';

const PURPOSES: Purpose[] = ['training', 'search', 'user'];
const RANK: Record<Verdict, number> = { allowed: 0, partial: 1, blocked: 2 };

type Counts = { blocked: number; partial: number; allowed: number };
const emptyCounts = (): Counts => ({ blocked: 0, partial: 0, allowed: 0 });

// the site plus its latest period (all NULL if never checked)
export interface SiteRow {
	domain: string;
	name: string;
	sector: string;
	last_seen: string | null;
	outcome: Outcome | null;
	http_status: number | null;
	is_cloudflare: number | null;
	robots_hash: string | null;
	has_managed_block: number | null;
	content_signal: string | null;
}

export interface VerdictRow {
	robots_hash: string;
	bot_name: string;
	verdict: Verdict;
}

export interface SiteReport {
	domain: string;
	name: string;
	sector: string;
	lastSeen: string | null;
	outcome: Outcome | 'not_checked';
	httpStatus: number | null;
	known: boolean; // true if we could read the site's policy (ok or not_found)
	isCloudflare: boolean | null;
	managedBlock: boolean | null;
	contentSignal: string | null;
	purposes: Record<Purpose, Verdict | null>; // strongest verdict among current bots of that purpose
	bots: Record<string, Verdict | null>;
}

// a site in one of the cloudflare lists
export interface SiteRef {
	domain: string;
	name: string;
	sector: string;
	contentSignal: string | null;
}

export interface Report {
	checkedOn: string | null; // most recent check date
	totals: { sites: number; known: number; unknown: Record<string, number> };
	cloudflare: { yes: number; no: number; unknown: number };
	managedBlock: number;
	contentSignal: number;
	byPurpose: Record<Purpose, Counts>;
	bySector: { sector: string; sites: number; known: number; cloudflare: number; purposes: Record<Purpose, Counts> }[];
	cloudflareInsight: {
		behind: { sites: number; training: Counts }; // readable sites served through cloudflare
		notBehind: { sites: number; training: Counts }; // readable sites not served through cloudflare
		managed: SiteRef[]; // sites using cloudflare's managed robots.txt
		contentSignals: SiteRef[]; // sites with a Content-Signal line
		openOnCloudflare: SiteRef[]; // readable, on cloudflare, but not blocking any AI training bot
	};
	byBot: { name: string; operator: string; purpose: Purpose; deprecated: boolean; counts: Counts }[];
	deprecatedOnly: { domain: string; name: string; oldBot: string; currentBots: string[] }[];
	sites: SiteReport[];
}

// the strongest of verdicts
export function strongest(verdicts: Verdict[]): Verdict {
	return verdicts.reduce<Verdict>((best, v) => (RANK[v] > RANK[best] ? v : best), 'allowed');
}

export function buildReport(rows: SiteRow[], verdictRows: VerdictRow[], bots: Bot[]): Report {
	// Verdicts per file: hash -> bot name -> verdict
	const byHash = new Map<string, Map<string, Verdict>>();
	for (const v of verdictRows) {
		if (!byHash.has(v.robots_hash)) byHash.set(v.robots_hash, new Map());
		byHash.get(v.robots_hash)!.set(v.bot_name, v.verdict);
	}

	const sites: SiteReport[] = rows.map((row) => {
		const outcome = row.outcome ?? 'not_checked';
		const known = outcome === 'ok' || outcome === 'not_found';
		const fileVerdicts = row.robots_hash ? byHash.get(row.robots_hash) : undefined;

		// no robots.txt (404) means every bot is allowed
		// unknown outcomes get null
		const botVerdicts: Record<string, Verdict | null> = {};
		for (const bot of bots) {
			botVerdicts[bot.name] = outcome === 'not_found' ? 'allowed' : outcome === 'ok' ? (fileVerdicts?.get(bot.name) ?? null) : null;
		}

		// per purpose strongest verdict among current bots
		const purposes = {} as Record<Purpose, Verdict | null>;
		for (const purpose of PURPOSES) {
			const current = bots.filter((b) => b.purpose === purpose && !b.deprecated);
			const verdicts = current.map((b) => botVerdicts[b.name]).filter((v): v is Verdict => v !== null);
			purposes[purpose] = known ? strongest(verdicts) : null;
		}

		return {
			domain: row.domain,
			name: row.name,
			sector: row.sector,
			lastSeen: row.last_seen,
			outcome,
			httpStatus: row.http_status,
			known,
			isCloudflare: row.is_cloudflare === null ? null : row.is_cloudflare === 1,
			managedBlock: row.has_managed_block === null ? null : row.has_managed_block === 1,
			contentSignal: row.content_signal,
			purposes,
			bots: botVerdicts,
		};
	});

	const knownSites = sites.filter((s) => s.known);

	// unknown outcomes counted by type
	const unknown: Record<string, number> = {};
	for (const s of sites) if (!s.known) unknown[s.outcome] = (unknown[s.outcome] ?? 0) + 1;

	const countPurpose = (list: SiteReport[], purpose: Purpose): Counts => {
		const c = emptyCounts();
		for (const s of list) {
			const v = s.purposes[purpose];
			if (v) c[v]++;
		}
		return c;
	};

	const byPurpose = Object.fromEntries(PURPOSES.map((p) => [p, countPurpose(knownSites, p)])) as Record<Purpose, Counts>;

	const sectors = [...new Set(sites.map((s) => s.sector))];
	const bySector = sectors.map((sector) => {
		const inSector = sites.filter((s) => s.sector === sector);
		const known = inSector.filter((s) => s.known);
		return {
			sector,
			sites: inSector.length,
			known: known.length,
			cloudflare: inSector.filter((s) => s.isCloudflare === true).length,
			purposes: Object.fromEntries(PURPOSES.map((p) => [p, countPurpose(known, p)])) as Record<Purpose, Counts>,
		};
	});

	const byBot = bots.map((bot) => {
		const counts = emptyCounts();
		for (const s of knownSites) {
			const v = s.bots[bot.name];
			if (v) counts[v]++;
		}
		return { name: bot.name, operator: bot.operator, purpose: bot.purpose, deprecated: bot.deprecated, counts };
	});

	// sites that block an old name but leave the operator's current bot(s) for that purpose allowed
	const deprecatedOnly: Report['deprecatedOnly'] = [];
	for (const s of knownSites) {
		for (const old of bots.filter((b) => b.deprecated)) {
			const v = s.bots[old.name];
			if (v !== 'blocked' && v !== 'partial') continue;
			const current = bots.filter((b) => !b.deprecated && b.operator === old.operator);
			if (current.length > 0 && current.every((b) => s.bots[b.name] === 'allowed')) {
				deprecatedOnly.push({ domain: s.domain, name: s.name, oldBot: old.name, currentBots: current.map((b) => b.name) });
			}
		}
	}

	// does being on cloudflare go with blocking AI training?
	const ref = (s: SiteReport): SiteRef => ({ domain: s.domain, name: s.name, sector: s.sector, contentSignal: s.contentSignal });
	const knownOnCloudflare = knownSites.filter((s) => s.isCloudflare === true);
	const knownNotOnCloudflare = knownSites.filter((s) => s.isCloudflare === false);
	const cloudflareInsight: Report['cloudflareInsight'] = {
		behind: { sites: knownOnCloudflare.length, training: countPurpose(knownOnCloudflare, 'training') },
		notBehind: { sites: knownNotOnCloudflare.length, training: countPurpose(knownNotOnCloudflare, 'training') },
		managed: sites.filter((s) => s.managedBlock === true).map(ref),
		contentSignals: sites.filter((s) => s.contentSignal !== null).map(ref),
		openOnCloudflare: knownOnCloudflare.filter((s) => s.purposes.training === 'allowed').map(ref),
	};
	const lastSeen = sites.map((s) => s.lastSeen).filter((d): d is string => d !== null);

	return {
		checkedOn: lastSeen.length > 0 ? lastSeen.sort().at(-1)! : null,
		totals: { sites: sites.length, known: knownSites.length, unknown },
		cloudflare: {
			yes: sites.filter((s) => s.isCloudflare === true).length,
			no: sites.filter((s) => s.isCloudflare === false).length,
			unknown: sites.filter((s) => s.isCloudflare === null).length,
		},
		managedBlock: sites.filter((s) => s.managedBlock === true).length,
		contentSignal: sites.filter((s) => s.contentSignal !== null).length,
		byPurpose,
		bySector,
		cloudflareInsight,
		byBot,
		deprecatedOnly,
		sites,
	};
}

// each site's latest period and the verdicts for those files
export async function loadReport(db: D1Database): Promise<Report> {
	const latest = `SELECT MAX(id) FROM site_states GROUP BY site_id`;
	const [siteResult, verdictResult] = await db.batch([
		db.prepare(
			`SELECT s.domain, s.name, s.sector, st.last_seen, st.outcome, st.http_status,
			        st.is_cloudflare, st.robots_hash, f.has_managed_block, f.content_signal
			 FROM sites s
			 LEFT JOIN site_states st ON st.site_id = s.id AND st.id IN (${latest})
			 LEFT JOIN robots_files f ON f.hash = st.robots_hash
			 ORDER BY s.sector, s.name`,
		),
		db.prepare(
			`SELECT robots_hash, bot_name, verdict FROM verdicts
			 WHERE robots_hash IN (SELECT robots_hash FROM site_states WHERE id IN (${latest}))`,
		),
	]);
	return buildReport(siteResult.results as unknown as SiteRow[], verdictResult.results as unknown as VerdictRow[], BOTS);
}

// one row per site for the CSV download
export function toCsv(report: Report, bots: Bot[] = BOTS): string {
	const header = [
		'domain',
		'name',
		'sector',
		'last_seen',
		'outcome',
		'http_status',
		'is_cloudflare',
		'managed_block',
		'content_signal',
		...PURPOSES,
		...bots.map((b) => b.name),
	];
	const cell = (value: unknown): string => {
		if (value === null || value === undefined) return '';
		const text = String(value);
		return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
	};
	const lines = report.sites.map((s) =>
		[
			s.domain,
			s.name,
			s.sector,
			s.lastSeen,
			s.outcome,
			s.httpStatus,
			s.isCloudflare,
			s.managedBlock,
			s.contentSignal,
			...PURPOSES.map((p) => s.purposes[p]),
			...bots.map((b) => s.bots[b.name]),
		]
			.map(cell)
			.join(','),
	);
	return [header.join(','), ...lines].join('\n') + '\n';
}
