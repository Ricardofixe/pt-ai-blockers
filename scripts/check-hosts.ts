// checks where each site in src/sites.ts actually lives by following redirects
// prints "ok" if the hostname is right, or the hostname to change it to

import { SITES } from '../src/sites';

async function main() {
	for (const site of SITES) {
		const label = site.domain.padEnd(28);
		try {
			const res = await fetch(`https://${site.domain}/`, {
				redirect: 'follow', // follow redirects
				signal: AbortSignal.timeout(10_000), // give up after 10 seconds
			});
			const finalHost = new URL(res.url).hostname;
			const note = finalHost === site.domain ? 'ok' : `CHANGE TO ${finalHost}`;
			console.log(`${label} ${res.status}  ${note}`);
		} catch (err) {
			const cause = (err as { cause?: { code?: string } }).cause?.code ?? '';
			console.log(`${label} FAILED  ${(err as Error).message} ${cause}`);
		}
	}
}

main();
