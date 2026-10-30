-- websites we track
CREATE TABLE
  sites (
    id INTEGER PRIMARY KEY,
    domain TEXT NOT NULL UNIQUE, -- exact hostname, e.g. 'www.publico.pt'
    name TEXT NOT NULL, -- display name, e.g. 'Publico'
    sector TEXT NOT NULL CHECK (
      sector IN (
        'news',
        'broadcast',
        'sports',
        'tech_lifestyle',
        'university',
        'government'
      )
    )
  );

-- the AI bots we track
CREATE TABLE
  bots (
    name TEXT PRIMARY KEY, -- exact name used in robots.txt
    operator TEXT NOT NULL, -- company
    purpose TEXT NOT NULL CHECK (purpose IN ('training', 'search', 'user')),
    deprecated INTEGER NOT NULL DEFAULT 0 CHECK (deprecated IN (0, 1)), -- 1 = operator no longer lists it
    source_url TEXT -- source of the categorization
  );

-- every unique robots.txt
CREATE TABLE
  robots_files (
    hash TEXT PRIMARY KEY, -- SHA-256 of the cleaned-up file
    body TEXT NOT NULL, -- the cleaned-up file
    has_managed_block INTEGER NOT NULL CHECK (has_managed_block IN (0, 1)), -- Cloudflare managed section present
    content_signal TEXT -- the Content-Signal line, if any
  );

-- what each file says about each bot
CREATE TABLE
  verdicts (
    robots_hash TEXT NOT NULL REFERENCES robots_files (hash),
    bot_name TEXT NOT NULL REFERENCES bots (name),
    verdict TEXT NOT NULL CHECK (verdict IN ('blocked', 'partial', 'allowed')),
    -- blocked = bot can't access the root (/) and nothing is re-allowed
    -- partial = the bot's own named group restricts some paths, or blocks / but re-allows some
    -- allowed = everything else
    PRIMARY KEY (robots_hash, bot_name)
  );

-- one row per period during which nothing we record about the site changed
CREATE TABLE
  site_states (
    id INTEGER PRIMARY KEY,
    site_id INTEGER NOT NULL REFERENCES sites (id),
    first_seen TEXT NOT NULL, -- YYYY-MM-DD
    last_seen TEXT NOT NULL, -- YYYY-MM-DD
    outcome TEXT NOT NULL CHECK (
      outcome IN (
        'ok',
        'not_found',
        'server_error',
        'unreachable',
        'challenge'
      )
    ),
    http_status INTEGER, -- NULL if we got no response
    is_cloudflare INTEGER CHECK (is_cloudflare IN (0, 1)), -- 1 = response came with cf-ray in header; 0 = response came without cf-ray in header; NULL = no headers to check
    robots_hash TEXT REFERENCES robots_files (hash), -- only filled when outcome = 'ok'
    CHECK ((outcome = 'ok') = (robots_hash IS NOT NULL)),
    CHECK (first_seen <= last_seen)
  );

-- for faster lookups on last seen for a site
CREATE INDEX idx_site_states_site ON site_states (site_id, last_seen);