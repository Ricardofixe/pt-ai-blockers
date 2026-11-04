// tests for buildReport and toCsv

import { describe, it, expect } from 'vitest';
import { buildReport, strongest, toCsv, type SiteRow, type VerdictRow } from '../src/report';
import type { Bot } from '../src/bots';

// a small bot list, so the tests don't depend on bots.ts
const BOTS: Bot[] = [
	{ name: 'GPTBot', operator: 'OpenAI', purpose: 'training', deprecated: false, sourceUrl: null },
	{ name: 'CCBot', operator: 'Common Crawl', purpose: 'training', deprecated: false, sourceUrl: null },
	{ name: 'OAI-SearchBot', operator: 'OpenAI', purpose: 'search', deprecated: false, sourceUrl: null },
	{ name: 'ClaudeBot', operator: 'Anthropic', purpose: 'training', deprecated: false, sourceUrl: null },
	{ name: 'anthropic-ai', operator: 'Anthropic', purpose: 'training', deprecated: true, sourceUrl: null },
];

// a site row with defaults, each test overrides what it needs
const row = (domain: string, extra: Partial<SiteRow> = {}): SiteRow => ({
	domain,
	name: domain,
	sector: 'news',
	last_seen: '2026-11-04',
	outcome: 'ok',
	http_status: 200,
	is_cloudflare: 1,
	robots_hash: `hash-${domain}`,
	has_managed_block: 0,
	content_signal: null,
	...extra,
});

// verdicts for one file
const verdicts = (hash: string, v: Record<string, 'blocked' | 'partial' | 'allowed'>): VerdictRow[] =>
	Object.entries(v).map(([bot_name, verdict]) => ({ robots_hash: hash, bot_name, verdict }));

// 1
describe('strongest', () => {
	it('picks blocked over partial over allowed, and allowed when empty', () => {
		expect(strongest(['allowed', 'blocked', 'partial'])).toBe('blocked');
		expect(strongest(['allowed', 'partial'])).toBe('partial');
		expect(strongest([])).toBe('allowed');
	});
});

