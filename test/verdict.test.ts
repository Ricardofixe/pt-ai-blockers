// tests for verdictFor
// each test feeds a small robots.txt through parseRobots, so the input stays readable

import { describe, it, expect } from 'vitest';
import { parseRobots, verdictFor } from '../src/parser';

// helper with robots.txt text + bot name
const verdict = (text: string, bot: string) => verdictFor(parseRobots(text), bot);

describe('verdictFor', () => {
	// what rules apply to the bot

	//1
	it('allows everything when the file has no groups', () => {
		expect(verdict('', 'GPTBot')).toBe('allowed');
		expect(verdict('# only a comment', 'GPTBot')).toBe('allowed');
	});

	//2
	it("uses the bot's own group, matching names case-insensitively", () => {
		expect(verdict('User-agent: gptbot\nDisallow: /', 'GPTBot')).toBe('blocked');
	});

	//3
	it('falls back to the * group when no group names the bot', () => {
		expect(verdict('User-agent: *\nDisallow: /', 'GPTBot')).toBe('blocked');
	});

	//4
	it('ignores the * group entirely when the bot has its own group', () => {
		const text = 'User-agent: *\nDisallow: /\nUser-agent: GPTBot';
		expect(verdict(text, 'GPTBot')).toBe('allowed'); // has a group, so * doesn't apply
		expect(verdict(text, 'ClaudeBot')).toBe('blocked'); // no own group, so * applies
	});

	//5
	it('combines all groups that name the bot', () => {
		const text = 'User-agent: GPTBot\nDisallow: /\nUser-agent: *\nDisallow: /admin/\nUser-agent: GPTBot\nAllow: /noticias/';
		expect(verdict(text, 'GPTBot')).toBe('partial');
	});

	//6
	it('ignores version numbers after the bot name', () => {
		expect(verdict('User-agent: GPTBot/1.1\nDisallow: /', 'GPTBot')).toBe('blocked');
	});

	//7
	it('matches the exact name only, not names that start the same way', () => {
		const text = 'User-agent: Applebot\nDisallow: /';
		expect(verdict(text, 'Applebot-Extended')).toBe('allowed');
	});

	//8
	it('never applies a group with no name', () => {
		const text = 'User-agent: *\nDisallow: /admin/\nUser-agent:\nDisallow: /';
		expect(verdict(text, 'GPTBot')).toBe('allowed');
	});

	// blocked

	//9
	it('is blocked when the rules disallow the root', () => {
		expect(verdict('User-agent: GPTBot\nDisallow: /', 'GPTBot')).toBe('blocked');
		expect(verdict('User-agent: GPTBot\nDisallow: /*', 'GPTBot')).toBe('blocked');
		expect(verdict('User-agent: GPTBot\nDisallow: *', 'GPTBot')).toBe('blocked');
	});

	// partial

	//10
	it('is partial when the root is blocked but some paths are allowed back', () => {
		expect(verdict('User-agent: GPTBot\nDisallow: /\nAllow: /noticias/', 'GPTBot')).toBe('partial');
	});

	//11
	it("is partial when the bot's own group disallows specific paths", () => {
		expect(verdict('User-agent: GPTBot\nDisallow: /premium/\nDisallow: /opiniao/', 'GPTBot')).toBe('partial');
	});

	// allowed

	//12
	it('is allowed when only generic * housekeeping rules apply', () => {
		expect(verdict('User-agent: *\nDisallow: /admin/\nDisallow: /search', 'GPTBot')).toBe('allowed');
	});

	//13
	it('is allowed when Allow: / cancels Disallow: /', () => {
		expect(verdict('User-agent: GPTBot\nDisallow: /\nAllow: /', 'GPTBot')).toBe('allowed');
	});
});
