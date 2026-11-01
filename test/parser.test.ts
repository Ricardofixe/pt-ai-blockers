// tests for parseRobots on robots.txt

import { describe, it, expect } from 'vitest';
import { parseRobots } from '../src/parser';

describe('parseRobots', () => {
	// Grouping
	// 1
	it('returns no groups for an empty file', () => {
		expect(parseRobots('')).toEqual([]);
	});

	// 2
	it('puts consecutive user-agent lines in one group', () => {
		const text = 'User-agent: GPTBot\nUser-agent: ClaudeBot\nDisallow: /';
		expect(parseRobots(text)).toEqual([
			{
				agents: ['gptbot', 'claudebot'],
				rules: [{ type: 'disallow', path: '/' }],
			},
		]);
	});

	// 3
	it('starts a new group at a user-agent line that follows a rule', () => {
		const text = 'User-agent: *\nDisallow: /admin/\nUser-agent: GPTBot\nDisallow: /';
		expect(parseRobots(text)).toEqual([
			{ agents: ['*'], rules: [{ type: 'disallow', path: '/admin/' }] },
			{ agents: ['gptbot'], rules: [{ type: 'disallow', path: '/' }] },
		]);
	});

	// 4
	it('keeps separate groups for the same bot separate (verdictFor will later merge them)', () => {
		const text = 'User-agent: GPTBot\nDisallow: /a/\nUser-agent: *\nDisallow: /b/\nUser-agent: GPTBot\nDisallow: /c/';
		expect(parseRobots(text)).toEqual([
			{ agents: ['gptbot'], rules: [{ type: 'disallow', path: '/a/' }] },
			{ agents: ['*'], rules: [{ type: 'disallow', path: '/b/' }] },
			{ agents: ['gptbot'], rules: [{ type: 'disallow', path: '/c/' }] },
		]);
	});

	// 5
	it('keeps a user-agent line at the end of the file, even with no rules', () => {
		const text = 'User-agent: *\nDisallow: /admin/\nUser-agent: GPTBot';
		expect(parseRobots(text)).toEqual([
			{ agents: ['*'], rules: [{ type: 'disallow', path: '/admin/' }] },
			{ agents: ['gptbot'], rules: [] },
		]);
	});

	// 6
	it('ignores rules that come before any user-agent line', () => {
		const text = 'Disallow: /\nUser-agent: GPTBot\nDisallow: /private/';
		expect(parseRobots(text)).toEqual([{ agents: ['gptbot'], rules: [{ type: 'disallow', path: '/private/' }] }]);
	});

	// Rules
	// 7
	it('keeps allow and disallow rules in order', () => {
		const text = 'User-agent: GPTBot\nDisallow: /\nAllow: /noticias/';
		expect(parseRobots(text)).toEqual([
			{
				agents: ['gptbot'],
				rules: [
					{ type: 'disallow', path: '/' },
					{ type: 'allow', path: '/noticias/' },
				],
			},
		]);
	});

	// 8
	it('adds no rule for an empty Disallow or Allow, but both still end the user-agent list', () => {
		const text = 'User-agent: GPTBot\nDisallow:\nUser-agent: ClaudeBot\nAllow:\nUser-agent: CCBot\nDisallow: /';
		expect(parseRobots(text)).toEqual([
			{ agents: ['gptbot'], rules: [] },
			{ agents: ['claudebot'], rules: [] },
			{ agents: ['ccbot'], rules: [{ type: 'disallow', path: '/' }] },
		]);
	});

	//9
	it('keeps paths exactly as written in terms of case, colons and wildcards', () => {
		const text = 'User-agent: GPTBot\nDisallow: /Admin/Login\nDisallow: /search:results\nDisallow: /*.pdf$';
		expect(parseRobots(text)).toEqual([
			{
				agents: ['gptbot'],
				rules: [
					{ type: 'disallow', path: '/Admin/Login' },
					{ type: 'disallow', path: '/search:results' },
					{ type: 'disallow', path: '/*.pdf$' },
				],
			},
		]);
	});

	// Other fields
	// 10
	it("ignores fields it doesn't use, like Sitemap and Content-Signal", () => {
		const text = [
			'User-agent: *',
			'Content-Signal: search=yes, ai-train=no',
			'Disallow: /admin/',
			'Sitemap: https://www.example.pt/sitemap.xml',
		].join('\n');
		expect(parseRobots(text)).toEqual([{ agents: ['*'], rules: [{ type: 'disallow', path: '/admin/' }] }]);
	});

	// 11
	it('treats Crawl-delay as part of a group: it adds no rule but ends the user-agent list', () => {
		const text = 'User-agent: GPTBot\nCrawl-delay: 10\nUser-agent: ClaudeBot\nDisallow: /';
		expect(parseRobots(text)).toEqual([
			{ agents: ['gptbot'], rules: [] },
			{ agents: ['claudebot'], rules: [{ type: 'disallow', path: '/' }] },
		]);
	});

	// Messy input
	// 12
	it('ignores comments on their own line, after a value, and inside a path', () => {
		const text = [
			'# We allow GPTBot for now',
			'User-agent: GPTBot # OpenAI',
			'Disallow: /private/ # members only',
			'Disallow: /foo#bar',
		].join('\n');
		expect(parseRobots(text)).toEqual([
			{
				agents: ['gptbot'],
				rules: [
					{ type: 'disallow', path: '/private/' },
					{ type: 'disallow', path: '/foo' },
				],
			},
		]);
	});

	// 13
	it('treats field names as case-insensitive and lowercases agent names', () => {
		const text = 'USER-AGENT: GPTBot\ndisallow: /';
		expect(parseRobots(text)).toEqual([{ agents: ['gptbot'], rules: [{ type: 'disallow', path: '/' }] }]);
	});

	// 14
	it('handles Windows line endings and extra spaces', () => {
		const text = 'User-agent:   GPTBot  \r\n  Disallow:   /  \r\n';
		expect(parseRobots(text)).toEqual([{ agents: ['gptbot'], rules: [{ type: 'disallow', path: '/' }] }]);
	});

	// 15
	it('skips lines without a colon', () => {
		const text = 'User-agent: GPTBot\nthis line is garbage\nDisallow: /';
		expect(parseRobots(text)).toEqual([{ agents: ['gptbot'], rules: [{ type: 'disallow', path: '/' }] }]);
	});

	// 16
	it('starts a group for an empty User-agent but adds no name, so its rules apply to no one', () => {
		// Skipping the line instead would attach "Disallow: /" to the * group above.
		const text = 'User-agent: *\nDisallow: /admin/\nUser-agent:\nDisallow: /';
		expect(parseRobots(text)).toEqual([
			{ agents: ['*'], rules: [{ type: 'disallow', path: '/admin/' }] },
			{ agents: [], rules: [{ type: 'disallow', path: '/' }] },
		]);
	});
});
