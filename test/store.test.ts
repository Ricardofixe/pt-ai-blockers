// tests for decision logic in store.ts

import { describe, it, expect } from 'vitest';
import { previousDay, decideWrite, toFlag, type StateRow, type NewState } from '../src/store';

const prev: StateRow = {
	id: 1,
	site_id: 7,
	last_seen: '2026-11-02',
	outcome: 'ok',
	http_status: 200,
	robots_hash: 'abc',
	is_cloudflare: 1,
};
const same: NewState = { outcome: 'ok', http_status: 200, robots_hash: 'abc', is_cloudflare: 1 };
const TODAY = '2026-11-03';

//1
describe('previousDay', () => {
	it('goes back one day, across month and year boundaries and leap days', () => {
		expect(previousDay('2026-11-03')).toBe('2026-11-02');
		expect(previousDay('2026-03-01')).toBe('2026-02-28');
		expect(previousDay('2027-01-01')).toBe('2026-12-31');
		expect(previousDay('2028-03-01')).toBe('2028-02-29'); // 2028 is a leap year
	});
});

//2
describe('toFlag', () => {
	it('turns true/false into 1/0 and keeps null', () => {
		expect(toFlag(true)).toBe(1);
		expect(toFlag(false)).toBe(0);
		expect(toFlag(null)).toBeNull();
	});
});

describe('decideWrite', () => {
	//3
	it("starts a new period for a site's first check", () => {
		expect(decideWrite(undefined, same, TODAY)).toBe('new');
	});

	//4
	it('extends the period when nothing changed and it was seen yesterday', () => {
		expect(decideWrite(prev, same, TODAY)).toBe('extend');
	});

	//5
	it('starts a new period after a gap, even if nothing changed', () => {
		expect(decideWrite({ ...prev, last_seen: '2026-10-30' }, same, TODAY)).toBe('new');
	});

	//6
	it('starts a new period when anything recorded changes', () => {
		expect(decideWrite(prev, { ...same, robots_hash: 'def' }, TODAY)).toBe('new');
		expect(decideWrite(prev, { ...same, outcome: 'challenge', robots_hash: null }, TODAY)).toBe('new');
		expect(decideWrite(prev, { ...same, http_status: 203 }, TODAY)).toBe('new');
		expect(decideWrite(prev, { ...same, is_cloudflare: 0 }, TODAY)).toBe('new');
	});

	//7
	it("treats 'unknown' (null) as different from 'no' (0)", () => {
		expect(decideWrite({ ...prev, is_cloudflare: 0 }, { ...same, is_cloudflare: null }, TODAY)).toBe('new');
	});
});