describe('buildReport', () => {
	// 2
	it('treats a site without a robots.txt (404) as known, with every bot allowed', () => {
		const report = buildReport([row('a.pt', { outcome: 'not_found', http_status: 404, robots_hash: null })], [], BOTS);
		expect(report.sites[0].known).toBe(true);
		expect(report.sites[0].purposes).toEqual({ training: 'allowed', search: 'allowed', user: 'allowed' });
	});

	// 3
	it('leaves unknown outcomes and never checked sites out of every count', () => {
		const rows = [
			row('ok.pt'),
			row('blocked-checker.pt', { outcome: 'challenge', http_status: 403, robots_hash: null }),
			row('new.pt', { outcome: null, http_status: null, robots_hash: null, last_seen: null, is_cloudflare: null }),
		];
		const report = buildReport(rows, verdicts('hash-ok.pt', { GPTBot: 'blocked' }), BOTS);
		expect(report.totals).toEqual({ sites: 3, known: 1, unknown: { challenge: 1, not_checked: 1 } });
		expect(report.byPurpose.training).toEqual({ blocked: 1, partial: 0, allowed: 0 });
		expect(report.sites[1].purposes.training).toBeNull();
	});

	// 4
	it('gives each purpose the strongest verdict among its current bots', () => {
		const rows = [row('a.pt'), row('b.pt')];
		const v = [
			...verdicts('hash-a.pt', { GPTBot: 'blocked', CCBot: 'allowed', ClaudeBot: 'allowed' }),
			...verdicts('hash-b.pt', { GPTBot: 'partial', CCBot: 'allowed', ClaudeBot: 'allowed' }),
		];
		const report = buildReport(rows, v, BOTS);
		expect(report.sites.map((s) => s.purposes.training)).toEqual(['blocked', 'partial']);
		expect(report.byPurpose.training).toEqual({ blocked: 1, partial: 1, allowed: 0 });
	});

	// 5
	it('ignores deprecated names for purposes, and flags sites that only block them', () => {
		const v = verdicts('hash-a.pt', { GPTBot: 'allowed', CCBot: 'allowed', ClaudeBot: 'allowed', 'anthropic-ai': 'blocked' });
		const report = buildReport([row('a.pt')], v, BOTS);
		expect(report.sites[0].purposes.training).toBe('allowed');
		expect(report.deprecatedOnly).toEqual([{ domain: 'a.pt', name: 'a.pt', oldBot: 'anthropic-ai', currentBots: ['ClaudeBot'] }]);
	});

	// 6
	it("doesn't flag a site that blocks both the old and the current name", () => {
		const v = verdicts('hash-a.pt', { ClaudeBot: 'blocked', 'anthropic-ai': 'blocked' });
		expect(buildReport([row('a.pt')], v, BOTS).deprecatedOnly).toEqual([]);
	});

	// 7
	it("counts each bot's verdicts and groups purposes by sector", () => {
		const rows = [row('a.pt'), row('b.pt', { sector: 'university' })];
		const v = [...verdicts('hash-a.pt', { GPTBot: 'blocked' }), ...verdicts('hash-b.pt', { GPTBot: 'allowed' })];
		const report = buildReport(rows, v, BOTS);
		expect(report.byBot.find((b) => b.name === 'GPTBot')!.counts).toEqual({ blocked: 1, partial: 0, allowed: 1 });
		expect(report.bySector.map((s) => [s.sector, s.purposes.training.blocked])).toEqual([
			['news', 1],
			['university', 0],
		]);
	});

	// 8
	it('counts Cloudflare as yes / no / unknown', () => {
		const rows = [
			row('a.pt'),
			row('b.pt', { is_cloudflare: 0 }),
			row('c.pt', { outcome: 'unreachable', is_cloudflare: null, robots_hash: null, http_status: null }),
		];
		expect(buildReport(rows, [], BOTS).cloudflare).toEqual({ yes: 1, no: 1, unknown: 1 });
	});
});

// 9
describe('toCsv', () => {
	it('writes one row per site and quotes cells that need it', () => {
		const report = buildReport([row('a.pt', { name: 'Jornal "A", Lda' })], verdicts('hash-a.pt', { GPTBot: 'blocked' }), BOTS);
		const lines = toCsv(report, BOTS).trim().split('\n');
		expect(lines).toHaveLength(2);
		expect(lines[0].startsWith('domain,name,sector,')).toBe(true);
		expect(lines[1]).toContain('"Jornal ""A"", Lda"');
	});
});

// 10
describe('cloudflareInsight', () => {
	it('compares cloudflare and non-cloudflare sites, and lists managed and open cloudflare sites', () => {
		const rows = [
			row('cf-blocks.pt', { has_managed_block: 1, content_signal: 'search=yes, ai-train=no' }),
			row('cf-open.pt'),
			row('not-cf.pt', { is_cloudflare: 0 }),
			row('cf-unknown.pt', { outcome: 'challenge', http_status: 403, robots_hash: null }), // on cloudflare but unreadable
		];
		const v = [
			...verdicts('hash-cf-blocks.pt', { GPTBot: 'blocked' }),
			...verdicts('hash-cf-open.pt', { GPTBot: 'allowed' }),
			...verdicts('hash-not-cf.pt', { GPTBot: 'blocked' }),
		];
		const cf = buildReport(rows, v, BOTS).cloudflareInsight;
		expect(cf.behind).toEqual({ sites: 2, training: { blocked: 1, partial: 0, allowed: 1 } }); // unreadable site left out
		expect(cf.notBehind).toEqual({ sites: 1, training: { blocked: 1, partial: 0, allowed: 0 } });
		expect(cf.managed.map((s) => s.domain)).toEqual(['cf-blocks.pt']);
		expect(cf.contentSignals[0].contentSignal).toBe('search=yes, ai-train=no');
		expect(cf.openOnCloudflare.map((s) => s.domain)).toEqual(['cf-open.pt']);
	});
});
