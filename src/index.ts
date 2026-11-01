import { syncReferenceData } from './sync';

export default {
	async fetch(request, env, ctx): Promise<Response> {
		return new Response('Hello World!');
	},

	async scheduled(controller, env, ctx): Promise<void> {
		await syncReferenceData(env.DB);
	},
} satisfies ExportedHandler<Env>;
