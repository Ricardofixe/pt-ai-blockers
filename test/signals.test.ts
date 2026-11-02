// tests for Cloudflare's managed block and Content-Signal

import { describe, it, expect } from 'vitest';
import { hasManagedBlock, contentSignal } from '../src/parser';

// a shortened copy of what Cloudflare's managed robots.txt adds
const MANAGED = [
	'# BEGIN Cloudflare Managed content',
	'User-Agent: *',
	'Content-signal: search=yes, ai-train=no',
	'Allow: /',
	'',
	'User-agent: GPTBot',
	'Disallow: /',
	'# END Cloudflare Managed Content',
	'',
	'User-agent: *',
	'Disallow: /admin/',
].join('\n');

describe('hasManagedBlock', () => {
	it("detects Cloudflare's managed section", () => {
		expect(hasManagedBlock(MANAGED)).toBe(true);
	});

	it('is false for an ordinary file', () => {
		expect(hasManagedBlock('User-agent: *\nDisallow: /admin/')).toBe(false);
	});

	it('is false when Cloudflare is only mentioned in a comment', () => {
		expect(hasManagedBlock('# This site is protected by Cloudflare\nUser-agent: *\nDisallow:')).toBe(false);
	});
});

describe('contentSignal', () => {
	it('returns the value of the Content-Signal line, whatever its capitalization', () => {
		expect(contentSignal(MANAGED)).toBe('search=yes, ai-train=no');
		expect(contentSignal('User-agent: *\nCONTENT-SIGNAL: ai-train=no')).toBe('ai-train=no');
	});

	it('returns null when there is no Content-Signal line', () => {
		expect(contentSignal('User-agent: *\nDisallow: /admin/')).toBeNull();
	});

	it('ignores a Content-Signal line that is commented out', () => {
		expect(contentSignal('# Content-Signal: ai-train=no\nUser-agent: *\nDisallow:')).toBeNull();
	});

	it('returns the first one when there are several', () => {
		const text = 'User-agent: *\nContent-Signal: ai-train=no\nUser-agent: GPTBot\nContent-Signal: search=no';
		expect(contentSignal(text)).toBe('ai-train=no');
	});
});
