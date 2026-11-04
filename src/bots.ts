// this is the base file for the AI bots we are tracking
// the sync code copies it into the bots table.
//
// never delete a bot, set deprecated instead.
// it will cause the next sync to fail
//
// Last checked - 2026-10-30.

export type Purpose = 'training' | 'search' | 'user'; // matches the check in migrations/0001_initial

export interface Bot {
	name: string; // token used in robots.txt
	operator: string; // company that runs it
	purpose: Purpose;
	// training = collects data for AI models
	// search = indexes pages so an AI search tool can cite them
	// user = fetches a page live because a user asked
	deprecated: boolean; // true = operator no longer documents this name (stored as 1/0)
	sourceUrl: string | null; // where the categorization comes from
}

const OPENAI = 'https://developers.openai.com/api/docs/bots';
const ANTHROPIC = 'https://support.claude.com/en/articles/8896518';
const PERPLEXITY = 'https://docs.perplexity.ai/docs/resources/perplexity-crawlers';
const META = 'https://developers.facebook.com/docs/sharing/webmasters/web-crawlers';

export const BOTS: Bot[] = [
	// OpenAI
	{
		name: 'GPTBot',
		operator: 'OpenAI',
		purpose: 'training',
		deprecated: false,
		sourceUrl: OPENAI,
	},
	{
		name: 'OAI-SearchBot',
		operator: 'OpenAI',
		purpose: 'search',
		deprecated: false,
		sourceUrl: OPENAI,
	},

	{
		name: 'ChatGPT-User',
		operator: 'OpenAI',
		purpose: 'user',
		deprecated: false,
		sourceUrl: OPENAI,
	},

	// Anthropic
	{
		name: 'ClaudeBot',
		operator: 'Anthropic',
		purpose: 'training',
		deprecated: false,
		sourceUrl: ANTHROPIC,
	},
	{
		name: 'Claude-SearchBot',
		operator: 'Anthropic',
		purpose: 'search',
		deprecated: false,
		sourceUrl: ANTHROPIC,
	},
	{
		name: 'Claude-User',
		operator: 'Anthropic',
		purpose: 'user',
		deprecated: false,
		sourceUrl: ANTHROPIC,
	},
	// Older names no longer in Anthropic's docs, but still likely to be in robots.txt files.
	{
		name: 'anthropic-ai',
		operator: 'Anthropic',
		purpose: 'training',
		deprecated: true,
		sourceUrl: null,
	},
	{
		name: 'Claude-Web',
		operator: 'Anthropic',
		purpose: 'user',
		deprecated: true,
		sourceUrl: null,
	},

	// Perplexity
	{
		name: 'PerplexityBot',
		operator: 'Perplexity',
		purpose: 'search',
		deprecated: false,
		sourceUrl: PERPLEXITY,
	},
	{
		name: 'Perplexity-User',
		operator: 'Perplexity',
		purpose: 'user',
		deprecated: false,
		sourceUrl: PERPLEXITY,
	},

	// Meta
	{
		name: 'Meta-ExternalAgent',
		operator: 'Meta',
		purpose: 'training',
		deprecated: false,
		sourceUrl: META,
	},
	{
		name: 'Meta-WebIndexer',
		operator: 'Meta',
		purpose: 'search',
		deprecated: false,
		sourceUrl: META,
	},

	{
		name: 'Meta-ExternalFetcher',
		operator: 'Meta',
		purpose: 'user',
		deprecated: false,
		sourceUrl: META,
	},

	// Google
	{
		name: 'Google-Extended',
		operator: 'Google',
		purpose: 'training',
		deprecated: false,
		sourceUrl: 'https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers',
	},

	//Apple
	{
		name: 'Applebot-Extended',
		operator: 'Apple',
		purpose: 'training',
		deprecated: false,
		sourceUrl: 'https://support.apple.com/en-us/119829',
	},

	// Common Crawl's page doesn't mention AI, but its public dataset is widely used to
	// train AI models, which is why sites block it. Classified as training on that basis.
	{
		name: 'CCBot',
		operator: 'Common Crawl',
		purpose: 'training',
		deprecated: false,
		sourceUrl: 'https://commoncrawl.org/ccbot',
	},

	// ByteDance ("TikTok") publishes no documentation for this crawler.
	{
		name: 'Bytespider',
		operator: 'ByteDance',
		purpose: 'training',
		deprecated: false,
		sourceUrl: null,
	},
];
