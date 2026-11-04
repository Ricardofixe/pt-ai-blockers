import { runBatch } from './run';
import { loadReport, toCsv } from './report';

const BATCH_SIZE = 25; // sites per run, see the cron schedule in wrangler.jsonc
const CACHE = 'public, max-age=300'; // browsers and Cloudflare may reuse a response for 5 minutes

export default {
	// Web requests
	async fetch(request, env, ctx): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname === '/api/summary') {
			return Response.json(await loadReport(env.DB), { headers: { 'Cache-Control': CACHE } });
		}

		if (url.pathname === '/api/sites.csv') {
			return new Response(toCsv(await loadReport(env.DB)), {
				headers: {
					'Content-Type': 'text/csv; charset=utf-8',
					'Content-Disposition': 'attachment; filename="pt-ai-blockers.csv"',
					'Cache-Control': CACHE,
				},
			});
		}

		return new Response('Not found', { status: 404 });
	},

	// timed runs, each run checks up to BATCH_SIZE sites not yet checked today
	async scheduled(controller, env, ctx): Promise<void> {
		const today = new Date(controller.scheduledTime).toISOString().slice(0, 10);
		await runBatch(env.DB, today, BATCH_SIZE);
	},
} satisfies ExportedHandler<Env>;
