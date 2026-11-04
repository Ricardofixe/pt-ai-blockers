// tests for the checker's helper functions

import { describe, it, expect } from 'vitest';
import { classifyResponse, cleanRobots, sha256 } from '../src/checker';

describe('classifyResponse', () => {
	//1
	it('is ok for a 200 with a robots.txt body, even an empty one', () => {
		expect(classifyResponse(200, 'User-agent: *\nDisallow: /admin/')).toBe('ok');
		expect(classifyResponse(200, '')).toBe('ok');
	});

	//2
	it('is challenge for a 200 that returns an HTML page instead of a robots.txt', () => {
		expect(classifyResponse(200, '<!DOCTYPE html><html><head><title>Just a moment...</title>')).toBe('challenge');
		expect(classifyResponse(200, '\n  <html lang="pt">')).toBe('challenge');
	});

	//3
	it('is ok when a robots.txt merely mentions HTML in a comment', () => {
		expect(classifyResponse(200, '# See <html> docs\nUser-agent: *\nDisallow:')).toBe('ok');
	});

	//4
	it('is challenge for a 200 that is some other kind of response', () => {
		expect(classifyResponse(200, '{"error": "forbidden"}')).toBe('challenge'); // JSON
		expect(classifyResponse(200, 'Access denied')).toBe('challenge'); // plain text
		expect(classifyResponse(200, '<?xml version="1.0"?><urlset>')).toBe('challenge'); // XML
		expect(classifyResponse(200, '<!-- generated -->\n<html>')).toBe('challenge'); // HTML without a doctype
		expect(classifyResponse(200, '# 404\nPage not found')).toBe('challenge'); // Markdown-style text
	});

	//5
	it('is ok for a robots.txt that only contains comments', () => {
		expect(classifyResponse(200, '# Nothing to block here')).toBe('ok');
	});

	//6
	it('is challenge when access is refused (401, 403, 429)', () => {
		expect(classifyResponse(401, '')).toBe('challenge');
		expect(classifyResponse(403, '<html>Forbidden</html>')).toBe('challenge');
		expect(classifyResponse(429, '')).toBe('challenge');
	});

	//7
	it('is not_found for other 4xx responses', () => {
		expect(classifyResponse(404, 'Not Found')).toBe('not_found');
		expect(classifyResponse(410, '')).toBe('not_found');
	});
	//8
	it('is server_error for 5xx responses', () => {
		expect(classifyResponse(500, '')).toBe('server_error');
		expect(classifyResponse(503, '<html>Maintenance</html>')).toBe('server_error');
	});
});

describe('cleanRobots', () => {
	//9
	it('makes files that differ only in line endings or spaces around lines identical', () => {
		const unix = 'User-agent: *\nDisallow: /admin/';
		const windows = 'User-agent: *  \r\nDisallow: /admin/\t\r\n\r\n';
		const indented = '  User-agent: *\n\tDisallow: /admin/';
		expect(cleanRobots(windows)).toBe(unix);
		expect(cleanRobots(indented)).toBe(unix);
	});

	//10
	it('removes a byte order mark at the start', () => {
		expect(cleanRobots('\uFEFFUser-agent: *\nDisallow:')).toBe('User-agent: *\nDisallow:');
	});

	//11
	it('keeps comments and blank lines between groups', () => {
		const text = '# BEGIN Cloudflare Managed content\nUser-agent: *\nAllow: /\n\nUser-agent: GPTBot\nDisallow: /';
		expect(cleanRobots(text)).toBe(text);
	});
});

describe('sha256', () => {
	//12
	it('matches a known SHA-256 value', async () => {
		expect(await sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
	});

	//13
	it('gives the same hash for files that only differ before cleaning', async () => {
		const a = await sha256(cleanRobots('User-agent: *\r\nDisallow: /'));
		const b = await sha256(cleanRobots('User-agent: *\nDisallow: /  '));
		expect(a).toBe(b);
	});
});
